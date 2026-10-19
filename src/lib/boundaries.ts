// Province and tambon outlines for the flood map (DS option C: each area shaded by how much of it is flooded).
// Built by scripts/build_boundaries.py from the Royal Thai Survey Department's boundaries (OCHA HDX, CC BY-IGO)
// into public/boundaries: provinces.json, and tambons/<province code>.json loaded per province as the map needs it.
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { FloodArea } from "../api/types";

export interface AreaProps {
  /** RTSD code without "TH": province "14", tambon "140504" (GISTDA's pv_idn / tb_idn). */
  code: string;
  province: string;
  amphoe: string | null;
  tambon: string | null;
  /** Whole area of the province / tambon. */
  area_km2: number;
  /** [lat, lon] inside the shape, for its label. */
  label: [number, number];
  /** Provinces only: [west, south, east, north]. */
  bbox?: [number, number, number, number];
}

export type AreaShape = Feature<Polygon | MultiPolygon, AreaProps>;
export type AreaShapes = FeatureCollection<Polygon | MultiPolygon, AreaProps>;

const BASE = `${import.meta.env.BASE_URL}boundaries`;

async function getJson(url: string): Promise<AreaShapes> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as AreaShapes;
}

export const fetchProvinces = () => getJson(`${BASE}/provinces.json`);
export const fetchTambons = (provinceCode: string) => getJson(`${BASE}/tambons/${provinceCode}.json`);

/** Names compare without จ./อ./ต. prefixes, "อำเภอ…" spellings or spaces. */
export function nameKey(...parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => (p ?? "").replace(/^(จังหวัด|อำเภอ|ตำบล|เขต|แขวง|จ\.|อ\.|ต\.)\s*/, "").replace(/\s+/g, ""))
    .join("|");
}

/**
 * GISTDA's totals per area → the shape each belongs to, keyed by shape code. By code when GISTDA sent one, else by
 * name (province, + amphoe and tambon for tambons): GISTDA names tambons the way the RTSD does, give or take a prefix.
 */
export function joinAreas(shapes: AreaShape[], rows: FloodArea[], level: "province" | "tambon"): Map<string, FloodArea> {
  const byCode = new Map<string, FloodArea>();
  const byName = new Map<string, FloodArea>();
  for (const r of rows) {
    if (r.code) byCode.set(r.code, r);
    byName.set(level === "province" ? nameKey(r.province) : nameKey(r.province, r.amphoe, r.tambon), r);
  }
  const out = new Map<string, FloodArea>();
  for (const s of shapes) {
    const p = s.properties;
    const hit =
      byCode.get(p.code) ?? byName.get(level === "province" ? nameKey(p.province) : nameKey(p.province, p.amphoe, p.tambon));
    if (hit) out.set(p.code, hit);
  }
  return out;
}

/** Provinces whose box overlaps the view, nearest the view's centre first. */
export function provincesInView(provinces: AreaShape[], view: [number, number, number, number], max: number): AreaShape[] {
  const [w, s, e, n] = view;
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;
  return provinces
    .filter((p) => {
      const b = p.properties.bbox;
      return b != null && b[0] <= e && b[2] >= w && b[1] <= n && b[3] >= s;
    })
    .map((p) => ({ p, d: Math.hypot(p.properties.label[1] - cx, p.properties.label[0] - cy) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map((x) => x.p);
}

function inRing(lat: number, lon: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Is the point inside the shape (holes respected)? For "บ้านแม่อยู่ตำบลนี้". */
export function containsPoint(shape: AreaShape, lat: number, lon: number): boolean {
  const g = shape.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some((rings) => inRing(lat, lon, rings[0]) && !rings.slice(1).some((hole) => inRing(lat, lon, hole)));
}
