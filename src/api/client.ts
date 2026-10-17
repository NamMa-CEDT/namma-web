import { getToken } from "../auth/token";
import { setIngestedAt } from "./meta";
import type {
  ApiErrorBody,
  ChatRequest,
  ChatResponse,
  Envelope,
  LoginResponse,
  NearbyStation,
  RescueTicket,
  SessionUser,
  Shelter,
  StationDetail,
  StationReadings,
  StationSummary,
  TicketPatch,
  TicketStatus,
  TicketSummary,
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

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { Accept: "application/json" };
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
  readings: (id: number, hours = 72) =>
    request<StationReadings>("GET", `/api/stations/${id}/readings`, { query: { hours } }),
  shelters: (q: { lat?: number; lon?: number; patients?: boolean; pets?: boolean } = {}) =>
    request<Shelter[]>("GET", "/api/shelters", { query: q }),
  tickets: (q: { status?: TicketStatus[]; since?: string } = {}) =>
    request<TicketSummary[]>("GET", "/api/tickets", { query: { status: q.status?.join(","), since: q.since } }),
  ticket: (id: number) => request<RescueTicket>("GET", `/api/tickets/${id}`),
  patchTicket: (id: number, patch: TicketPatch) =>
    request<RescueTicket>("PATCH", `/api/tickets/${id}`, { body: patch }),
  chat: (req: ChatRequest) => request<ChatResponse>("POST", "/api/chat", { body: req }),
  login: (id_token: string) => request<LoginResponse>("POST", "/api/auth/line", { body: { id_token } }),
  me: () => request<SessionUser>("GET", "/api/me"),
};
