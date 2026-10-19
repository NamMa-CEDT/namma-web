// Flood tab in mock mode: a SAMPLE layer made up around the corridor's flood-prone reaches, so the tab can be built
// and rehearsed without a GISTDA key. It is not GISTDA data, and the page says so whenever the mock is on.
// The queries mirror namma-backend api/flood.py: sums of res-9 cells, parents for zoomed-out views, largest first.
import { cellArea, cellToParent, getResolution, gridDisk, gridDistance, latLngToCell, cellToLatLng } from "h3-js";
import type { FloodArea, FloodAreas, FloodCell, FloodCells, FloodLevel, FloodPeriod } from "../types";
import { toBangkokIso } from "./geo";

interface SampleCell {
  h3: string;
  lat: number;
  lon: number;
  area_km2: number;
  province: string;
  amphoe: string;
  tambon: string;
  /** Hours before "now" GISTDA would have dated it. */
  ageHours: number;
}

// [lat, lon, rings in the 3-day layer, province, amphoe, tambon]: low ground along the Chao Phraya and the Noi.
// Real names (nearest tambon in namma-backend data/gazetteer.csv); the flooding around them is made up.
const SEEDS: [number, number, number, string, string, string][] = [
  [14.415, 100.44, 7, "พระนครศรีอยุธยา", "บางบาล", "บางหลวงโดด"],
  [14.37, 100.49, 5, "พระนครศรีอยุธยา", "บางบาล", "สะพานไทย"],
  [14.31, 100.56, 5, "พระนครศรีอยุธยา", "บางปะอิน", "ขนอนหลวง"],
  [14.6, 100.43, 4, "อ่างทอง", "เมืองอ่างทอง", "ตลาดหลวง"],
  [14.88, 100.38, 3, "สิงห์บุรี", "เมืองสิงห์บุรี", "บางพุทรา"],
  [15.13, 100.22, 3, "ชัยนาท", "สรรพยา", "สรรพยา"],
];
const EXTRA_RINGS_7DAYS = 3;
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
  for (const [lat, lon, rings, province, amphoe, tambon] of SEEDS) {
    const centre = latLngToCell(lat, lon, 9);
    for (const h3 of gridDisk(centre, rings + EXTRA_RINGS_7DAYS)) {
      // Ragged edges: the farther out, the fewer cells. Same noise for both, so 7 days is a superset of 3 days.
      const dist = gridDistance(centre, h3);
      const r = noise(`${h3}:in`);
      const within = (k: number) => dist <= k && r <= 1 - 0.9 * (dist / (k + 1)) ** 2;
      const in3 = within(rings);
      if (byCell.has(h3) || !(period === "3days" ? in3 : within(rings + EXTRA_RINGS_7DAYS))) continue;
      const [cLat, cLon] = cellToLatLng(h3);
      byCell.set(h3, {
        h3,
        lat: cLat,
        lon: cLon,
        area_km2: cellArea(h3, "km2") * (0.35 + 0.65 * noise(`${h3}:area`)),
        province,
        amphoe,
        tambon,
        ageHours: in3 ? 12 + 48 * noise(`${h3}:t`) : 72 + 96 * noise(`${h3}:t`),
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
      code: null,
      cells: cs.length,
      ...area(km2),
      lat: round(cs.reduce((s, c) => s + c.lat * c.area_km2, 0) / km2, 5),
      lon: round(cs.reduce((s, c) => s + c.lon * c.area_km2, 0) / km2, 5),
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
    const cell: FloodCell = { h3, cells: cs.length, area_km2: round(km2, 4), share: round(Math.min(km2 / cellArea(h3, "km2"), 1), 3) };
    if (res === 9) {
      const c = cs[0];
      Object.assign(cell, {
        province: c.province,
        amphoe: c.amphoe,
        tambon: c.tambon,
        observed_at: toBangkokIso((ingestedAt ? Date.parse(ingestedAt) : Date.now()) - c.ageHours * 3_600_000),
      });
    }
    return cell;
  });
  cells.sort((a, b) => b.area_km2 - a.area_km2 || a.h3.localeCompare(b.h3));
  return { ...layerInfo(period, ingestedAt, all), res, truncated: cells.length > limit, cells: cells.slice(0, limit) };
}
