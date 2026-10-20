import type { ChatPlace } from "../api/types";

/** A place to open the flood map on: a chat answer's point, carried in the /flood URL. */
export type FloodFocus = ChatPlace;

/** /flood?lat=…&lon=…&place=…: the flood map flown to that point, with the place pinned. `approx` adds &approx=1. */
export function floodMapLink(p: FloodFocus): string {
  const q = new URLSearchParams({ lat: p.lat.toFixed(5), lon: p.lon.toFixed(5), place: p.label });
  if (p.approx) q.set("approx", "1");
  return `/flood?${q}`;
}

/** The point in a /flood URL, or null when there is none or it is not a real coordinate. */
export function readFloodFocus(params: URLSearchParams): FloodFocus | null {
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (!params.has("lat") || !params.has("lon") || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, label: params.get("place") ?? "", approx: params.get("approx") === "1" };
}
