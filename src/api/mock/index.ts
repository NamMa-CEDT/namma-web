// In-app mock of the FastAPI backend. Loaded with import() only when VITE_API_MODE=mock.
// Works without service workers (LIFF browser, plain-http LAN on a phone, static demo builds).
// Each route mirrors one endpoint in docs/api.md.
import type { Transport } from "../client";
import type { RescueTicket, SessionUser, TicketPatch, TicketStatus, TicketSummary } from "../types";
import { respond, type PendingTriage } from "./chatScript";
import * as data from "./data";
import { toBangkokIso } from "./geo";
import { chatState, loadState, updateState, type MockState } from "./store";

interface Ctx {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  token: string | null;
}

type Result = { status?: number; data?: unknown; error?: { code: string; message: string } };
type Handler = (ctx: Ctx) => Result | Promise<Result>;

const routes: { method: string; re: RegExp; keys: string[]; handler: Handler; latency: [number, number] }[] = [];

function route(method: string, path: string, handler: Handler, latency: [number, number] = [150, 450]) {
  const keys: string[] = [];
  const re = new RegExp(
    "^" +
      path.replace(/:(\w+)/g, (_, k: string) => {
        keys.push(k);
        return "([^/]+)";
      }) +
      "$",
  );
  routes.push({ method, re, keys, handler, latency });
}

const fail = (status: number, code: string, message: string): Result => ({ status, error: { code, message } });

function userFor(token: string | null, s: MockState): SessionUser | null {
  return token ? (s.sessions[token] ?? null) : null;
}

function requireResponder(ctx: Ctx, s: MockState): Result | null {
  const user = userFor(ctx.token, s);
  if (!user) return fail(401, "unauthorized", "login required");
  if (user.role !== "responder") return fail(403, "forbidden", "responder role required");
  return null;
}

function num(q: URLSearchParams, key: string): number | undefined {
  const v = q.get(key);
  return v == null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v);
}

function summarize(t: RescueTicket): TicketSummary {
  const { raw_text: _raw, contact_phone: _phone, assignee: _assignee, notes: _notes, ...summary } = t;
  return summary;
}

// --- stations -----------------------------------------------------------------

route("GET", "/api/stations", () => ({ data: data.listStations(loadState().tierOverrides) }));

route("GET", "/api/stations/nearest", ({ query }) => {
  const lat = num(query, "lat");
  const lon = num(query, "lon");
  if (lat == null || lon == null) return fail(400, "bad_request", "lat and lon are required");
  const k = Math.min(10, Math.max(1, num(query, "k") ?? 3));
  return { data: data.nearestStations(lat, lon, k, loadState().tierOverrides) };
});

route("GET", "/api/stations/:id", ({ params }) => {
  const s = data.stationDetail(Number(params.id), loadState().tierOverrides);
  return s ? { data: s } : fail(404, "not_found", "station not found");
});

route("GET", "/api/stations/:id/readings", async ({ params, query }) => {
  const hours = Math.min(24 * 7, Math.max(1, num(query, "hours") ?? 72));
  const readings = await data.stationReadings(Number(params.id), hours);
  return readings ? { data: { station_id: Number(params.id), readings } } : fail(404, "not_found", "station not found");
});

// --- shelters -----------------------------------------------------------------

route("GET", "/api/shelters", ({ query }) => ({
  data: data.shelters({
    lat: num(query, "lat"),
    lon: num(query, "lon"),
    patients: query.get("patients") === "true",
    pets: query.get("pets") === "true",
  }),
}));

// --- tickets ------------------------------------------------------------------

route("GET", "/api/tickets", (ctx) => {
  const s = loadState();
  const denied = requireResponder(ctx, s);
  if (denied) return denied;
  const statuses = ctx.query.get("status")?.split(",").filter(Boolean) as TicketStatus[] | undefined;
  const since = ctx.query.get("since");
  const list = s.tickets
    .filter((t) => !statuses?.length || statuses.includes(t.status))
    .filter((t) => !since || Date.parse(t.updated_at) > Date.parse(since))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map(summarize);
  return { data: list };
});

route("GET", "/api/tickets/:id", (ctx) => {
  const s = loadState();
  const denied = requireResponder(ctx, s);
  if (denied) return denied;
  const t = s.tickets.find((x) => x.id === Number(ctx.params.id));
  return t ? { data: t } : fail(404, "not_found", "ticket not found");
});

route("PATCH", "/api/tickets/:id", (ctx) => {
  let result: Result = fail(404, "not_found", "ticket not found");
  updateState((s) => {
    const denied = requireResponder(ctx, s);
    if (denied) {
      result = denied;
      return;
    }
    const t = s.tickets.find((x) => x.id === Number(ctx.params.id));
    if (!t) return;
    const patch = ctx.body as TicketPatch;
    if (patch.updated_at !== t.updated_at) {
      result = fail(409, "conflict", "ticket changed since you loaded it");
      return;
    }
    const now = toBangkokIso(Date.now());
    if (patch.status) t.status = patch.status;
    if (patch.assignee !== undefined) t.assignee = patch.assignee;
    if (patch.note) t.notes = [t.notes, `${now} ${patch.note}`].filter(Boolean).join("\n");
    t.updated_at = now;
    result = { data: t };
  });
  return result;
});

// --- chat ---------------------------------------------------------------------

route(
  "POST",
  "/api/chat",
  ({ body }) => {
    const req = body as Parameters<typeof respond>[0];
    if (!req?.session_id) return fail(400, "bad_request", "session_id is required");
    let out: Result = {};
    updateState((s) => {
      const deps = {
        nearest: (lat: number, lon: number, k: number) => data.nearestStations(lat, lon, k, s.tierOverrides),
        shelters: (lat: number, lon: number, patientsOnly: boolean) =>
          data.shelters({ lat, lon, patients: patientsOnly }),
        createTicket: (t: PendingTriage) => insertTicket(s, t, "web"),
      };
      out = { data: respond(req, chatState(s, req.session_id), deps) };
    });
    return out;
  },
  [900, 1600],
);

export function insertTicket(s: MockState, t: PendingTriage, channel: "line" | "web"): number {
  const id = s.nextTicketId++;
  const now = toBangkokIso(Date.now());
  s.tickets.push({
    id,
    raw_text: t.raw_text,
    place_label: t.place?.label ?? null,
    lat: t.place?.lat ?? null,
    lon: t.place?.lon ?? null,
    people_count: t.people_count,
    vulnerable: t.vulnerable,
    needs: t.needs,
    urgency: t.urgency,
    status: "open",
    channel,
    contact_phone: null,
    assignee: null,
    notes: null,
    created_at: now,
    updated_at: now,
  });
  return id;
}

// --- auth ---------------------------------------------------------------------

route("POST", "/api/auth/line", ({ body }) => {
  const idToken = (body as { id_token?: string })?.id_token ?? "";
  const role = idToken === "demo:responder" ? "responder" : idToken === "demo:user" ? "user" : null;
  if (!role) return fail(401, "invalid_token", "mock mode accepts demo:user or demo:responder");
  const user: SessionUser = {
    display_name: role === "responder" ? "เจ้าหน้าที่ทดลอง" : "ผู้ใช้ทดลอง",
    role,
    picture_url: null,
  };
  const token = `mock-${role}-${Math.random().toString(36).slice(2)}`;
  updateState((s) => {
    s.sessions[token] = user;
  });
  return { data: { session_token: token, user } };
});

route("GET", "/api/me", ({ token }) => {
  const user = userFor(token, loadState());
  return user ? { data: user } : fail(401, "unauthorized", "login required");
});

// --- transport ----------------------------------------------------------------

const LATENCY_SCALE = import.meta.env.MODE === "test" ? 0 : 1;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms * LATENCY_SCALE));

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function createMockTransport(): Transport {
  return async (req) => {
    const url = new URL(req.url);
    const match = routes
      .map((r) => ({ r, m: req.method === r.method ? url.pathname.match(r.re) : null }))
      .find((x) => x.m);
    if (!match?.m) return json(404, { error: { code: "not_found", message: `${req.method} ${url.pathname}` } });

    const { r, m } = match;
    await sleep(r.latency[0] + Math.random() * (r.latency[1] - r.latency[0]));
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const text = await req.text();
    const auth = req.headers.get("Authorization");
    const result = await r.handler({
      params,
      query: url.searchParams,
      body: text ? JSON.parse(text) : undefined,
      token: auth?.startsWith("Bearer ") ? auth.slice(7) : null,
    });
    if (result.error) return json(result.status ?? 500, { error: result.error });
    return json(result.status ?? 200, { data: result.data, meta: { ingested_at: data.ingestedAt() } });
  };
}
