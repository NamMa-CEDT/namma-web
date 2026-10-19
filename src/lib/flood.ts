// Flood tab helpers: how flooded an area is (its shade and words) and how areas are named.
// Every number shown comes from /api/flood (GISTDA's cells); nothing here estimates.
import type { FloodArea, FloodLevel } from "../api/types";

export type FloodClass = "many" | "some" | "none";

/** From about a quarter of the area under water, it is "ท่วมมาก". */
export const MANY_SHARE = 0.25;

/** The shade an area gets: flooded share of its whole area → ท่วมมาก / ท่วมบางส่วน / ไม่พบน้ำ. */
export function floodClass(share: number): FloodClass {
  return share >= MANY_SHARE ? "many" : share > 0 ? "some" : "none";
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
