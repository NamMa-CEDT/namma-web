// In-app mock of the FastAPI backend. Loaded with import() only when VITE_API_MODE=mock.
// Works without service workers (LIFF browser, plain-http LAN on a phone, static demo builds).
// Each route mirrors one endpoint in docs/api.md.
import type { Transport } from "../client";
import type { Fact, FloodLevel, FloodPeriod, Profile, SessionUser } from "../types";
import { copy } from "../../copy";
import { respond, type ChatSessionState } from "./chatScript";
import * as data from "./data";
import { floodAreas, floodCells, floodHistory, floodNear, floodTambon } from "./flood";
import { chatState, loadState, updateState, type MockState } from "./store";

interface Ctx {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  token: string | null;
  headers: Headers;
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

/**
 * Whose memory a request reads and writes, as on the backend: the signed-in account, else the browser's anonymous
 * chat session. Memory, places and consent live there, so a new chat or another device keeps them.
 */
function ownerOf(token: string | null, chatSession: string | null, s: MockState): string | null {
  const account = token ? s.accounts?.[token] : undefined;
  return account ? `account:${account}` : chatSession;
}

function num(q: URLSearchParams, key: string): number | undefined {
  const v = q.get(key);
  return v == null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v);
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

// --- rivers -------------------------------------------------------------------

route("GET", "/api/rivers", ({ query }) => {
  const lat = num(query, "lat");
  const lon = num(query, "lon");
  if ((lat == null) !== (lon == null)) return fail(400, "bad_request", "lat and lon must be given together");
  const limit = Math.min(50, Math.max(1, num(query, "limit") ?? 6));
  return { data: data.listRivers({ lat, lon, q: query.get("q"), limit }, loadState().tierOverrides) };
});

route("GET", "/api/rivers/:key", ({ params }) => {
  const r = data.riverDetail(decodeURIComponent(params.key), loadState().tierOverrides);
  return r ? { data: r } : fail(404, "not_found", "river not found");
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

// --- flood (a labelled sample, see ./flood.ts) --------------------------------

const FLOOD_PERIODS: FloodPeriod[] = ["3days", "7days", "30days"];
const FLOOD_LEVELS: FloodLevel[] = ["province", "amphoe", "tambon"];

function floodPeriod(q: URLSearchParams): FloodPeriod | null {
  const p = q.get("period") ?? "3days";
  return FLOOD_PERIODS.includes(p as FloodPeriod) ? (p as FloodPeriod) : null;
}

route("GET", "/api/flood/areas", ({ query }) => {
  const period = floodPeriod(query);
  const level = (query.get("level") ?? "province") as FloodLevel;
  const limit = num(query, "limit") ?? 100;
  if (!period || !FLOOD_LEVELS.includes(level) || limit < 1 || limit > 1000) {
    return fail(400, "bad_request", "period, level or limit is invalid");
  }
  const filter = { province: query.get("province"), amphoe: query.get("amphoe") };
  return { data: floodAreas(period, level, filter, limit, data.ingestedAt()) };
});

route("GET", "/api/flood/cells", ({ query }) => {
  const period = floodPeriod(query);
  const res = num(query, "res") ?? 9;
  const limit = num(query, "limit") ?? 5000;
  const box = (query.get("bbox") ?? "").split(",").map(Number);
  const [w, s, e, n] = box;
  if (!period || ![5, 6, 7, 8, 9].includes(res) || limit < 1 || limit > 20000) {
    return fail(400, "bad_request", "period, res or limit is invalid");
  }
  if (box.length !== 4 || box.some(Number.isNaN) || !(w < e && s < n)) {
    return fail(400, "bad_request", "bbox must be minLon,minLat,maxLon,maxLat");
  }
  return { data: floodCells(period, [w, s, e, n], res, limit, data.ingestedAt()) };
});

route("GET", "/api/flood/near", ({ query }) => {
  const period = floodPeriod(query);
  const lat = num(query, "lat");
  const lon = num(query, "lon");
  if (!period || lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return fail(400, "bad_request", "period, lat or lon is invalid");
  }
  return { data: floodNear(period, lat, lon, data.ingestedAt()) };
});

route("GET", "/api/flood/history", ({ query }) => {
  const level = query.get("level") ?? "province";
  const province = query.get("province");
  if ((level !== "province" && level !== "tambon") || (level === "tambon" && !province)) {
    return fail(400, "bad_request", "level must be province, or tambon with province");
  }
  return { data: floodHistory(level, province) };
});

route("GET", "/api/flood/tambon", ({ query }) => {
  const code = query.get("code") ?? "";
  if (!/^\d{6}$/.test(code)) return fail(400, "bad_request", "code must be a 6-digit tambon code");
  const story = floodTambon(code, data.ingestedAt());
  return story ? { data: story } : fail(404, "not_found", "no flood data for this sub-district code");
});

// --- chat ---------------------------------------------------------------------

route(
  "POST",
  "/api/chat",
  (ctx) => {
    const req = ctx.body as Parameters<typeof respond>[0];
    if (!req?.session_id) return fail(400, "bad_request", "session_id is required");
    let out: Result = {};
    updateState((s) => {
      const deps = {
        nearest: (lat: number, lon: number, k: number) => data.nearestStations(lat, lon, k, s.tierOverrides),
        shelters: (lat: number, lon: number, patientsOnly: boolean) =>
          data.shelters({ lat, lon, patients: patientsOnly }),
      };
      out = { data: respond(req, chatState(s, ownerOf(ctx.token, req.session_id, s) ?? req.session_id), deps) };
    });
    return out;
  },
  [900, 1600],
);

// --- profile ------------------------------------------------------------------

function profileOf(c: ChatSessionState | undefined, s: MockState, lineLinked: boolean): Profile {
  if (!c) return { places: [], facts: [], consent: { granted: false, ts: null }, pending_consent: false, line_linked: lineLinked };
  // Household facts are sensitive: shown (and kept) only with consent, as on the backend.
  const facts: Fact[] = c.consent
    ? c.household.map((v): Fact => ({ kind: "household", text: copy.vulnerable[v], sensitive: true, list: null, names: [] }))
    : [];
  return {
    places: (c.places ?? []).map((p) => {
      const n = data.nearestStations(p.lat, p.lon, 1, s.tierOverrides)[0];
      return {
        ...p,
        facts: [], // the mock chat keeps household facts for the person only
        nearest: n
          ? {
              station_id: n.id,
              code: n.oldcode,
              name_th: n.name_th,
              distance_km: n.distance_km,
              risk_tier: n.risk?.tier ?? null,
              diff_wl_bank: n.latest?.diff_wl_bank ?? null,
              observed_at: n.latest?.ts ?? null,
            }
          : null,
      };
    }),
    facts,
    consent: { granted: c.consent === true, ts: c.consentTs ?? null },
    pending_consent: !!c.pendingConsent?.length,
    line_linked: lineLinked,
  };
}

function chatFor(ctx: Ctx, s: MockState): ChatSessionState | undefined {
  const owner = ownerOf(ctx.token, ctx.headers.get("X-Chat-Session"), s);
  return owner ? s.chats[owner] : undefined;
}

route("GET", "/api/profile", (ctx) => {
  const s = loadState();
  return { data: profileOf(chatFor(ctx, s), s, !!userFor(ctx.token, s)) };
}, [100, 250]);

route("DELETE", "/api/profile/places/:id", (ctx) => {
  let out: Result = {};
  updateState((s) => {
    const c = chatFor(ctx, s);
    const id = Number(ctx.params.id);
    if (!c?.places?.some((p) => p.id === id)) {
      out = fail(404, "not_found", `place ${id} not found`);
      return;
    }
    c.places = c.places.filter((p) => p.id !== id);
    out = { data: profileOf(c, s, !!userFor(ctx.token, s)) };
  });
  return out;
});

// The mock keeps household facts as categories without names, so only places rename (the names route always 404s).
route("PATCH", "/api/profile/places/:id", (ctx) => {
  const label = String((ctx.body as { label?: unknown } | null)?.label ?? "").trim().replace(/\s+/g, " ");
  if (!label) return fail(400, "bad_request", "name is empty");
  let out: Result = {};
  updateState((s) => {
    const c = chatFor(ctx, s);
    const id = Number(ctx.params.id);
    const place = c?.places?.find((p) => p.id === id);
    if (!c || !place) {
      out = fail(404, "not_found", `place ${id} not found`);
      return;
    }
    if (c.places?.some((p) => p.id !== id && p.label === label)) {
      out = fail(409, "label_taken", `another place is already called ${label}`);
      return;
    }
    place.label = label;
    out = { data: profileOf(c, s, !!userFor(ctx.token, s)) };
  });
  return out;
});

route("PATCH", "/api/profile/names", (ctx) => {
  const b = ctx.body as { list?: string; from?: string } | null;
  if (!["immobile", "pets", "past_floods"].includes(b?.list ?? "")) return fail(400, "bad_request", `unknown list: ${b?.list}`);
  return fail(404, "not_found", `${b?.list} has no ${b?.from}`);
});

route("DELETE", "/api/profile/places/:id/facts/:kind", (ctx) => {
  if (!["household", "house", "assets", "history"].includes(ctx.params.kind)) {
    return fail(400, "bad_request", `unknown kind: ${ctx.params.kind}`);
  }
  const s = loadState();
  const c = chatFor(ctx, s);
  const id = Number(ctx.params.id);
  if (!c?.places?.some((p) => p.id === id)) return fail(404, "not_found", `place ${id} not found`);
  return { data: profileOf(c, s, !!userFor(ctx.token, s)) }; // no place facts in the mock: nothing to delete
});

route("DELETE", "/api/profile/facts/:kind", (ctx) => {
  const kind = ctx.params.kind;
  if (!["household", "needs", "house", "assets", "history", "all"].includes(kind)) {
    return fail(400, "bad_request", `unknown kind: ${kind}`);
  }
  let out: Result = {};
  updateState((s) => {
    const c = chatFor(ctx, s);
    if (c && (kind === "household" || kind === "all")) {
      c.household = [];
      c.pendingConsent = null;
    }
    if (c && kind === "all") c.places = [];
    out = { data: profileOf(c, s, !!userFor(ctx.token, s)) };
  });
  return out;
});

// --- auth ---------------------------------------------------------------------

// Demo tokens, as on the backend: demo:user, demo:user:<name> (LINE), demo:google:<name>.
// The mock keeps one account per demo id. Signing in folds the browser's anonymous chat into it, as the backend does.
function mockLogin(idToken: string, provider: "line" | "google", chatSession: string | undefined): Result {
  const parts = idToken.split(":");
  const nameOk = (n: string | undefined) => !!n && /^[a-z0-9_-]{1,40}$/.test(n);
  let user: SessionUser;
  if (provider === "google") {
    if (parts[0] !== "demo" || parts[1] !== "google" || parts.length !== 3 || !nameOk(parts[2])) {
      return fail(401, "invalid_token", "mock mode accepts demo:google:<name>");
    }
    user = { display_name: parts[2], picture_url: null, identities: { line: false, google: `${parts[2]}@demo.namma` } };
  } else {
    if (parts[0] !== "demo" || parts[1] !== "user" || parts.length > 3 || (parts.length === 3 && !nameOk(parts[2]))) {
      return fail(401, "invalid_token", "mock mode accepts demo:user or demo:user:<name>");
    }
    user = { display_name: parts[2] ?? "ผู้ใช้ทดลอง", picture_url: null, identities: { line: true, google: null } };
  }
  const token = `mock-${Math.random().toString(36).slice(2)}`;
  const account = `${provider}:${parts[2] ?? ""}`;
  let merged = false;
  updateState((s) => {
    s.sessions[token] = user;
    (s.accounts ??= {})[token] = account;
    const anon = chatSession ? s.chats[chatSession] : undefined;
    if (!anon || !chatSession) return;
    s.chats[`account:${account}`] = absorb(s.chats[`account:${account}`], anon);
    delete s.chats[chatSession];
    merged = true;
  });
  return { data: { session_token: token, user, merged_chat: merged } };
}

/** The anonymous chat joins the account: places and household add up; a yes in either is the account's yes. */
function absorb(into: ChatSessionState | undefined, anon: ChatSessionState): ChatSessionState {
  if (!into) return anon;
  const places = [...(into.places ?? [])];
  let next = Math.max(0, ...places.map((p) => p.id)) + 1;
  for (const p of anon.places ?? []) if (!places.some((q) => q.label === p.label)) places.push({ ...p, id: next++ });
  const granted = into.consent === true || anon.consent === true;
  return {
    ...into,
    place: into.place ?? anon.place,
    places,
    household: [...new Set([...into.household, ...anon.household])],
    consent: granted ? true : (into.consent ?? anon.consent),
    consentTs: granted ? (into.consent === true ? into.consentTs : anon.consentTs) : (into.consentTs ?? anon.consentTs),
    pendingConsent: into.pendingConsent ?? anon.pendingConsent,
  };
}

type LoginBody = { id_token?: string; chat_session?: string } | null;
route("POST", "/api/auth/line", ({ body }) => mockLogin((body as LoginBody)?.id_token ?? "", "line", (body as LoginBody)?.chat_session));
route("POST", "/api/auth/google", ({ body }) =>
  mockLogin((body as LoginBody)?.id_token ?? "", "google", (body as LoginBody)?.chat_session),
);

route("POST", "/api/auth/link/:provider", (ctx) => {
  const provider = ctx.params.provider;
  if (provider !== "line" && provider !== "google") return fail(404, "not_found", `unknown provider: ${provider}`);
  let out: Result = fail(401, "unauthorized", "login required");
  updateState((s) => {
    const user = ctx.token ? s.sessions[ctx.token] : undefined;
    if (!user) return;
    const ids = (user.identities ??= { line: false, google: null });
    const idToken = (ctx.body as { id_token?: string })?.id_token ?? "";
    if (provider === "google") {
      const name = idToken.split(":")[2];
      if (!idToken.startsWith("demo:google:") || !name) return void (out = fail(401, "invalid_token", "demo:google:<name>"));
      if (ids.google && ids.google !== `${name}@demo.namma`) return void (out = fail(409, "conflict", "already linked"));
      ids.google = `${name}@demo.namma`;
    } else {
      ids.line = true;
    }
    out = { data: user };
  });
  return out;
});

route("DELETE", "/api/auth/link/:provider", (ctx) => {
  let out: Result = fail(401, "unauthorized", "login required");
  updateState((s) => {
    const user = ctx.token ? s.sessions[ctx.token] : undefined;
    if (!user) return;
    const ids = (user.identities ??= { line: false, google: null });
    const other = ctx.params.provider === "line" ? !!ids.google : ids.line;
    if (!other) return void (out = fail(409, "conflict", "this is the account's only way to sign in"));
    if (ctx.params.provider === "line") ids.line = false;
    else ids.google = null;
    out = { data: user };
  });
  return out;
});

route("POST", "/api/auth/logout", (ctx) => {
  updateState((s) => {
    if (!ctx.token) return;
    delete s.sessions[ctx.token];
    delete s.accounts?.[ctx.token];
  });
  return { data: { signed_out: true } };
});

route("DELETE", "/api/me", (ctx) => {
  if (!userFor(ctx.token, loadState())) return fail(401, "unauthorized", "login required");
  updateState((s) => {
    if (!ctx.token) return;
    // Erasure: the account's memory and consent go with it, and every session signed in to it.
    const account = s.accounts?.[ctx.token];
    if (account) {
      delete s.chats[`account:${account}`];
      for (const [t, a] of Object.entries(s.accounts ?? {})) {
        if (a !== account) continue;
        delete s.sessions[t];
        delete s.accounts?.[t];
      }
    }
    delete s.sessions[ctx.token];
  });
  return { data: { deleted: true } };
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
      headers: req.headers,
    });
    if (result.error) return json(result.status ?? 500, { error: result.error });
    return json(result.status ?? 200, { data: result.data, meta: { ingested_at: data.ingestedAt() } });
  };
}
