import type { River, StationSummary } from "../api/types";

/** One river drawn on the map: its stations joined upstream → downstream. Straight lines between gauges, not the
 * river's own course: they say which stations share a river and which way it flows. */
export interface RiverLine {
  key: string;
  name: string;
  ids: number[];
  points: [number, number][];
}

/**
 * Every river with two or more of the given stations on it. The stations' own river_key/river_order give the whole
 * network; rivers the page already has (the at-risk list, a picked river) fill in where a backend leaves them out.
 */
export function riverLines(stations: StationSummary[], rivers: River[]): RiverLine[] {
  const byId = new Map(stations.map((s) => [s.id, s]));
  const groups = new Map<string, { name: string; ids: number[] }>();

  const ordered = stations
    .filter((s) => s.river_key != null && s.river_order != null)
    .sort((a, b) => a.river_order! - b.river_order!);
  for (const s of ordered) {
    const g = groups.get(s.river_key!) ?? { name: s.river ?? s.river_key!, ids: [] };
    g.ids.push(s.id);
    groups.set(s.river_key!, g);
  }
  for (const r of rivers) {
    if (groups.has(r.key)) continue;
    groups.set(r.key, { name: r.name_th, ids: r.stations.map((s) => s.id).filter((id) => byId.has(id)) });
  }

  const out: RiverLine[] = [];
  for (const [key, g] of groups) {
    if (g.ids.length < 2) continue;
    out.push({ key, name: g.name, ids: g.ids, points: g.ids.map((id) => [byId.get(id)!.lat, byId.get(id)!.lon]) });
  }
  return out;
}
