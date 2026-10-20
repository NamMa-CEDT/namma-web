import { getToken } from "../auth/token";
import { setIngestedAt } from "./meta";
import type {
  ApiErrorBody,
  ChatRequest,
  ChatResponse,
  Envelope,
  FloodAreas,
  FloodCells,
  FloodHistory,
  FloodLevel,
  FloodNear,
  FloodTambon,
  FloodPeriod,
  LoginResponse,
  Provider,
  NearbyStation,
  PlaceFactKind,
  Profile,
  River,
  SessionUser,
  Shelter,
  StationDetail,
  StationReadings,
  StationSummary,
  FactKind,
  NameList,
} from "./types";

export type Transport = (req: Request) => Promise<Response>;

/** localStorage key of the mock store; main.tsx listens to it to sync tabs. */
export const MOCK_STORE_KEY = "namma.mock.v1";

export const API_MODE: "mock" | "http" = import.meta.env.VITE_API_MODE === "http" ? "http" : "mock";
const BASE = String(import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

let transport: Promise<Transport> | null = null;

function getTransport(): Promise<Transport> {
  if (!transport) {
    // Static check so the mock chunk is dropped from VITE_API_MODE=http builds.
    transport =
      import.meta.env.VITE_API_MODE === "http"
        ? Promise.resolve((req: Request) => fetch(req))
        : import("./mock").then((m) => m.createMockTransport());
  }
  return transport;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

async function request<T>(
  method: string,
  path: string,
  opts: { query?: Query; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const send = await getTransport();
  let res: Response;
  try {
    res = await send(
      new Request(url, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      }),
    );
  } catch (e) {
    throw new ApiError(0, "network", e instanceof Error ? e.message : "network error");
  }

  const json = (await res.json().catch(() => null)) as Envelope<T> | ApiErrorBody | null;
  if (!res.ok) {
    const err = json && "error" in json ? json.error : null;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? res.statusText);
  }
  const env = json as Envelope<T>;
  setIngestedAt(env.meta?.ingested_at);
  return env.data;
}

export const api = {
  stations: () => request<StationSummary[]>("GET", "/api/stations"),
  nearestStations: (lat: number, lon: number, k = 3) =>
    request<NearbyStation[]>("GET", "/api/stations/nearest", { query: { lat, lon, k } }),
  station: (id: number) => request<StationDetail>("GET", `/api/stations/${id}`),
  /** q: search by name. Without q: rivers at watch or worse, then the one nearest lat/lon. */
  rivers: (q: { lat?: number; lon?: number; q?: string; limit?: number } = {}) =>
    request<River[]>("GET", "/api/rivers", { query: q }),
  river: (key: string) => request<River>("GET", `/api/rivers/${encodeURIComponent(key)}`),
  readings: (id: number, hours = 72) =>
    request<StationReadings>("GET", `/api/stations/${id}/readings`, { query: { hours } }),
  shelters: (q: { lat?: number; lon?: number; patients?: boolean; pets?: boolean } = {}) =>
    request<Shelter[]>("GET", "/api/shelters", { query: q }),
  floodAreas: (q: { period: FloodPeriod; level: FloodLevel; province?: string; amphoe?: string; limit?: number }) =>
    request<FloodAreas>("GET", "/api/flood/areas", { query: q }),
  /** bbox: "minLon,minLat,maxLon,maxLat". res 9 = GISTDA's cells; 5–8 = their parents, summed. */
  floodCells: (q: { period: FloodPeriod; bbox: string; res: number; limit?: number }) =>
    request<FloodCells>("GET", "/api/flood/cells", { query: q }),
  /** Flood history 2011–: per province, or per tambon of one province (its pv code). */
  floodHistory: (q: { level: "province" | "tambon"; province?: string }) =>
    request<FloodHistory>("GET", "/api/flood/history", { query: q }),
  floodNear: (q: { period: FloodPeriod; lat: number; lon: number }) =>
    request<FloodNear>("GET", "/api/flood/near", { query: q }),
  /** One tambon's flood story, by GISTDA tb_idn (the outlines' code). */
  floodTambon: (q: { code: string }) => request<FloodTambon>("GET", "/api/flood/tambon", { query: q }),
  chat: (req: ChatRequest) => request<ChatResponse>("POST", "/api/chat", { body: req }),
  /** chat_session: the anonymous web chat to fold into the account on sign-in. */
  login: (id_token: string, chat_session?: string, provider: Provider = "line") =>
    request<LoginResponse>("POST", `/api/auth/${provider}`, { body: { id_token, chat_session } }),
  /** LINE web login: where to send the browser (sets the backend's state cookie). */
  lineStart: (intent: "login" | "link", chat_session?: string) =>
    request<{ authorize_url: string }>("POST", "/api/auth/line/start", { body: { intent, chat_session } }),
  /** The session for a finished LINE web login (the one-time line_claim LINE's callback put in the URL). */
  lineClaim: (claim: string) => request<LoginResponse>("POST", "/api/auth/line/claim", { body: { claim } }),
  link: (provider: Provider, id_token: string) =>
    request<SessionUser>("POST", `/api/auth/link/${provider}`, { body: { id_token } }),
  unlink: (provider: Provider) => request<SessionUser>("DELETE", `/api/auth/link/${provider}`),
  logout: () => request<{ signed_out: boolean }>("POST", "/api/auth/logout"),
  deleteMe: () => request<{ deleted: boolean }>("DELETE", "/api/me"),
  me: () => request<SessionUser>("GET", "/api/me"),
  // The anonymous web chat is identified by its session_id (the signed-in user by the bearer token).
  profile: (chatSession: string) =>
    request<Profile>("GET", "/api/profile", { headers: { "X-Chat-Session": chatSession } }),
  deletePlace: (chatSession: string, id: number) =>
    request<Profile>("DELETE", `/api/profile/places/${id}`, { headers: { "X-Chat-Session": chatSession } }),
  deleteFacts: (chatSession: string, kind: FactKind | "all") =>
    request<Profile>("DELETE", `/api/profile/facts/${kind}`, { headers: { "X-Chat-Session": chatSession } }),
  renamePlace: (chatSession: string, id: number, label: string) =>
    request<Profile>("PATCH", `/api/profile/places/${id}`, { body: { label }, headers: { "X-Chat-Session": chatSession } }),
  deletePlaceFacts: (chatSession: string, id: number, kind: PlaceFactKind) =>
    request<Profile>("DELETE", `/api/profile/places/${id}/facts/${kind}`, { headers: { "X-Chat-Session": chatSession } }),
  /** place: rename in that place's facts (SavedPlace.facts), else in the general ones. */
  renameName: (chatSession: string, r: { list: NameList; from: string; to: string; place?: number }) =>
    request<Profile>("PATCH", "/api/profile/names", { body: r, headers: { "X-Chat-Session": chatSession } }),
};
