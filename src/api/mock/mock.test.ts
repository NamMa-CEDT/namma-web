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

describe("flood (mock sample of GISTDA's layers)", () => {
  type Area = { province: string; amphoe: string | null; cells: number; area_km2: number; area_rai: number };
  type Cell = { h3: string; cells: number; area_km2: number; share: number; province?: string };
  const sum = (xs: { area_km2: number }[]) => xs.reduce((s, x) => s + x.area_km2, 0);

  it("totals flooded area per province, largest first, with the layer's dates", async () => {
    const { status, json } = await call("GET", "/api/flood/areas?period=3days");
    expect(status).toBe(200);
    const d = json.data;
    expect(d).toMatchObject({ period: "3days", level: "province" });
    expect(d.fetched_at).toMatch(/\+07:00$/);
    expect(Date.parse(d.observed_to)).toBeLessThanOrEqual(Date.parse(d.fetched_at));
    const areas = d.areas as Area[];
    expect(areas[0].province).toBe("พระนครศรีอยุธยา");
    expect(areas.map((a) => a.area_km2)).toEqual([...areas.map((a) => a.area_km2)].sort((a, b) => b - a));
    expect(d.total.cells).toBe(areas.reduce((s, a) => s + a.cells, 0));
    expect(d.total.area_km2).toBeCloseTo(sum(areas), 2);
    expect(d.total.area_rai).toBe(Math.round(d.total.area_km2 * 625));
  });

  it("drills down to amphoe inside a province", async () => {
    const { json } = await call("GET", `/api/flood/areas?level=amphoe&province=${encodeURIComponent("พระนครศรีอยุธยา")}`);
    const amphoes = (json.data.areas as Area[]).map((a) => a.amphoe);
    expect(amphoes).toEqual(expect.arrayContaining(["บางบาล", "บางปะอิน"]));
    const all = (await call("GET", "/api/flood/areas")).json.data.areas as Area[];
    expect(json.data.total.cells).toBe(all.find((a) => a.province === "พระนครศรีอยุธยา")!.cells);
    const q = `level=tambon&province=${encodeURIComponent("พระนครศรีอยุธยา")}&amphoe=${encodeURIComponent("บางบาล")}`;
    const tambons = (await call("GET", `/api/flood/areas?${q}`)).json.data.areas as (Area & { tambon: string })[];
    expect(tambons.map((t) => t.tambon).sort()).toEqual(["บางหลวงโดด", "สะพานไทย"]);
  });

  it("the 7-day layer holds the 3-day one", async () => {
    const three = (await call("GET", "/api/flood/areas?period=3days")).json.data.total;
    const seven = (await call("GET", "/api/flood/areas?period=7days")).json.data.total;
    expect(seven.cells).toBeGreaterThan(three.cells);
  });

  it("returns the cells in view, and parents that sum them when zoomed out", async () => {
    const bbox = "100.30,14.25,100.65,14.55";
    const fine = (await call("GET", `/api/flood/cells?bbox=${bbox}&res=9`)).json.data;
    const coarse = (await call("GET", `/api/flood/cells?bbox=${bbox}&res=7`)).json.data;
    expect(fine.res).toBe(9);
    expect(fine.cells.length).toBeGreaterThan(50);
    expect(fine.cells[0].province).toBe("พระนครศรีอยุธยา");
    expect(coarse.cells[0]).not.toHaveProperty("province");
    expect((coarse.cells as Cell[]).reduce((s, c) => s + c.cells, 0)).toBeGreaterThanOrEqual(fine.cells.length);
    for (const c of [...fine.cells, ...coarse.cells] as Cell[]) {
      expect(c.share).toBeGreaterThan(0);
      expect(c.share).toBeLessThanOrEqual(1);
    }
    const capped = (await call("GET", `/api/flood/cells?bbox=${bbox}&res=9&limit=5`)).json.data;
    expect(capped.truncated).toBe(true);
    expect(capped.cells).toHaveLength(5);
    const empty = (await call("GET", "/api/flood/cells?bbox=98,8,98.5,8.5&res=9")).json.data;
    expect(empty.cells).toEqual([]);
  });

  it("says how close the flooding is to a place", async () => {
    const here = (await call("GET", "/api/flood/near?lat=14.415&lon=100.44&period=3days")).json.data;
    expect(here.at_point).toBe(true);
    expect(here.nearest_km).toBeLessThanOrEqual(0.2); // centre to centre: a res-9 cell is ~0.17 km across
    expect(here.nearby.area_rai).toBeGreaterThan(0);
    const far = (await call("GET", "/api/flood/near?lat=8.5&lon=98.5")).json.data;
    expect(far).toMatchObject({ at_point: false, nearest_km: null, nearby: { cells: 0 } });
    expect((await call("GET", "/api/flood/near?lat=99&lon=100")).status).toBe(400);
  });

  it("has no staff login any more", async () => {
    expect((await call("POST", "/api/auth/line", { id_token: "demo:responder" })).status).toBe(401);
    const { json } = await call("POST", "/api/auth/line", { id_token: "demo:user" });
    expect(json.data.user).not.toHaveProperty("role");
  });

  it("rejects a bad period, level, box or resolution", async () => {
    for (const path of [
      "/api/flood/areas?period=1day",
      "/api/flood/areas?level=village",
      "/api/flood/cells?bbox=1,2,3",
      "/api/flood/cells?bbox=100.5,14,100.4,15",
      "/api/flood/cells?bbox=100,14,101,15&res=4",
    ]) {
      expect((await call("GET", path)).status, path).toBe(400);
    }
  });
});

describe("chat follows the demo script (CLAUDE.md §15)", () => {
  it("answers, asks for consent, then gives the hotline in danger", async () => {
    const sid = "test-session";

    const a1 = await chat(sid, { message: "บ้านแม่อยู่บางบาล อยุธยา น้ำจะถึงไหม" });
    expect(a1.reply).toContain("C.37");
    expect(a1.reply).toContain("ไม่ใช่ระดับน้ำที่บ้าน");
    // The nearest station (C.37) is cited; a worse one nearby comes first, as the backend sends it.
    const order = ["normal", "watch", "warning", "danger"];
    const stations = a1.sources.filter((s: { type: string }) => s.type === "station");
    expect(stations.map((s: { code: string }) => s.code)).toContain("C.37");
    const tiers = stations.map((s: { risk_tier: string }) => order.indexOf(s.risk_tier));
    expect(tiers[0]).toBe(Math.max(...tiers));
    expect(a1.emergency).toBe(false);

    const a2 = await chat(sid, { message: "ที่บ้านมียายติดเตียง" });
    expect(a2.quick_replies.map((q: { data?: string }) => q.data)).toContain("consent:sensitive_memory:yes");

    const a3 = await chat(sid, { postback: "consent:sensitive_memory:yes" });
    expect(a3.reply).toContain("บันทึกแล้ว");

    const a4 = await chat(sid, { message: "น้ำเข้าบ้านแล้ว ยายเดินไม่ได้" });
    expect(a4.emergency).toBe(true);
    expect(a4.reply.indexOf("1784")).toBeLessThan(a4.reply.indexOf("ตอนโทร"));
    expect(a4.reply).toContain("บางบาล");
    expect(a4.reply).toContain("ผู้ป่วยติดเตียง");
    expect(a4.quick_replies).toEqual([]); // nothing to confirm: NamMa sends no rescue request
  });

  it("is honest about places outside the demo basin", async () => {
    const a = await chat("s2", { message: "บ้านแม่อยู่บางระกำ พิษณุโลก น้ำจะถึงไหม" });
    expect(a.reply).toContain("ลุ่มเจ้าพระยา");
    expect(a.sources).toHaveLength(0);
  });

  it("gives the hotline in danger even with no place known", async () => {
    const a = await chat("s3", { message: "ติดอยู่ในบ้าน ช่วยด้วย" });
    expect(a.emergency).toBe(true);
    expect(a.reply).toContain("1784");
    expect(a.reply).not.toContain("ตอนโทร");
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
