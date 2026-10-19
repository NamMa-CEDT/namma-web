import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { FactKind, FloodLevel, FloodPeriod, Profile } from "./types";

// ThaiWater updates every 10 min (HII) / hourly (RID); no need to poll faster than a minute.
const STATION_REFRESH_MS = 60_000;
// GISTDA publishes a few layers a day and the backend checks every 3 h.
const FLOOD_REFRESH_MS = 10 * 60_000;

export const keys = {
  stations: ["stations"] as const,
  station: (id: number) => ["station", id] as const,
  readings: (id: number, hours: number) => ["readings", id, hours] as const,
  nearest: (lat: number, lon: number, k: number) => ["nearest", lat, lon, k] as const,
  shelters: (lat: number | null, lon: number | null, patients: boolean) => ["shelters", lat, lon, patients] as const,
  profile: (chatSession: string) => ["profile", chatSession] as const,
  floodAreas: (period: FloodPeriod, level: FloodLevel, province: string | null, amphoe: string | null) =>
    ["flood-areas", period, level, province, amphoe] as const,
  floodCells: (period: FloodPeriod, bbox: string, res: number) => ["flood-cells", period, bbox, res] as const,
  floodNear: (period: FloodPeriod, lat: number, lon: number) => ["flood-near", period, lat, lon] as const,
};

/** Flooded area per province, or per amphoe / tambon inside one (drill-down in the flood tab). */
export function useFloodAreas(period: FloodPeriod, province: string | null = null, amphoe: string | null = null) {
  const level: FloodLevel = amphoe ? "tambon" : province ? "amphoe" : "province";
  return useQuery({
    queryKey: keys.floodAreas(period, level, province, amphoe),
    queryFn: () => api.floodAreas({ period, level, province: province ?? undefined, amphoe: amphoe ?? undefined }),
    refetchInterval: FLOOD_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

/** The flooded cells in the map's view. Keeps the last cells on screen while the next view loads. */
export function useFloodCells(period: FloodPeriod, view: { bbox: string; res: number } | null) {
  return useQuery({
    queryKey: keys.floodCells(period, view?.bbox ?? "", view?.res ?? 0),
    queryFn: () => api.floodCells({ period, bbox: view!.bbox, res: view!.res }),
    enabled: view != null,
    refetchInterval: FLOOD_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

/** Flooding around a saved place (the flood tab's place banner). */
export function useFloodNear(period: FloodPeriod, point: { lat: number; lon: number } | null) {
  return useQuery({
    queryKey: keys.floodNear(period, point?.lat ?? 0, point?.lon ?? 0),
    queryFn: () => api.floodNear({ period, lat: point!.lat, lon: point!.lon }),
    enabled: point != null,
    refetchInterval: FLOOD_REFRESH_MS,
  });
}

export function useStations() {
  return useQuery({ queryKey: keys.stations, queryFn: api.stations, refetchInterval: STATION_REFRESH_MS });
}

export function useStation(id: number | null) {
  return useQuery({
    queryKey: keys.station(id ?? -1),
    queryFn: () => api.station(id!),
    enabled: id != null,
    refetchInterval: STATION_REFRESH_MS,
  });
}

export function useReadings(id: number | null, hours = 72) {
  return useQuery({
    queryKey: keys.readings(id ?? -1, hours),
    queryFn: () => api.readings(id!, hours),
    enabled: id != null,
    refetchInterval: STATION_REFRESH_MS * 5,
  });
}

export function useNearest(point: { lat: number; lon: number } | null, k = 3) {
  return useQuery({
    queryKey: keys.nearest(point?.lat ?? 0, point?.lon ?? 0, k),
    queryFn: () => api.nearestStations(point!.lat, point!.lon, k),
    enabled: point != null,
  });
}

export function useShelters(point: { lat: number; lon: number } | null, patients = false) {
  return useQuery({
    queryKey: keys.shelters(point?.lat ?? null, point?.lon ?? null, patients),
    queryFn: () => api.shelters({ lat: point?.lat, lon: point?.lon, patients }),
    enabled: point != null,
  });
}

/** What NamMa remembers for this chat (ProfilePanel). Refetched after every chat turn by the chat page. */
export function useProfile(chatSession: string) {
  return useQuery({ queryKey: keys.profile(chatSession), queryFn: () => api.profile(chatSession) });
}

export function useDeleteFromProfile(chatSession: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (what: { place: number } | { facts: FactKind | "all" }) =>
      "place" in what ? api.deletePlace(chatSession, what.place) : api.deleteFacts(chatSession, what.facts),
    onSuccess: (profile: Profile) => qc.setQueryData(keys.profile(chatSession), profile),
  });
}
