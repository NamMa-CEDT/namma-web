// Flood tab helpers: how flooded an area is (its shade and words) and how areas are named.
// Every number shown comes from /api/flood (GISTDA's cells); nothing here estimates.
import type { FloodArea, FloodHistoryArea, FloodLevel } from "../api/types";

export type FloodClass = "many" | "some" | "none";

/** From about a quarter of the area under water, it is "ท่วมมาก". */
export const MANY_SHARE = 0.25;

/** The shade an area gets: flooded share of its whole area → ท่วมมาก / ท่วมบางส่วน / ไม่พบน้ำ. */
export function floodClass(share: number): FloodClass {
  return share >= MANY_SHARE ? "many" : share > 0 ? "some" : "none";
}

const RAI_PER_KM2 = 625;
/** History layer, all years: a tambon is ท่วมบ่อย from this many flooded years. */
export const OFTEN_YEARS = 5;

/** The worst year of an area's history and its rai; null when it never flooded. */
export function worstYear(h: Pick<FloodHistoryArea, "rai_by_year">): { year: number; rai: number } | null {
  let best: { year: number; rai: number } | null = null;
  for (const [y, rai] of Object.entries(h.rai_by_year)) if (!best || rai > best.rai) best = { year: Number(y), rai };
  return best;
}

/** Flooded share of an area (whole area areaKm2) in one year of its history. */
export function historyShare(h: Pick<FloodHistoryArea, "rai_by_year">, year: number, areaKm2: number): number {
  const rai = h.rai_by_year[String(year)] ?? 0;
  return areaKm2 > 0 ? Math.min(1, rai / RAI_PER_KM2 / areaKm2) : 0;
}

/**
 * An area's shade in the history layer. A chosen year: how much of it flooded that year (the same classes as the live
 * layer). All years: a tambon by how many years it flooded, a province by its worst year (a count of years says
 * little for a whole province: nearly every one flooded somewhere every year).
 */
export function historyClass(
  h: FloodHistoryArea | undefined,
  areaKm2: number,
  year: number | null,
  level: "province" | "tambon",
): FloodClass {
  if (!h) return "none";
  if (year != null) return floodClass(historyShare(h, year, areaKm2));
  if (level === "tambon") return h.years.length >= OFTEN_YEARS ? "many" : h.years.length > 0 ? "some" : "none";
  const worst = worstYear(h);
  return worst ? floodClass(historyShare(h, worst.year, areaKm2)) : "none";
}

// Fractions people say, largest first. A share falls to the nearest one below it ("about a third").
const FRACTIONS: [number, string][] = [
  [0.9, "เกือบทั้ง"],
  [0.7, "ราว 3 ใน 4 ของ"],
  [0.6, "ราว 2 ใน 3 ของ"],
  [0.45, "ราวครึ่ง"],
  [0.3, "ราว 1 ใน 3 ของ"],
  [0.22, "ราว 1 ใน 4 ของ"],
  [0.17, "ราว 1 ใน 5 ของ"],
  [0.08, "ราว 1 ใน 10 ของ"],
];

/** "ราวครึ่งตำบล", "ราว 1 ใน 3 ของจังหวัด", "ส่วนน้อยของตำบล": how much of the area, in words. */
export function shareWords(share: number, unit: "ตำบล" | "จังหวัด"): string {
  if (share <= 0) return "";
  const hit = FRACTIONS.find(([min]) => share >= min);
  return hit ? `${hit[1]}${unit}` : `ส่วนน้อยของ${unit}`;
}

/** "1,120": a whole count of GISTDA's (buildings, people). */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-US");
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

type Where = { province?: string | null; amphoe?: string | null; tambon?: string | null };

/** Where an area is, most specific first: ["ต.บ้านกุ่ม", "อ.บางบาล", "จ.พระนครศรีอยุธยา"]. */
export function placeParts(c: Where): string[] {
  const bkk = isBangkok(c.province);
  return [
    c.tambon && `${bkk ? "แขวง" : "ต."}${c.tambon}`,
    c.amphoe && `${bkk ? "เขต" : "อ."}${c.amphoe}`,
    c.province && (bkk ? c.province : `จ.${c.province}`),
  ].filter((x): x is string => Boolean(x));
}

/** "ต.บ้านกุ่ม อ.บางบาล จ.พระนครศรีอยุธยา". */
export function placeName(c: Where): string {
  return placeParts(c).join(" ");
}
