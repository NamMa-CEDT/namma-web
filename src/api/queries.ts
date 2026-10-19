import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProvinces, fetchTambons } from "../lib/boundaries";
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
  provinceShapes: ["shapes", "provinces"] as const,
  tambonShapes: (provinceCode: string) => ["shapes", "tambons", provinceCode] as const,
  floodNear: (period: FloodPeriod, lat: number, lon: number) => ["flood-near", period, lat, lon] as const,
  floodHistory: (level: "province" | "tambon", province: string | null) => ["flood-history", level, province] as const,
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

/** Flooded area per tambon in each of these provinces (the tambons the map shades). */
export function useFloodTambons(period: FloodPeriod, provinces: string[]) {
  return useQueries({
    queries: provinces.map((province) => ({
      queryKey: keys.floodAreas(period, "tambon", province, null),
      queryFn: () => api.floodAreas({ period, level: "tambon", province, limit: 1000 }),
      refetchInterval: FLOOD_REFRESH_MS,
    })),
  });
}

// The history changes only when another province is copied: an hour is plenty.
const HISTORY_STALE_MS = 60 * 60_000;

/** Flood history 2011– per province (the history layer zoomed out, and its ranking). */
export function useFloodHistory(enabled: boolean) {
  return useQuery({
    queryKey: keys.floodHistory("province", null),
    queryFn: () => api.floodHistory({ level: "province" }),
    staleTime: HISTORY_STALE_MS,
    enabled,
  });
}

/** Flood history per tambon in each of these provinces (by code), for the history layer zoomed in. */
export function useFloodHistoryTambons(provinceCodes: string[], enabled: boolean) {
  return useQueries({
    queries: provinceCodes.map((province) => ({
      queryKey: keys.floodHistory("tambon", province),
      queryFn: () => api.floodHistory({ level: "tambon", province }),
      staleTime: HISTORY_STALE_MS,
      enabled,
    })),
  });
}

/** Province outlines (static files: fetched once). */
export function useProvinceShapes() {
  return useQuery({ queryKey: keys.provinceShapes, queryFn: fetchProvinces, staleTime: Infinity, gcTime: Infinity });
}

/** Tambon outlines of each of these provinces, by RTSD province code. */
export function useTambonShapes(provinceCodes: string[]) {
  return useQueries({
    queries: provinceCodes.map((code) => ({
      queryKey: keys.tambonShapes(code),
      queryFn: () => fetchTambons(code),
      staleTime: Infinity,
      gcTime: Infinity,
    })),
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
