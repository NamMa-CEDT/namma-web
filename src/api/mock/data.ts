// Station, reading and shelter queries over the fixtures, as the backend would answer them.
import type {
  NearbyStation,
  Reading,
  RiskTier,
  Shelter,
  StationDetail,
  StationLink,
  StationSummary,
} from "../types";
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

export function listStations(overrides: Record<string, RiskTier>): StationSummary[] {
  const offset = offsetNow();
  return FX_STATIONS.map((s) => toSummary(s, offset, overrides));
}

export function stationDetail(id: number, overrides: Record<string, RiskTier>): StationDetail | null {
  const fx = FX_STATIONS.find((s) => s.id === id);
  if (!fx) return null;
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
  if (!FX_STATIONS.some((s) => s.id === id)) return null;
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
