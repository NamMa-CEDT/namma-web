// Flood tab helpers: which H3 resolution to ask for at a zoom, the view box to ask about, and area wording.
// Every number shown comes from /api/flood (GISTDA's cells); nothing here estimates.
import type { FloodArea, FloodLevel } from "../api/types";

/**
 * The finest H3 resolution whose cells are still at least ~5 px across at this zoom (latitude ~14°), so a
 * zoomed-out map asks for a few hundred parent cells instead of 100k of GISTDA's res-9 cells.
 * Edge lengths: res 5 8.5 km, 6 3.2 km, 7 1.2 km, 8 0.46 km, 9 0.17 km.
 */
export function resForZoom(zoom: number): number {
  if (zoom <= 7) return 5;
  if (zoom <= 9) return 6;
  if (zoom <= 10) return 7;
  if (zoom <= 12) return 8;
  return 9;
}

// Coarser grids for coarser cells: small pans then ask for the same box and hit the cache.
const SNAP_DEG: Record<number, number> = { 5: 0.5, 6: 0.2, 7: 0.05, 8: 0.02, 9: 0.01 };

/** "minLon,minLat,maxLon,maxLat", widened outwards to a grid that depends on the resolution. */
export function viewBox(west: number, south: number, east: number, north: number, res: number): string {
  const step = SNAP_DEG[res] ?? 0.01;
  const down = (v: number) => Math.floor(v / step) * step;
  const up = (v: number) => Math.ceil(v / step) * step;
  const clamp = (v: number, lim: number) => Math.min(lim, Math.max(-lim, v));
  const parts = [clamp(down(west), 180), clamp(down(south), 85), clamp(up(east), 180), clamp(up(north), 85)];
  return parts.map((v) => Number(v.toFixed(3))).join(",");
}

/**
 * Fill opacity of a cell: even a sliver of flooding shows on satellite imagery, a full cell is clearly stronger.
 * Square root, because a zoomed-out parent cell is rarely more than a third flooded.
 */
export function cellOpacity(share: number): number {
  return 0.35 + 0.5 * Math.sqrt(Math.min(1, Math.max(0, share)));
}

/** "12,345 ไร่" (rai is how Thai flood reports state area). */
export function formatRai(rai: number): string {
  return `${Math.round(rai).toLocaleString("en-US")} ไร่`;
}

/** "12.3 ตร.กม." / "0.42 ตร.กม.". */
export function formatKm2(km2: number): string {
  const digits = km2 < 10 ? 2 : 1;
  return `${km2.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ตร.กม.`;
}

const isBangkok = (province: string | null | undefined) => province === "กรุงเทพมหานคร" || province === "กรุงเทพฯ";

/** The row's own name at its level: "จ.อ่างทอง", "อ.บางบาล", "ต.บ้านกุ่ม" (Bangkok: เขต / แขวง). */
export function areaName(a: Pick<FloodArea, "province" | "amphoe" | "tambon" | "code">, level: FloodLevel): string {
  const bkk = isBangkok(a.province);
  const name = level === "province" ? a.province : level === "amphoe" ? a.amphoe : a.tambon;
  if (!name) return a.code ? `รหัสพื้นที่ ${a.code}` : `ไม่ระบุ${{ province: "จังหวัด", amphoe: "อำเภอ", tambon: "ตำบล" }[level]}`;
  if (level === "province") return bkk ? name : `จ.${name}`;
  if (level === "amphoe") return `${bkk ? "เขต" : "อ."}${name}`;
  return `${bkk ? "แขวง" : "ต."}${name}`;
}

/** Where a res-9 cell is, most specific first: "ต.บ้านกุ่ม อ.บางบาล จ.พระนครศรีอยุธยา". */
export function cellPlace(c: { province?: string | null; amphoe?: string | null; tambon?: string | null }): string {
  const bkk = isBangkok(c.province);
  return [
    c.tambon && `${bkk ? "แขวง" : "ต."}${c.tambon}`,
    c.amphoe && `${bkk ? "เขต" : "อ."}${c.amphoe}`,
    c.province && (bkk ? c.province : `จ.${c.province}`),
  ]
    .filter(Boolean)
    .join(" ");
}
