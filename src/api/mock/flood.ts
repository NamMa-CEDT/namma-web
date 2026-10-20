// Flood tab in mock mode: a SAMPLE layer made up around the corridor's flood-prone reaches, so the tab can be built
// and rehearsed without a GISTDA key. It is not GISTDA data, and the page says so whenever the mock is on.
// The queries mirror namma-backend api/flood.py: sums of res-9 cells, parents for zoomed-out views, largest first.
import { cellArea, cellToParent, getResolution, gridDisk, gridDistance, latLngToCell, cellToLatLng } from "h3-js";
import type {
  FloodArea,
  FloodAreas,
  FloodCell,
  FloodCells,
  FloodHistory,
  FloodHistoryArea,
  FloodLevel,
  FloodNear,
  FloodPeriod,
  FloodTambon,
} from "../types";
import { haversineKm, toBangkokIso } from "./geo";

interface SampleCell {
  h3: string;
  /** GISTDA tb_idn of its seed's tambon (the outlines' code). */
  code: string;
  /** The shortest window it is in: how lately water was "seen" there. */
  seen: FloodPeriod;
  lat: number;
  lon: number;
  area_km2: number;
  province: string;
  amphoe: string;
  tambon: string;
  /** Hours before "now" GISTDA would have dated it. */
  ageHours: number;
  /** Made-up counts in GISTDA's shape (buildings, people, schools, hospitals in the cell). */
  buildings: number;
  population: number;
  schools: number;
  hospitals: number;
}

// [lat, lon, rings in the 3-, 7- and 30-day layers (-1 = none), province, amphoe, tambon, tambon code]: low ground
// along the Chao Phraya. Real names and codes (the outlines in public/boundaries); the flooding is made up, as a
// flood moving downstream: seen only weeks ago at Nakhon Sawan and Chai Nat, this week at Sing Buri, now at Ayutthaya.
const SEEDS: [number, number, number, number, number, string, string, string, string][] = [
  [14.415, 100.44, 7, 10, 12, "พระนครศรีอยุธยา", "บางบาล", "บางหลวงโดด", "140513"],
  [14.37, 100.49, 5, 8, 10, "พระนครศรีอยุธยา", "บางบาล", "สะพานไทย", "140504"],
  [14.31, 100.56, 5, 8, 10, "พระนครศรีอยุธยา", "บางปะอิน", "ขนอนหลวง", "140618"],
  [14.6, 100.43, 2, 7, 9, "อ่างทอง", "เมืองอ่างทอง", "ตลาดหลวง", "150101"],
  [14.88, 100.38, -1, 3, 7, "สิงห์บุรี", "เมืองสิงห์บุรี", "บางพุทรา", "170101"],
  [15.151, 100.192, -1, -1, 6, "ชัยนาท", "สรรพยา", "บางหลวง", "180406"],
  [15.42, 100.176, -1, 2, 5, "นครสวรรค์", "พยุหะคีรี", "ท่าน้ำอ้อย", "601008"],
  [15.714, 100.171, -1, -1, 7, "นครสวรรค์", "เมืองนครสวรรค์", "แควใหญ่", "600104"],
];
const WINDOWS: FloodPeriod[] = ["3days", "7days", "30days"];
// Hours before "now" GISTDA would have dated a cell, by the shortest window it is in: [from, span].
const AGE_HOURS: Record<FloodPeriod, [number, number]> = { "3days": [12, 48], "7days": [72, 96], "30days": [192, 504] };
const RAI_PER_KM2 = 625;
const PAD_DEG: Record<number, number> = { 5: 0.2, 6: 0.08, 7: 0.03, 8: 0.012, 9: 0 };

/** Deterministic 0–1 noise per cell (FNV-1a), so the sample looks the same on every load. */
function noise(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0) / 0x1_0000_0000;
}

const layers = new Map<FloodPeriod, SampleCell[]>();

function sample(period: FloodPeriod): SampleCell[] {
  const cached = layers.get(period);
  if (cached) return cached;
  const byCell = new Map<string, SampleCell>();
  const upTo = WINDOWS.indexOf(period);
  for (const [lat, lon, r3, r7, r30, province, amphoe, tambon, code] of SEEDS) {
    const rings = [r3, r7, r30];
    const centre = latLngToCell(lat, lon, 9);
    for (const h3 of gridDisk(centre, Math.max(rings[upTo], 0))) {
      // Ragged edges: the farther out, the fewer cells. The same noise for every window, so each one is a superset
      // of the shorter ones, as GISTDA's are.
      const dist = gridDistance(centre, h3);
      const r = noise(`${h3}:in`);
      const within = (k: number) => k >= 0 && dist <= k && r <= 1 - 0.9 * (dist / (k + 1)) ** 2;
      const shortest = rings.findIndex(within);
      if (byCell.has(h3) || shortest < 0 || shortest > upTo) continue;
      const seen = WINDOWS[shortest];
      const [from, span] = AGE_HOURS[seen];
      const [cLat, cLon] = cellToLatLng(h3);
      const buildings = Math.round(40 * noise(`${h3}:b`) ** 2);
      byCell.set(h3, {
        h3,
        code,
        seen,
        lat: cLat,
        lon: cLon,
        area_km2: cellArea(h3, "km2") * (0.35 + 0.65 * noise(`${h3}:area`)),
        province,
        amphoe,
        tambon,
        ageHours: from + span * noise(`${h3}:t`),
        buildings,
        population: Math.round(buildings * 2.7),
        schools: noise(`${h3}:s`) > 0.97 ? 1 : 0,
        hospitals: noise(`${h3}:h`) > 0.995 ? 1 : 0,
      });
    }
  }
  const cells = [...byCell.values()];
  layers.set(period, cells);
  return cells;
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;
const area = (km2: number) => ({ area_km2: round(km2, 4), area_rai: Math.round(km2 * RAI_PER_KM2) });

function layerInfo(period: FloodPeriod, ingestedAt: string | null, cells: SampleCell[]) {
  const now = ingestedAt ? Date.parse(ingestedAt) : Date.now();
  const ages = cells.map((c) => c.ageHours);
  const iso = (hours: number) => toBangkokIso(now - hours * 3_600_000);
  return {
    period,
    fetched_at: toBangkokIso(now),
    observed_from: ages.length ? iso(Math.max(...ages)) : null,
    observed_to: ages.length ? iso(Math.min(...ages)) : null,
  };
}

export function floodAreas(
  period: FloodPeriod,
  level: FloodLevel,
  filter: { province?: string | null; amphoe?: string | null },
  limit: number,
  ingestedAt: string | null,
): FloodAreas {
  const all = sample(period);
  const inFilter = all.filter(
    (c) => (!filter.province || c.province === filter.province) && (!filter.amphoe || c.amphoe === filter.amphoe),
  );
  const groups = new Map<string, SampleCell[]>();
  for (const c of inFilter) {
    const key = [c.province, level !== "province" && c.amphoe, level === "tambon" && c.tambon].join("|");
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const areas: FloodArea[] = [...groups.values()].map((cs) => {
    const km2 = cs.reduce((s, c) => s + c.area_km2, 0);
    return {
      province: cs[0].province,
      amphoe: level === "province" ? null : cs[0].amphoe,
      tambon: level === "tambon" ? cs[0].tambon : null,
      code: level === "tambon" ? cs[0].code : null,
      cells: cs.length,
      ...area(km2),
      lat: round(cs.reduce((s, c) => s + c.lat * c.area_km2, 0) / km2, 5),
      lon: round(cs.reduce((s, c) => s + c.lon * c.area_km2, 0) / km2, 5),
      buildings: cs.reduce((s, c) => s + c.buildings, 0),
      population: cs.reduce((s, c) => s + c.population, 0),
    };
  });
  areas.sort((a, b) => b.area_km2 - a.area_km2);
  return {
    ...layerInfo(period, ingestedAt, all),
    level,
    total: { cells: inFilter.length, ...area(inFilter.reduce((s, c) => s + c.area_km2, 0)) },
    areas: areas.slice(0, limit),
  };
}

export function floodCells(
  period: FloodPeriod,
  bbox: [number, number, number, number],
  res: number,
  limit: number,
  ingestedAt: string | null,
): FloodCells {
  const [w, s, e, n] = bbox;
  const pad = PAD_DEG[res];
  const all = sample(period);
  const inView = all.filter((c) => c.lat >= s - pad && c.lat <= n + pad && c.lon >= w - pad && c.lon <= e + pad);
  const groups = new Map<string, SampleCell[]>();
  for (const c of inView) {
    const key = res >= getResolution(c.h3) ? c.h3 : cellToParent(c.h3, res);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const cells: FloodCell[] = [...groups.entries()].map(([h3, cs]) => {
    const km2 = cs.reduce((sum, c) => sum + c.area_km2, 0);
    const cell: FloodCell = {
      h3,
      cells: cs.length,
      area_km2: round(km2, 4),
      share: round(Math.min(km2 / cellArea(h3, "km2"), 1), 3),
      seen: WINDOWS.find((w) => cs.some((c) => c.seen === w)),
    };
    if (res === 9) {
      const c = cs[0];
      Object.assign(cell, {
        province: c.province,
        amphoe: c.amphoe,
        tambon: c.tambon,
        observed_at: toBangkokIso((ingestedAt ? Date.parse(ingestedAt) : Date.now()) - c.ageHours * 3_600_000),
        buildings: c.buildings,
        population: c.population,
        schools: c.schools,
        hospitals: c.hospitals,
      });
    }
    return cell;
  });
  cells.sort((a, b) => b.area_km2 - a.area_km2 || a.h3.localeCompare(b.h3));
  return {
    ...layerInfo(period, ingestedAt, all),
    res,
    truncated: cells.length > limit,
    cells: cells.slice(0, limit),
    windows: WINDOWS.slice(0, WINDOWS.indexOf(period) + 1).map((w) => layerInfo(w, ingestedAt, sample(w))),
  };
}

const NEAR_KM = 5;

/** Mirrors agent/gistda.check_flood_extent for one period: own cell flooded, nearest flooded cell, area within 5 km. */
export function floodNear(period: FloodPeriod, lat: number, lon: number, ingestedAt: string | null): FloodNear {
  const all = sample(period);
  const near = all.map((c) => ({ c, d: haversineKm(lat, lon, c.lat, c.lon) })).filter((x) => x.d <= NEAR_KM);
  const here = latLngToCell(lat, lon, 9);
  return {
    ...layerInfo(period, ingestedAt, all),
    at_point: near.some((x) => x.c.h3 === here),
    nearest_km: near.length ? round(Math.min(...near.map((x) => x.d)), 1) : null,
    radius_km: NEAR_KM,
    nearby: { cells: near.length, ...area(near.reduce((s, x) => s + x.c.area_km2, 0)) },
  };
}

// --- flood history (a SAMPLE in the shape of /api/flood/history; real codes and names, made-up years and rai) ---

const AYU = "พระนครศรีอยุธยา";
const HISTORY_YEARS = Array.from({ length: 14 }, (_, i) => 2011 + i);
// [tb code, amphoe, tambon, years flooded, rai in the worst year]
const HISTORY_SAMPLE: [string, string, string, number[], number][] = [
  ["140501", "บางบาล", "บางบาล", [2011, 2012, 2013, 2017, 2021, 2022, 2023, 2024], 3300],
  ["140516", "บางบาล", "บ้านกุ่ม", [2011, 2017, 2022, 2024], 5200],
  ["140513", "บางบาล", "บางหลวงโดด", [2011, 2013, 2017, 2022, 2024], 2800],
  ["140504", "บางบาล", "สะพานไทย", [2011, 2017, 2024], 1900],
  ["140502", "บางบาล", "วัดยม", [2011, 2013, 2017, 2021, 2022, 2024], 4100],
  ["140414", "บางไทร", "ไผ่พระ", [2011, 2013, 2017, 2022], 6100],
  ["141202", "เสนา", "บ้านแพน", [2011, 2024], 2400],
  ["140103", "พระนครศรีอยุธยา", "หอรัตนไชย", [2011, 2022], 300],
];

function historyArea([code, amphoe, tambon, years, worst]: (typeof HISTORY_SAMPLE)[number]): FloodHistoryArea {
  // 2011 the worst year everywhere, the rest smaller: enough to tell the years apart on the map.
  const rai_by_year = Object.fromEntries(years.map((y) => [String(y), y === 2011 ? worst : Math.round(worst * 0.4)]));
  return { code, province: AYU, amphoe, tambon, years, rai_by_year };
}

export function floodHistory(level: "province" | "tambon", province: string | null): FloodHistory {
  const tambons = HISTORY_SAMPLE.map(historyArea);
  const base = { level, province, years: HISTORY_YEARS, provinces: ["14"] };
  if (level === "tambon") return { ...base, areas: province === "14" ? tambons : [] };
  const rai: Record<string, number> = {};
  for (const t of tambons) for (const [y, r] of Object.entries(t.rai_by_year)) rai[y] = (rai[y] ?? 0) + r;
  const years = [...new Set(tambons.flatMap((t) => t.years))].sort();
  return { ...base, areas: [{ code: "14", province: AYU, amphoe: null, tambon: null, years, rai_by_year: rai }] };
}

// --- one tambon's story (/api/flood/tambon): the sample's layers there, a made-up daily record, the history sample --

const DAY_MS = 86_400_000;
const RECORD_DAYS = 12;

/** Mirrors namma-backend api/flood.py flood_tambon. null = no source knows the code (the route answers 404). */
export function floodTambon(code: string, ingestedAt: string | null): FloodTambon | null {
  const hist = HISTORY_SAMPLE.find(([c]) => c === code);
  const copied = code.startsWith("14");
  const byWindow = WINDOWS.map((w) => ({ w, cells: sample(w).filter((c) => c.code === code) }));
  const any = byWindow.find((x) => x.cells.length)?.cells[0];
  if (!hist && !copied && !any) return null;
  const windows = byWindow.map(({ w, cells }) => ({
    ...layerInfo(w, ingestedAt, sample(w)),
    cells: cells.length,
    ...area(cells.reduce((s, c) => s + c.area_km2, 0)),
    buildings: cells.length ? cells.reduce((s, c) => s + c.buildings, 0) : null,
    population: cells.length ? cells.reduce((s, c) => s + c.population, 0) : null,
  }));
  const lastSeen = windows.find((w) => w.cells > 0)?.period ?? null;
  // A made-up record of the 7-day layer: rising to today where water is seen now, peaking a few days ago where it
  // was seen this week, gone where it was seen only weeks ago.
  const week = windows[1].area_km2 || windows[2].area_km2;
  const peakAt = lastSeen === "3days" ? RECORD_DAYS - 1 : lastSeen === "7days" ? RECORD_DAYS - 5 : 2;
  const today = Math.floor((ingestedAt ? Date.parse(ingestedAt) : Date.now()) / DAY_MS) * DAY_MS;
  const record = lastSeen
    ? Array.from({ length: RECORD_DAYS }, (_, i) => {
        const km2 = week * Math.max(0, 1 - Math.abs(i - peakAt) / 6);
        return { day: new Date(today - (RECORD_DAYS - 1 - i) * DAY_MS).toISOString().slice(0, 10), period: "7days" as const,
                 cells: Math.round(km2 / 0.1), ...area(km2) };
      }).filter((r) => r.cells > 0)
    : [];
  const h = hist ? historyArea(hist) : null;
  return {
    code,
    province: any?.province ?? (hist ? AYU : null),
    amphoe: any?.amphoe ?? hist?.[1] ?? null,
    tambon: any?.tambon ?? hist?.[2] ?? null,
    windows,
    last_seen: lastSeen,
    record,
    history: copied ? { years_covered: HISTORY_YEARS, years: h?.years ?? [], rai_by_year: h?.rai_by_year ?? {} } : null,
    source: "GISTDA",
  };
}
