// Close-up flood map (design "3 · ซูมใกล้"): GISTDA's res-9 cells merged into smooth patches of water, so people see
// where the water is instead of a field of hexagons. A patch = cells that touch; its outline comes from h3-js
// (cellsToMultiPolygon) and is rounded with Chaikin's corner cutting. Its numbers are sums of its cells.
import { cellToLatLng, cellsToMultiPolygon, gridDisk, latLngToCell } from "h3-js";
import type { FloodCell, FloodPeriod } from "../api/types";
import { PERIODS } from "./flood";

const RAI_PER_KM2 = 625;

export interface WaterPatch {
  /** Its largest cell's id: stable while the same water is in view. */
  id: string;
  cells: FloodCell[];
  /** GeoJSON MultiPolygon coordinates ([lon, lat]), smoothed. */
  polygons: number[][][][];
  area_km2: number;
  area_rai: number;
  /** null when no cell carried the count (unknown, not 0). */
  buildings: number | null;
  population: number | null;
  /** Where most of its flooded area is. */
  province: string | null;
  amphoe: string | null;
  tambon: string | null;
  /** Newest image date among its cells. */
  observed_at: string | null;
  /** How lately water was seen in it: its freshest cell's `seen`; null when the backend sends none. */
  seen: FloodPeriod | null;
}

/** One Chaikin pass per iteration over a closed GeoJSON ring (first point repeated last). */
export function smoothRing(ring: number[][], iterations = 2): number[][] {
  let pts = ring.slice(0, -1);
  if (pts.length < 3) return ring;
  for (let it = 0; it < iterations; it++) {
    const out: number[][] = [];
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i];
      const [qx, qy] = pts[(i + 1) % pts.length];
      out.push([0.75 * px + 0.25 * qx, 0.75 * py + 0.25 * qy], [0.25 * px + 0.75 * qx, 0.25 * py + 0.75 * qy]);
    }
    pts = out;
  }
  return [...pts, pts[0]];
}

/** Cells that touch (share an edge) → one group each. */
function components(cells: FloodCell[]): FloodCell[][] {
  const byId = new Map(cells.map((c) => [c.h3, c]));
  const seen = new Set<string>();
  const groups: FloodCell[][] = [];
  for (const c of cells) {
    if (seen.has(c.h3)) continue;
    const group: FloodCell[] = [];
    const queue = [c.h3];
    seen.add(c.h3);
    while (queue.length) {
      const id = queue.pop()!;
      group.push(byId.get(id)!);
      for (const n of gridDisk(id, 1)) {
        if (!seen.has(n) && byId.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

function sumOrNull(cells: FloodCell[], key: "buildings" | "population"): number | null {
  const known = cells.filter((c) => c[key] != null);
  return known.length ? known.reduce((s, c) => s + c[key]!, 0) : null;
}

/** The place most of the patch's flooded area lies in. */
function dominant(cells: FloodCell[]): Pick<WaterPatch, "province" | "amphoe" | "tambon"> {
  const byPlace = new Map<string, { km2: number; c: FloodCell }>();
  for (const c of cells) {
    const key = `${c.province}|${c.amphoe}|${c.tambon}`;
    const hit = byPlace.get(key);
    if (hit) hit.km2 += c.area_km2;
    else byPlace.set(key, { km2: c.area_km2, c });
  }
  const top = [...byPlace.values()].sort((a, b) => b.km2 - a.km2)[0]?.c;
  return { province: top?.province ?? null, amphoe: top?.amphoe ?? null, tambon: top?.tambon ?? null };
}

/** GISTDA's res-9 cells in view → patches of water, largest first. Water seen only weeks ago (seen "30days") never
 * joins a patch of recent water: the 30-day map draws the two differently. */
export function waterPatches(cells: FloodCell[]): WaterPatch[] {
  const earlier = (c: FloodCell) => c.seen === "30days";
  return [...components(cells.filter((c) => !earlier(c))), ...components(cells.filter(earlier))]
    .map((group) => {
      const largest = group.reduce((a, b) => (b.area_km2 > a.area_km2 ? b : a));
      const polygons = cellsToMultiPolygon(
        group.map((c) => c.h3),
        true,
      ).map((poly) => poly.map((ring) => smoothRing(ring)));
      const km2 = group.reduce((s, c) => s + c.area_km2, 0);
      const dates = group.map((c) => c.observed_at).filter((d): d is string => !!d);
      return {
        id: largest.h3,
        cells: group,
        polygons,
        area_km2: km2,
        area_rai: km2 * RAI_PER_KM2,
        buildings: sumOrNull(group, "buildings"),
        population: sumOrNull(group, "population"),
        ...dominant(group),
        observed_at: dates.length ? dates.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : null,
        seen: PERIODS.find((p) => group.some((c) => c.seen === p)) ?? null,
      };
    })
    .sort((a, b) => b.area_km2 - a.area_km2);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// Half a res-9 cell: from a cell's centre to its edge.
const CELL_RADIUS_KM = 0.17;

/** How far a point is from the water: 0 inside a flooded cell, else to the nearest cell's edge (approximately). */
export function distanceToWaterKm(cells: FloodCell[], lat: number, lon: number): number | null {
  if (!cells.length) return null;
  const here = latLngToCell(lat, lon, 9);
  if (cells.some((c) => c.h3 === here)) return 0;
  let best = Infinity;
  for (const c of cells) {
    const [clat, clon] = cellToLatLng(c.h3);
    best = Math.min(best, haversineKm(lat, lon, clat, clon));
  }
  return Math.max(0, best - CELL_RADIUS_KM);
}

/** Viewport box for /api/flood/cells, widened to a 0.01° grid so small pans ask for the same box (and hit the cache). */
export function viewBox([w, s, e, n]: [number, number, number, number], step = 0.01): string {
  const down = (v: number) => Math.floor(v / step) * step;
  const up = (v: number) => Math.ceil(v / step) * step;
  return [down(w), down(s), up(e), up(n)].map((v) => Number(v.toFixed(3))).join(",");
}
