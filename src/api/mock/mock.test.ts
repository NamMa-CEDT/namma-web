// The mock backend is the executable form of docs/api.md; these tests pin its behaviour.
import { createMockTransport } from "./index";
import { resetState, updateState } from "./store";

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
  it("lists the whole network, corridor first, with envelope meta", async () => {
    const { status, json } = await call("GET", "/api/stations");
    expect(status).toBe(200);
    expect(json.data.length).toBeGreaterThan(100);
    expect(new Set(json.data.map((s: { id: number }) => s.id)).size).toBe(json.data.length);
    expect(json.data[0].stem_order).not.toBeNull();
    expect(json.data.some((s: { river: string }) => s.river === "แม่น้ำชี")).toBe(true);
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

  it("returns detail for a station off the corridor, with no banks or links", async () => {
    const list = (await call("GET", "/api/stations")).json.data as { id: number; stem_order: number | null; role: string | null }[];
    const far = list.find((s) => s.stem_order == null && s.role == null)!;
    const { status, json } = await call("GET", `/api/stations/${far.id}`);
    expect(status).toBe(200);
    expect(json.data.min_bank).toBeNull();
    expect(json.data.upstream).toEqual([]);
    expect((await call("GET", `/api/stations/${far.id}/readings?hours=72`)).status).toBe(200);
  });

  it("returns detail with upstream links and readings", async () => {
    const { json } = await call("GET", "/api/stations/2609");
    expect(json.data.upstream.map((l: { station: { oldcode: string } }) => l.station.oldcode)).toContain("C.7A");
    const r = await call("GET", "/api/stations/2609/readings?hours=72");
    expect(r.json.data.readings.length).toBeGreaterThan(24);
    expect((await call("GET", "/api/stations/999999")).status).toBe(404);
  });
});

describe("rivers", () => {
  type R = { key: string; reason: string; worst_tier: string | null; distance_km: number | null; stations: { id: number; oldcode: string }[] };

  it("lists each gauged place once, upstream first", async () => {
    const { status, json } = await call("GET", `/api/rivers/${encodeURIComponent("แม่น้ำเจ้าพระยา")}`);
    expect(status).toBe(200);
    const codes = (json.data as R).stations.map((s) => s.oldcode);
    expect(codes[0]).toBe("C.2");
    expect(codes).toContain("C.35");
    expect(codes).not.toContain("CPY011"); // 10 m from C.35
    expect(codes).not.toContain("CPY001"); // 2.5 km from C.2
    expect(codes.indexOf("C.35")).toBeLessThan(codes.indexOf("C.12"));
    expect((await call("GET", "/api/rivers/nope")).status).toBe(404);
  });

  it("puts rivers at risk first, then the one by the point; demo tiers count", async () => {
    updateState((s) => {
      s.tierOverrides = {};
    });
    const calm = (await call("GET", "/api/rivers?lat=18.79&lon=98.98")).json.data as R[]; // Chiang Mai
    const near = calm.find((r) => r.reason === "near_you")!;
    expect(near.key).toBe("แม่น้ำปิง");
    expect(near.distance_km).toBeLessThan(10);
    expect(calm.filter((r) => r.reason === "at_risk").every((r) => r.worst_tier && r.worst_tier !== "normal")).toBe(true);

    updateState((s) => {
      s.tierOverrides = { "2611": "danger" }; // C.36, แม่น้ำน้อย
    });
    const list = (await call("GET", "/api/rivers")).json.data as R[];
    expect(list.find((r) => r.key === "แม่น้ำน้อย")).toMatchObject({ reason: "at_risk", worst_tier: "danger" });
    expect(list[0].worst_tier).toBe("danger");
  });

  it("searches by name, then by place, and rejects half a point", async () => {
    // The Nan has a station named after the Yom ("คลองผันน้ำยม-น่าน4"): a name hit comes first, the place hit after.
    const hits = (await call("GET", `/api/rivers?q=${encodeURIComponent("ยม")}`)).json.data as R[];
    expect(hits.map((r) => [r.key, r.reason])).toEqual([["แม่น้ำยม", "match"], ["แม่น้ำน่าน", "match"]]);
    const byProvince = (await call("GET", `/api/rivers?q=${encodeURIComponent("อุบลราชธานี")}`)).json.data as R[];
    expect(byProvince.map((r) => r.key)).toContain("แม่น้ำชี"); // the Chi runs through Ubon Ratchathani
    expect((await call("GET", "/api/rivers?lat=14")).status).toBe(400);
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
    // rai is rounded from the unrounded km², as the backend does: within 1 of the rounded km² × 625.
    expect(Math.abs(d.total.area_rai - d.total.area_km2 * 625)).toBeLessThanOrEqual(1);
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

  it("the 7-day layer holds the 3-day one, and the 30-day one both", async () => {
    const three = (await call("GET", "/api/flood/areas?period=3days")).json.data.total;
    const seven = (await call("GET", "/api/flood/areas?period=7days")).json.data.total;
    const month = (await call("GET", "/api/flood/areas?period=30days")).json.data;
    expect(seven.cells).toBeGreaterThan(three.cells);
    expect(month.total.cells).toBeGreaterThan(seven.cells);
    expect(Date.parse(month.observed_from)).toBeLessThan(Date.parse(month.observed_to) - 7 * 86_400_000);
    // Water seen only weeks ago upstream: Chai Nat is in the 30-day layer, not in the 7-day one.
    const provinces = async (p: string) => ((await call("GET", `/api/flood/areas?period=${p}`)).json.data.areas as Area[]).map((a) => a.province);
    expect(await provinces("30days")).toContain("ชัยนาท");
    expect(await provinces("7days")).not.toContain("ชัยนาท");
  });

  it("says how lately water was seen in each cell", async () => {
    const bbox = "100.10,14.25,100.65,15.80";
    const month = (await call("GET", `/api/flood/cells?bbox=${bbox}&res=9&period=30days&limit=20000`)).json.data;
    const seen = new Set((month.cells as { seen: string }[]).map((c) => c.seen));
    expect([...seen].sort()).toEqual(["30days", "3days", "7days"]);
    expect((month.windows as { period: string }[]).map((w) => w.period)).toEqual(["3days", "7days", "30days"]);
    const three = (await call("GET", `/api/flood/cells?bbox=${bbox}&res=9&period=3days`)).json.data;
    expect(new Set((three.cells as { seen: string }[]).map((c) => c.seen))).toEqual(new Set(["3days"]));
    expect(three.windows).toHaveLength(1);
  });

  it("tells one tambon's flood story", async () => {
    const now = (await call("GET", "/api/flood/tambon?code=140513")).json.data; // บางหลวงโดด: water now
    expect(now).toMatchObject({ tambon: "บางหลวงโดด", last_seen: "3days" });
    expect(now.windows.map((w: { period: string }) => w.period)).toEqual(["3days", "7days", "30days"]);
    expect(now.record.length).toBeGreaterThan(1);
    expect(now.history.years_covered[0]).toBe(2011);
    const gone = (await call("GET", "/api/flood/tambon?code=180406")).json.data; // Chai Nat: weeks ago only
    expect(gone).toMatchObject({ last_seen: "30days", history: null });
    const dry = (await call("GET", "/api/flood/tambon?code=140199")).json.data; // Ayutthaya is copied: never flooded
    expect(dry).toMatchObject({ last_seen: null, history: { years: [] } });
    expect((await call("GET", "/api/flood/tambon?code=909090")).status).toBe(404);
    expect((await call("GET", "/api/flood/tambon?code=12")).status).toBe(400);
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

  it("renames a place, refusing a label another place has", async () => {
    const sid = "rename-1";
    await chat(sid, { message: "บ้านแม่อยู่บางบาล อยุธยา น้ำจะถึงไหม" });
    const id = (await profile(sid)).places[0].id;
    const r = await call("PATCH", `/api/profile/places/${id}`, { label: "  บ้านคุณแม่ " }, undefined, sid);
    expect(r.status).toBe(200);
    expect(r.json.data.places[0].label).toBe("บ้านคุณแม่");
    expect((await call("PATCH", `/api/profile/places/${id}`, { label: " " }, undefined, sid)).status).toBe(400);
    expect((await call("PATCH", `/api/profile/places/${id}`, { label: "x" }, undefined, "theirs")).status).toBe(404);
    const names = { list: "immobile", from: "ยาย", to: "ยายสมศรี" };
    expect((await call("PATCH", "/api/profile/names", names, undefined, sid)).status).toBe(404);
    expect((await call("PATCH", "/api/profile/names", { ...names, list: "car" }, undefined, sid)).status).toBe(400);
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

  it("keeps consent per user: given once, it holds for later facts, other chats and the account", async () => {
    const say = async (sid: string, req: Record<string, unknown>, token?: string) =>
      (await call("POST", "/api/chat", { session_id: sid, ...req }, token)).json.data;
    const profile = async (sid: string, token?: string) =>
      (await call("GET", "/api/profile", undefined, token, sid)).json.data;

    // Anonymous: the browser's chat session is the user.
    await say("browser", { message: "ที่บ้านมียายติดเตียง" });
    await say("browser", { postback: "consent:sensitive_memory:yes" });
    const before = (await profile("browser")).facts.length;
    const again = await say("browser", { message: "ที่บ้านมีเด็กเล็กด้วย" });
    expect(again.quick_replies).toEqual([]);
    const facts = (await profile("browser")).facts;
    expect(facts.length).toBeGreaterThan(before);

    // Signing in folds it into the account, consent included; a chat from another device sees the same.
    const login = await call("POST", "/api/auth/line", { id_token: "demo:user:mali", chat_session: "browser" });
    expect(login.json.data.merged_chat).toBe(true);
    const t = login.json.data.session_token as string;
    const elsewhere = await profile("other-device", t);
    expect(elsewhere.consent.granted).toBe(true);
    expect(elsewhere.facts).toEqual(facts);
    expect((await say("other-device", { message: "ที่บ้านมีผู้ป่วย" }, t)).quick_replies).toEqual([]);

    // Erasing the account takes its memory and consent with it.
    await call("DELETE", "/api/me", undefined, t);
    const back = await call("POST", "/api/auth/line", { id_token: "demo:user:mali" });
    expect((await profile("x", back.json.data.session_token)).consent.granted).toBe(false);
  });
});
