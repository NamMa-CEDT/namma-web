export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const BKK_OFFSET_MS = 7 * 3600_000;

/** "2026-10-16T14:20:00+07:00", the shape the backend is expected to send. */
export function toBangkokIso(ms: number): string {
  return new Date(ms + BKK_OFFSET_MS).toISOString().replace(/\.\d{3}Z$/, "+07:00");
}

const TEN_MIN = 10 * 60_000;
const FRESHNESS = 7 * 60_000;

/**
 * Fixtures are a snapshot. Shift every timestamp by a whole number of 10-minute steps so the
 * newest reading looks ~7–17 minutes old whenever the demo runs. Values are untouched.
 */
export function timeShiftMs(ingestedAt: string | null, now = Date.now()): number {
  if (!ingestedAt) return 0;
  const raw = now - FRESHNESS - Date.parse(ingestedAt);
  return raw > 0 ? Math.floor(raw / TEN_MIN) * TEN_MIN : 0;
}

export function shiftIso(iso: string, offsetMs: number): string {
  return toBangkokIso(Date.parse(iso) + offsetMs);
}
