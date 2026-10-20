// Station, reading and shelter queries over the fixtures, as the backend would answer them.
import type {
  NearbyStation,
  Reading,
  River,
  RiverReason,
  RiskTier,
  Shelter,
  StationDetail,
  StationLink,
  StationSummary,
} from "../types";
import riversFx from "./fixtures/rivers.json";
import sheltersFx from "./fixtures/shelters.json";
import stationsFx from "./fixtures/stations.json";
import { haversineKm, shiftIso, timeShiftMs } from "./geo";

type FixtureStation = Omit<StationDetail, "upstream" | "downstream">;
interface FixtureEdge {
  upstream_id: number;
  downstream_id: number;
  approx_travel_hours: number | null;
}

const FX_STATIONS = stationsFx.stations as unknown as FixtureStation[];
const FX_EDGES = stationsFx.edges as FixtureEdge[];
const FX_INGESTED_AT = stationsFx.meta.ingested_at as string | null;
const FX_SHELTERS = sheltersFx.shelters as Omit<Shelter, "distance_km">[];
type FixtureRiver = Omit<River, "worst_tier" | "reason" | "distance_km">;
const FX_RIVERS = riversFx.rivers as unknown as FixtureRiver[];

export function offsetNow(): number {
  return timeShiftMs(FX_INGESTED_AT);
}

export function ingestedAt(): string | null {
  return FX_INGESTED_AT ? shiftIso(FX_INGESTED_AT, offsetNow()) : null;
}

function toSummary(s: FixtureStation, offset: number, overrides: Record<string, RiskTier>): StationSummary {
  const {
    left_bank: _l,
    right_bank: _r,
    min_bank: _m,
    ground_level: _g,
    critical_level_msl: _c,
    ...summary
  } = s;
  const latest = s.latest ? { ...s.latest, ts: shiftIso(s.latest.ts, offset) } : null;
  let risk = s.risk ? { ...s.risk, computed_at: shiftIso(s.risk.computed_at, offset) } : null;
  const override = overrides[String(s.id)];
  if (override) {
    risk = {
      tier: override,
      trend_cm_per_hr: risk?.trend_cm_per_hr ?? null,
      hours_to_bank: risk?.hours_to_bank ?? null,
      computed_at: latest?.ts ?? new Date().toISOString(),
    };
  }
  return { ...summary, latest, risk };
}

/** As the backend's whole network: the corridor fixtures (with banks, edges and readings), then every other station
 * the rivers fixture knows, by id. */
export function listStations(overrides: Record<string, RiskTier>): StationSummary[] {
  const offset = offsetNow();
  const corridor = FX_STATIONS.map((s) => toSummary(s, offset, overrides));
  const known = new Set(corridor.map((s) => s.id));
  const rest = new Map<number, StationSummary>();
  for (const r of liveRivers(overrides)) for (const s of r.stations) if (!known.has(s.id)) rest.set(s.id, s);
  return [...corridor, ...[...rest.values()].sort((a, b) => a.id - b.id)];
}

export function stationDetail(id: number, overrides: Record<string, RiskTier>): StationDetail | null {
  const fx = FX_STATIONS.find((s) => s.id === id);
  if (!fx) {
    // A station only the rivers fixture has: no banks or links on record, as the backend for a station without them.
    const s = listStations(overrides).find((x) => x.id === id);
    if (!s) return null;
    const none = { left_bank: null, right_bank: null, min_bank: null, ground_level: null, critical_level_msl: null };
    return { ...s, ...none, upstream: [], downstream: [] };
  }
  const offset = offsetNow();
  const byId = new Map(FX_STATIONS.map((s) => [s.id, s]));
  const link = (otherId: number, hours: number | null): StationLink[] => {
    const other = byId.get(otherId);
    return other ? [{ station: toSummary(other, offset, overrides), approx_travel_hours: hours }] : [];
  };
  return {
    ...toSummary(fx, offset, overrides),
    left_bank: fx.left_bank,
    right_bank: fx.right_bank,
    min_bank: fx.min_bank,
    ground_level: fx.ground_level,
    critical_level_msl: fx.critical_level_msl,
    upstream: FX_EDGES.filter((e) => e.downstream_id === id).flatMap((e) => link(e.upstream_id, e.approx_travel_hours)),
    downstream: FX_EDGES.filter((e) => e.upstream_id === id).flatMap((e) => link(e.downstream_id, e.approx_travel_hours)),
  };
}

export async function stationReadings(id: number, hours: number): Promise<Reading[] | null> {
  if (!FX_STATIONS.some((s) => s.id === id) && !listStations({}).some((s) => s.id === id)) return null;
  const fx = (await import("./fixtures/readings.json")).default as unknown as {
    readings: Record<string, [string, number, number | null, number | null][]>;
  };
  const offset = offsetNow();
  const rows = fx.readings[String(id)] ?? [];
  const cutoff = Date.now() - hours * 3600_000;
  return rows
    .map(([ts, level_msl, diff_wl_bank, discharge]) => ({
      ts: shiftIso(ts, offset),
      level_msl,
      diff_wl_bank,
      discharge,
    }))
    .filter((r) => Date.parse(r.ts) >= cutoff);
}

export function nearestStations(
  lat: number,
  lon: number,
  k: number,
  overrides: Record<string, RiskTier>,
): NearbyStation[] {
  return listStations(overrides)
    .map((s) => ({ ...s, distance_km: Math.round(haversineKm(lat, lon, s.lat, s.lon) * 10) / 10 }))
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, k);
}

export function shelters(q: { lat?: number; lon?: number; patients?: boolean; pets?: boolean }): Shelter[] {
  const hasPoint = q.lat != null && q.lon != null;
  return FX_SHELTERS.filter((s) => (!q.patients || s.accepts_patients) && (!q.pets || s.accepts_pets))
    .map((s) => ({
      ...s,
      distance_km: hasPoint ? Math.round(haversineKm(q.lat!, q.lon!, s.lat, s.lon) * 10) / 10 : null,
    }))
    .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
}

// --- rivers (as api/rivers.py picks them) ---------------------------------------

const TIER_RANK: RiskTier[] = ["normal", "watch", "warning", "danger"];
const RIVER_FALLBACK = 3;

/** A river's stations as of now: corridor ones through toSummary (demo tier overrides apply), the rest shifted. */
function liveRivers(overrides: Record<string, RiskTier>): FixtureRiver[] {
  const offset = offsetNow();
  const byId = new Map(FX_STATIONS.map((s) => [s.id, s]));
  return FX_RIVERS.map((r) => ({
    ...r,
    stations: r.stations.map((s) => {
      const fx = byId.get(s.id);
      if (fx) return toSummary(fx, offset, overrides);
      return {
        ...s,
        latest: s.latest ? { ...s.latest, ts: shiftIso(s.latest.ts, offset) } : null,
        risk: s.risk ? { ...s.risk, computed_at: shiftIso(s.risk.computed_at, offset) } : null,
      };
    }),
  }));
}

function worst(r: FixtureRiver): RiskTier | null {
  const tiers = r.stations.map((s) => s.risk?.tier).filter((t): t is RiskTier => !!t);
  return tiers.length ? tiers.reduce((a, b) => (TIER_RANK.indexOf(b) > TIER_RANK.indexOf(a) ? b : a)) : null;
}

function nearestKm(r: FixtureRiver, lat: number, lon: number): number {
  return Math.min(...r.stations.map((s) => haversineKm(lat, lon, s.lat, s.lon)));
}

function riverOut(r: FixtureRiver, reason: RiverReason, km: number | null): River {
  return { ...r, worst_tier: worst(r), reason, distance_km: km == null ? null : Math.round(km * 10) / 10 };
}

export function listRivers(
  q: { lat?: number; lon?: number; q?: string | null; limit: number },
  overrides: Record<string, RiskTier>,
): River[] {
  const rivers = liveRivers(overrides);
  const hasPoint = q.lat != null && q.lon != null;
  const km = (r: FixtureRiver) => (hasPoint ? nearestKm(r, q.lat!, q.lon!) : null);
  const bigFirst = (a: FixtureRiver, b: FixtureRiver) => b.stations.length - a.stations.length || a.key.localeCompare(b.key);
  const needle = q.q?.trim();
  if (needle) {
    // As the backend: a name hit first, then a station whose province, amphoe, name or code matches.
    const inPlace = (r: FixtureRiver) =>
      r.stations.some((s) => [s.province, s.amphoe, s.name_th, s.oldcode].some((v) => v?.includes(needle)));
    const named = rivers.filter((r) => r.name_th.includes(needle)).sort(bigFirst);
    const placed = rivers.filter((r) => !named.includes(r) && inPlace(r)).sort(bigFirst);
    return [...named, ...placed].slice(0, q.limit).map((r) => riverOut(r, "match", km(r)));
  }
  const over = (r: FixtureRiver) => Math.max(-99, ...r.stations.map((s) => s.latest?.diff_wl_bank ?? -99));
  const out = rivers
    .filter((r) => TIER_RANK.indexOf(worst(r) ?? "normal") >= 1)
    .sort((a, b) => TIER_RANK.indexOf(worst(b)!) - TIER_RANK.indexOf(worst(a)!) || over(b) - over(a) || a.key.localeCompare(b.key))
    .slice(0, q.limit)
    .map((r) => riverOut(r, "at_risk", km(r)));
  if (hasPoint && rivers.length) {
    const closest = [...rivers].sort((a, b) => km(a)! - km(b)! || a.key.localeCompare(b.key))[0];
    if (!out.some((r) => r.key === closest.key)) out.push(riverOut(closest, "near_you", km(closest)));
  }
  if (out.length) return out;
  return [...rivers].sort(bigFirst).slice(0, RIVER_FALLBACK).map((r) => riverOut(r, "largest", null));
}

export function riverDetail(key: string, overrides: Record<string, RiskTier>): River | null {
  const r = liveRivers(overrides).find((x) => x.key === key);
  return r ? riverOut(r, "match", null) : null;
}
