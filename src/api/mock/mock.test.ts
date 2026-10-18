// The mock backend is the executable form of docs/api.md; these tests pin its behaviour.
import { createMockTransport } from "./index";
import { resetState } from "./store";

const send = createMockTransport();
const ORIGIN = "http://localhost";

async function call(method: string, path: string, body?: unknown, token?: string, chatSession?: string) {
  const res = await send(
    new Request(ORIGIN + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(chatSession ? { "X-Chat-Session": chatSession } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: res.status, json: await res.json() };
}

async function login(role: "user" | "responder") {
  const { json } = await call("POST", "/api/auth/line", { id_token: `demo:${role}` });
  return json.data.session_token as string;
}

async function chat(session_id: string, req: Record<string, unknown>) {
  const { status, json } = await call("POST", "/api/chat", { session_id, ...req });
  expect(status).toBe(200);
  return json.data;
}

beforeEach(() => {
  localStorage.clear();
  resetState();
});

describe("stations", () => {
  it("lists the corridor with envelope meta", async () => {
    const { status, json } = await call("GET", "/api/stations");
    expect(status).toBe(200);
    expect(json.data.length).toBe(22);
    expect(json.meta.ingested_at).toMatch(/\+07:00$/);
    const c35 = json.data.find((s: { oldcode: string }) => s.oldcode === "C.35");
    expect(c35.latest.diff_wl_bank).not.toBeNull();
  });

  it("time-shifts fixtures so the newest reading looks fresh", async () => {
    const { json } = await call("GET", "/api/stations");
    const age = Date.now() - Date.parse(json.meta.ingested_at);
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(20 * 60_000);
  });

  it("returns nearest stations with server-side distances", async () => {
    const { json } = await call("GET", "/api/stations/nearest?lat=14.369&lon=100.474&k=2");
    expect(json.data).toHaveLength(2);
    expect(json.data[0].oldcode).toBe("C.37");
    expect(json.data[0].distance_km).toBeGreaterThan(0);
  });

  it("returns detail with upstream links and readings", async () => {
    const { json } = await call("GET", "/api/stations/2609");
    expect(json.data.upstream.map((l: { station: { oldcode: string } }) => l.station.oldcode)).toContain("C.7A");
    const r = await call("GET", "/api/stations/2609/readings?hours=72");
    expect(r.json.data.readings.length).toBeGreaterThan(24);
    expect((await call("GET", "/api/stations/999999")).status).toBe(404);
  });
});

describe("tickets", () => {
  it("requires a responder", async () => {
    expect((await call("GET", "/api/tickets")).status).toBe(401);
    expect((await call("GET", "/api/tickets", undefined, await login("user"))).status).toBe(403);
  });

  it("hides raw text and phone in the list, shows them in detail", async () => {
    const token = await login("responder");
    const list = (await call("GET", "/api/tickets?status=open", undefined, token)).json.data;
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).not.toHaveProperty("raw_text");
    expect(list[0]).not.toHaveProperty("contact_phone");
    const detail = (await call("GET", `/api/tickets/${list[0].id}`, undefined, token)).json.data;
    expect(detail.raw_text).toBeTruthy();
  });

  it("rejects a stale PATCH with 409", async () => {
    const token = await login("responder");
    const [t] = (await call("GET", "/api/tickets?status=open", undefined, token)).json.data;
    const ok = await call("PATCH", `/api/tickets/${t.id}`, { status: "acknowledged", updated_at: t.updated_at }, token);
    expect(ok.status).toBe(200);
    expect(ok.json.data.status).toBe("acknowledged");
    const stale = await call("PATCH", `/api/tickets/${t.id}`, { status: "resolved", updated_at: t.updated_at }, token);
    expect(stale.status).toBe(409);
  });
});

describe("chat follows the demo script (CLAUDE.md §15)", () => {
  it("answers, asks for consent, then triages into a ticket", async () => {
    const sid = "test-session";

    const a1 = await chat(sid, { message: "บ้านแม่อยู่บางบาล อยุธยา น้ำจะถึงไหม" });
    expect(a1.reply).toContain("C.37");
    expect(a1.reply).toContain("ไม่ใช่ระดับน้ำที่บ้าน");
    expect(a1.sources[0]).toMatchObject({ type: "station", code: "C.37" });
    expect(a1.emergency).toBe(false);

    const a2 = await chat(sid, { message: "ที่บ้านมียายติดเตียง" });
    expect(a2.quick_replies.map((q: { data?: string }) => q.data)).toContain("consent:sensitive_memory:yes");

    const a3 = await chat(sid, { postback: "consent:sensitive_memory:yes" });
    expect(a3.reply).toContain("บันทึกแล้ว");

    const a4 = await chat(sid, { message: "น้ำเข้าบ้านแล้ว ยายเดินไม่ได้" });
    expect(a4.emergency).toBe(true);
    expect(a4.reply.indexOf("1784")).toBeLessThan(a4.reply.indexOf("ตรวจสอบข้อมูล"));
    expect(a4.reply).toContain("บางบาล");

    const a5 = await chat(sid, { postback: "triage:confirm" });
    expect(a5.ticket_id).toBeGreaterThan(0);

    const token = await login("responder");
    const ticket = (await call("GET", `/api/tickets/${a5.ticket_id}`, undefined, token)).json.data;
    expect(ticket).toMatchObject({ urgency: "critical", status: "open", channel: "web" });
    expect(ticket.vulnerable).toEqual(expect.arrayContaining(["elderly", "bedridden"]));
    expect(ticket.needs).not.toContain("medication"); // "ยาย" is grandma, not medicine
  });

  it("is honest about places outside the demo basin", async () => {
    const a = await chat("s2", { message: "บ้านแม่อยู่บางระกำ พิษณุโลก น้ำจะถึงไหม" });
    expect(a.reply).toContain("ลุ่มเจ้าพระยา");
    expect(a.sources).toHaveLength(0);
  });

  it("asks for a location before triage when none is known", async () => {
    const a = await chat("s3", { message: "ติดอยู่ในบ้าน ช่วยด้วย" });
    expect(a.emergency).toBe(true);
    expect(a.quick_replies.some((q: { type: string }) => q.type === "location")).toBe(true);
    expect(a.quick_replies.some((q: { data?: string }) => q.data === "triage:confirm")).toBe(false);
  });
});

describe("profile (what the chat remembers)", () => {
  const profile = async (sid: string) => (await call("GET", "/api/profile", undefined, undefined, sid)).json.data;

  it("is empty for an unknown session", async () => {
    expect(await profile("nobody")).toEqual({
      places: [],
      facts: [],
      consent: { granted: false, ts: null },
      pending_consent: false,
      line_linked: false,
    });
  });

  it("saves the named place, shows household facts only after consent, and deletes", async () => {
    const sid = "profile-1";
    const answer = await chat(sid, { message: "บ้านแม่อยู่บางบาล อยุธยา น้ำจะถึงไหม" });
    // Station sources carry the reading the StationCard draws; bank = level − diff.
    const st = answer.sources.find((x: { type: string }) => x.type === "station");
    expect(st.diff_wl_bank).not.toBeNull();
    expect(st.bank_msl).toBeCloseTo(st.level_msl - st.diff_wl_bank, 2);
    expect(st.river).toBeTruthy();

    let p = await profile(sid);
    expect(p.places).toHaveLength(1);
    expect(p.places[0]).toMatchObject({ label: "บ้านแม่", approx: true, where: "อ.บางบาล จ.พระนครศรีอยุธยา" });
    expect(p.places[0].nearest.code).toBe("C.37");

    await chat(sid, { message: "ที่บ้านมียายติดเตียง" });
    p = await profile(sid);
    expect(p.facts).toEqual([]);
    expect(p.pending_consent).toBe(true);

    await chat(sid, { postback: "consent:sensitive_memory:yes" });
    p = await profile(sid);
    expect(p.consent.granted).toBe(true);
    expect(p.consent.ts).toBeTruthy();
    expect(p.facts.map((f: { kind: string }) => f.kind)).toContain("household");
    expect(p.facts.every((f: { sensitive: boolean }) => f.sensitive)).toBe(true);

    const del = await call("DELETE", `/api/profile/places/${p.places[0].id}`, undefined, undefined, sid);
    expect(del.status).toBe(200);
    expect(del.json.data.places).toEqual([]);
    expect((await call("DELETE", "/api/profile/places/999", undefined, undefined, sid)).status).toBe(404);
    expect((await call("DELETE", "/api/profile/facts/all", undefined, undefined, sid)).json.data.facts).toEqual([]);
    expect((await call("DELETE", "/api/profile/facts/bogus", undefined, undefined, sid)).status).toBe(400);
  });

  it("another session cannot delete my place", async () => {
    await chat("mine", { message: "บ้านแม่อยู่บางบาล อยุธยา น้ำจะถึงไหม" });
    const id = (await profile("mine")).places[0].id;
    expect((await call("DELETE", `/api/profile/places/${id}`, undefined, undefined, "theirs")).status).toBe(404);
    expect((await profile("mine")).places).toHaveLength(1);
  });
});

describe("accounts", () => {
  it("signs in with Google or LINE demo ids, links, unlinks (never the last), logs out and deletes", async () => {
    const g = await call("POST", "/api/auth/google", { id_token: "demo:google:pim" });
    expect(g.status).toBe(200);
    expect(g.json.data.user.identities).toEqual({ line: false, google: "pim@demo.namma" });
    const t = g.json.data.session_token as string;

    expect((await call("DELETE", "/api/auth/link/google", undefined, t)).status).toBe(409);
    const linked = await call("POST", "/api/auth/link/line", { id_token: "demo:user:pim" }, t);
    expect(linked.json.data.identities).toEqual({ line: true, google: "pim@demo.namma" });
    expect((await call("POST", "/api/auth/link/google", { id_token: "demo:google:other" }, t)).status).toBe(409);
    expect((await call("DELETE", "/api/auth/link/google", undefined, t)).json.data.identities.google).toBeNull();

    expect((await call("POST", "/api/auth/logout", undefined, t)).status).toBe(200);
    expect((await call("GET", "/api/me", undefined, t)).status).toBe(401);

    const l = await call("POST", "/api/auth/line", { id_token: "demo:user:somchai" });
    expect(l.json.data.user.display_name).toBe("somchai");
    expect((await call("DELETE", "/api/me", undefined, l.json.data.session_token)).json.data).toEqual({ deleted: true });
    expect((await call("POST", "/api/auth/line", { id_token: "demo:user:Bad Name" })).status).toBe(401);
  });
});
