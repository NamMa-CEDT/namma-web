// Formatting for numbers that come from the API. Nothing here invents a value:
// null in → "ไม่ทราบ" (or null) out.

import { copy } from "../copy";

const TZ = "Asia/Bangkok";

const timeFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dayFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
});

// Buddhist-era year, two digits ("69"): during a flood that lasts days, a reading needs its date.
const yearFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: TZ, year: "numeric" });

function fixed(n: number, digits: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Signed metres to bank → "ล้นตลิ่ง 0.15 ม." / "ต่ำกว่าตลิ่ง 0.42 ม.". */
export function formatBankGap(diff: number | null | undefined): string {
  if (diff == null || Number.isNaN(diff)) return copy.unknown;
  if (Math.abs(diff) < 0.005) return "ถึงระดับตลิ่ง";
  return diff > 0 ? `ล้นตลิ่ง ${fixed(diff, 2)} ม.` : `ต่ำกว่าตลิ่ง ${fixed(-diff, 2)} ม.`;
}

export type TrendDirection = "up" | "down" | "flat" | "unknown";

export function trendDirection(cmPerHr: number | null | undefined): TrendDirection {
  if (cmPerHr == null || Number.isNaN(cmPerHr)) return "unknown";
  if (Math.abs(cmPerHr) < 0.5) return "flat";
  return cmPerHr > 0 ? "up" : "down";
}

/** cm/hr → "สูงขึ้น 2.5 ซม./ชม." / "ลดลง 1.0 ซม./ชม." / "ทรงตัว" (words, never a sign). */
export function formatTrend(cmPerHr: number | null | undefined): string {
  const dir = trendDirection(cmPerHr);
  if (dir === "unknown") return copy.unknown;
  if (dir === "flat") return "ทรงตัว";
  const v = fixed(Math.abs(cmPerHr as number), 1);
  return dir === "up" ? `สูงขึ้น ${v} ซม./ชม.` : `ลดลง ${v} ซม./ชม.`;
}

/** Hours until bank at the current trend. Null when not applicable. */
export function formatHoursToBank(hours: number | null | undefined): string | null {
  if (hours == null || Number.isNaN(hours) || hours < 0) return null;
  if (hours < 1) return "ไม่ถึง 1 ชม.";
  if (hours > 72) return "มากกว่า 3 วัน";
  return `ประมาณ ${Math.round(hours)} ชม.`;
}

export function formatLevel(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return copy.unknown;
  return `${fixed(m, 2)} ${copy.station.msl}`;
}

export function formatDischarge(m3s: number | null | undefined): string | null {
  if (m3s == null || Number.isNaN(m3s)) return null;
  return `${Math.round(m3s).toLocaleString("en-US")} ลบ.ม./วินาที`;
}

export function formatDistance(km: number | null | undefined): string | null {
  if (km == null || Number.isNaN(km)) return null;
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} ม.`;
  return `${fixed(km, km < 10 ? 1 : 0)} กม.`;
}

/** "14:20 น." in Bangkok time. */
export function formatTime(ts: string | null | undefined): string {
  if (!ts) return copy.unknown;
  return `${timeFmt.format(new Date(ts))} น.`;
}

/** "14:20 น. 16 ต.ค. 69" in Bangkok time, Buddhist-era year (design system: every reading has a date). */
export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return copy.unknown;
  const d = new Date(ts);
  const year = yearFmt.format(d).replace(/\D/g, "").slice(-2);
  return `${timeFmt.format(d)} น. ${dayFmt.format(d)} ${year}`;
}

/** "14 ต.ค. 69": a date with its Buddhist-era year, no time (consent dates). */
export function formatDate(ts: string | null | undefined): string {
  if (!ts) return copy.unknown;
  const d = new Date(ts);
  return `${dayFmt.format(d)} ${yearFmt.format(d).replace(/\D/g, "").slice(-2)}`;
}

/** The Thai way: "อ.บางบาล จ.พระนครศรีอยุธยา" (Bangkok has เขต and no จ.). */
export function formatPlace(amphoe: string | null | undefined, province: string | null | undefined): string {
  const bkk = province === "กรุงเทพมหานคร" || province === "กรุงเทพฯ";
  return [amphoe && `${bkk ? "เขต" : "อ."}${amphoe}`, province && (bkk ? province : `จ.${province}`)]
    .filter(Boolean)
    .join(" ");
}

/** "5 นาทีที่แล้ว" / "2 ชม.ที่แล้ว" / "3 วันที่แล้ว". */
export function formatAge(ts: string | null | undefined, now: number = Date.now()): string {
  if (!ts) return copy.unknown;
  const mins = Math.max(0, Math.round((now - new Date(ts).getTime()) / 60_000));
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} ชม.ที่แล้ว`;
  return `${Math.floor(hours / 24)} วันที่แล้ว`;
}

/** HII stations report every 10 min; RID and others hourly (CLAUDE.md §4). */
export function staleAfterMinutes(agency: string | null | undefined): number {
  return agency === "HII" ? 30 : 120;
}

export function isStale(ts: string | null | undefined, agency: string | null | undefined, now = Date.now()): boolean {
  if (!ts) return true;
  return now - new Date(ts).getTime() > staleAfterMinutes(agency) * 60_000;
}
