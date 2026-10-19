// Scripted stand-in for the agent (CLAUDE.md §6), following the demo in §15.
// Real mode: the backend LLM writes the words. Here, as there, every number comes from
// station/shelter data, never from the script itself.
import { copy } from "../../copy";
import { formatBankGap, formatDistance, formatHoursToBank, formatTime, formatTrend } from "../../lib/format";
import { stationTier, tierInfo, type TierKey } from "../../lib/tiers";
import type { ChatRequest, ChatResponse, NearbyStation, QuickReply, Shelter, Source, Vulnerable } from "../types";

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

/** A place the user named or shared, as the backend's user_locations keeps it. */
export interface SavedPlaceState {
  id: number;
  label: string;
  lat: number;
  lon: number;
  approx: boolean;
  where: string | null;
}

export interface ChatSessionState {
  place: Place | null;
  /** Saved places (the profile panel). Optional: sessions stored before it existed lack it. */
  places?: SavedPlaceState[];
  /** When consent was last decided. */
  consentTs?: string | null;
  /** Household facts usable in this conversation. Saved to memory only with consent. */
  household: Vulnerable[];
  consent: boolean | null;
  pendingConsent: Vulnerable[] | null;
}

export interface ChatDeps {
  nearest(lat: number, lon: number, k: number): NearbyStation[];
  shelters(lat: number, lon: number, patientsOnly: boolean): Shelter[];
}

export function emptyChatState(): ChatSessionState {
  return { place: null, places: [], consentTs: null, household: [], consent: null, pendingConsent: null };
}

// --- text understanding (the LLM's job in real mode) ---------------------------

// Approximate district centres along the demo corridor. Specific names before general ones.
export const PLACES: { match: RegExp; place: Place }[] = [
  { match: /บางบาล/, place: { label: "อ.บางบาล จ.พระนครศรีอยุธยา", lat: 14.369, lon: 100.474 } },
  { match: /บ้านป้อม/, place: { label: "ต.บ้านป้อม จ.พระนครศรีอยุธยา", lat: 14.373, lon: 100.535 } },
  { match: /บางปะอิน/, place: { label: "อ.บางปะอิน จ.พระนครศรีอยุธยา", lat: 14.235, lon: 100.58 } },
  { match: /บางปะหัน/, place: { label: "อ.บางปะหัน จ.พระนครศรีอยุธยา", lat: 14.46, lon: 100.55 } },
  { match: /เสนา/, place: { label: "อ.เสนา จ.พระนครศรีอยุธยา", lat: 14.327, lon: 100.405 } },
  { match: /อยุธยา|เกาะเมือง/, place: { label: "อ.พระนครศรีอยุธยา", lat: 14.355, lon: 100.565 } },
  { match: /อ่างทอง/, place: { label: "อ.เมืองอ่างทอง", lat: 14.59, lon: 100.455 } },
  { match: /สิงห์บุรี/, place: { label: "อ.เมืองสิงห์บุรี", lat: 14.89, lon: 100.4 } },
  { match: /ชัยนาท/, place: { label: "อ.เมืองชัยนาท", lat: 15.185, lon: 100.125 } },
  { match: /นครสวรรค์/, place: { label: "อ.เมืองนครสวรรค์", lat: 15.7, lon: 100.13 } },
  { match: /นนทบุรี/, place: { label: "อ.เมืองนนทบุรี", lat: 13.86, lon: 100.515 } },
  { match: /สามเสน|กรุงเทพ/, place: { label: "กรุงเทพฯ (ริมเจ้าพระยา)", lat: 13.79, lon: 100.51 } },
];

const OUT_OF_AREA = /บางระกำ|พิษณุโลก|สุโขทัย|เชียงใหม่|เชียงราย|อุบล|ขอนแก่น|หาดใหญ่|สงขลา|นครราชสีมา|โคราช|ภูเก็ต/;
const DANGER = /น้ำเข้าบ้าน|ติดอยู่|ติดค้าง|ช่วยด้วย|ช่วยที|ออกไม่ได้|ออกไปไหนไม่ได้|จมน้ำ|ต้องการความช่วยเหลือ|น้ำท่วมถึงชั้น/;
const SHELTER = /ศูนย์พักพิง|ที่พักพิง|อพยพไปที่ไหน|อพยพไปไหน|ไปพักที่ไหน/;
const MEMORY = /จำอะไร|ข้อมูลอะไรที่จำ|ข้อมูลของฉัน/;
const RISK = /น้ำ|ท่วม|ตลิ่ง|ระดับ/;
const NO_HOUSEHOLD = /ไม่มีผู้ที่ต้องดูแล|^ไม่มี/;

const VULNERABLE_PATTERNS: [Vulnerable, RegExp][] = [
  ["elderly", /ยาย|ปู่|ผู้สูงอายุ|คนแก่|คุณตา|คุณย่า|อายุ\s*[6-9]\d/],
  ["bedridden", /ติดเตียง|เดินไม่ได้|ลุกไม่ได้/],
  ["infant", /ทารก|เด็กอ่อน|ลูกอ่อน/],
  ["child", /เด็กเล็ก|เด็ก(?!อ่อน)|ลูกเล็ก/],
  ["pregnant", /ตั้งครรภ์|คนท้อง|ท้อง\s*\d/],
  ["disabled", /พิการ|รถเข็น|เดินไม่สะดวก/],
  ["patient", /ผู้ป่วย(?!ติดเตียง)|ป่วยหนัก/],
  ["pet", /หมา|แมว|สุนัข|สัตว์เลี้ยง/],
];

/** "บ้านแม่อยู่บางบาล" → "บ้านแม่"; first-person homes collapse to "บ้าน" (as agent/memory.py). */
export function locationLabel(text: string): string | null {
  const m = text.replace(/\s/g, "").match(/(บ้าน\S{0,12}?)(?:อยู่|ที่|แถว)/);
  if (!m) return null;
  return /^บ้าน(ผม|ฉัน|หนู|เรา|ดิฉัน|ตัวเอง)?$/.test(m[1]) ? "บ้าน" : m[1];
}

/** Upsert by label, like tools.save_location. */
export function savePlace(s: ChatSessionState, p: Omit<SavedPlaceState, "id">): void {
  const places = (s.places ??= []);
  const existing = places.find((x) => x.label === p.label);
  if (existing) Object.assign(existing, p);
  else places.push({ id: Math.max(0, ...places.map((x) => x.id)) + 1, ...p });
}

export function findPlace(text: string): Place | null {
  return PLACES.find((p) => p.match.test(text))?.place ?? null;
}

export function extractVulnerable(text: string): Vulnerable[] {
  return VULNERABLE_PATTERNS.filter(([, re]) => re.test(text)).map(([v]) => v);
}

const union = <T,>(a: T[], b: T[]): T[] => [...new Set([...a, ...b])];
const listVulnerable = (v: Vulnerable[]) => v.map((x) => copy.vulnerable[x]).join(", ");

// --- replies ------------------------------------------------------------------

function reply(text: string, extra: Partial<ChatResponse> = {}): ChatResponse {
  return { reply: text, sources: [], quick_replies: [], emergency: false, ...extra };
}

function stationSource(s: NearbyStation): Source {
  const level = s.latest?.level_msl ?? null;
  const diff = s.latest?.diff_wl_bank ?? null;
  return {
    type: "station",
    station_id: s.id,
    code: s.oldcode,
    name_th: s.name_th,
    distance_km: s.distance_km,
    observed_at: s.latest?.ts ?? null,
    river: s.river,
    agency: s.agency,
    amphoe: s.amphoe,
    province: s.province,
    level_msl: level,
    diff_wl_bank: diff,
    bank_msl: level != null && diff != null ? Math.round((level - diff) * 100) / 100 : null,
    trend_cm_per_hr: s.risk?.trend_cm_per_hr ?? null,
    hours_to_bank: s.risk?.hours_to_bank ?? null,
    risk_tier: s.risk?.tier ?? null,
    upstream_over: [],
  };
}

function stationName(s: NearbyStation): string {
  return `${s.oldcode ?? ""} ${s.name_th ?? ""}`.trim();
}

const ASK_LOCATION: QuickReply[] = [
  { type: "location", label: copy.chat.shareLocation },
  { type: "message", label: "บางบาล อยุธยา", text: "บ้านอยู่บางบาล อยุธยา น้ำจะถึงไหม" },
];

const HOUSEHOLD_QR: QuickReply[] = [
  { type: "message", label: "มียายติดเตียง", text: "ที่บ้านมียายติดเตียง" },
  { type: "message", label: "มีเด็กเล็ก", text: "ที่บ้านมีเด็กเล็ก" },
  { type: "message", label: "ไม่มี", text: "ไม่มีผู้ที่ต้องดูแลพิเศษ" },
];

function advice(tier: TierKey, household: Vulnerable[]): string {
  const vulnerable = household.filter((v) => v !== "pet");
  const early = vulnerable.length
    ? `\nเพราะที่บ้านมี${listVulnerable(vulnerable)} ควรพิจารณาย้ายไปศูนย์พักพิงก่อน ไม่ต้องรอให้น้ำเข้าบ้าน`
    : "";
  switch (tier) {
    case "danger":
      return (
        "สิ่งที่ควรทำตอนนี้ ถ้าบ้านอยู่ที่ต่ำหรือใกล้ริมน้ำ:\n" +
        "• ยกของและปลั๊กไฟขึ้นที่สูง ย้ายรถไปที่สูง\n" +
        "• เตรียมยา เอกสารสำคัญ น้ำดื่ม ไฟฉาย\n" +
        "• พร้อมอพยพทันทีเมื่อทางการแจ้ง" +
        early
      );
    case "warning":
      return (
        "สิ่งที่ควรทำตอนนี้:\n• เตรียมยกของขึ้นที่สูงและย้ายรถ\n• เตรียมกระเป๋าฉุกเฉิน (ยา เอกสาร น้ำดื่ม ไฟฉาย)\n• ติดตามประกาศทางการ" +
        early
      );
    case "watch":
      return "น้ำกำลังขึ้นและใกล้ตลิ่ง ควรเตรียมกระเป๋าฉุกเฉินและติดตามระดับน้ำทุกชั่วโมง" + early;
    case "normal":
      return "ระดับน้ำที่สถานียังต่ำกว่าตลิ่ง แต่สถานการณ์เปลี่ยนได้ ควรติดตามต่อเนื่อง";
    default:
      return "ข้อมูลสถานีไม่พอประเมิน ควรติดตามประกาศของทางการ";
  }
}

function riskAnswer(place: Place, s: ChatSessionState, deps: ChatDeps): ChatResponse {
  const near = deps.nearest(place.lat, place.lon, 4);
  if (!near.length) return reply("ไม่พบสถานีวัดน้ำใกล้ตำแหน่งนี้", { quick_replies: ASK_LOCATION });

  const primary = near[0];
  const rank = (x: NearbyStation) => tierInfo(stationTier(x)).rank * 100 + (x.latest?.diff_wl_bank ?? -99);
  const worst = near.filter((n) => n.distance_km <= 15).reduce((a, b) => (rank(b) > rank(a) ? b : a), primary);

  const lines = [
    `ใกล้ ${place.label} สถานีวัดน้ำที่ใกล้ที่สุดคือ ${stationName(primary)}${primary.river ? ` (${primary.river})` : ""} ห่างประมาณ ${formatDistance(primary.distance_km)}`,
    `เมื่อ ${formatTime(primary.latest?.ts)} ระดับน้ำที่สถานี${formatBankGap(primary.latest?.diff_wl_bank)} แนวโน้ม 3 ชม. ${formatTrend(primary.risk?.trend_cm_per_hr)}` +
      (formatHoursToBank(primary.risk?.hours_to_bank) ? ` อาจถึงตลิ่งใน${formatHoursToBank(primary.risk?.hours_to_bank)}` : ""),
  ];
  if (worst.id !== primary.id && tierInfo(stationTier(worst)).rank > tierInfo(stationTier(primary)).rank) {
    const worstTier = stationTier(worst);
    lines.push(
      `ส่วนสถานี ${stationName(worst)}${worst.river ? ` (${worst.river})` : ""} ห่าง ${formatDistance(worst.distance_km)} ${formatBankGap(worst.latest?.diff_wl_bank)}` +
        (worstTier === "danger" ? "" : ` (${tierInfo(worstTier).label})`),
    );
  }
  lines.push("", advice(stationTier(worst), s.household), "", copy.station.stationNotHouse + " เหตุฉุกเฉินโทร 1784");

  const askHousehold = s.household.length === 0 && s.consent === null;
  if (askHousehold) lines.push("", "ที่บ้านมีผู้สูงอายุ เด็กเล็ก หรือผู้ป่วยที่ต้องดูแลเป็นพิเศษไหม จะได้แนะนำให้ตรงขึ้น");

  const sources = [stationSource(primary)];
  if (worst.id !== primary.id) sources.push(stationSource(worst));
  return reply(lines.join("\n"), {
    sources,
    quick_replies: askHousehold
      ? HOUSEHOLD_QR
      : [{ type: "message", label: "ศูนย์พักพิงใกล้บ้าน", text: "ศูนย์พักพิงใกล้บ้านมีที่ไหนบ้าง" }],
  });
}

function shelterAnswer(place: Place | null, s: ChatSessionState, deps: ChatDeps): ChatResponse {
  if (!place) return reply("บอกตำแหน่งหรือชื่ออำเภอก่อน จะหาศูนย์พักพิงที่ใกล้ที่สุดให้", { quick_replies: ASK_LOCATION });
  const needsCare = s.household.some((v) => v === "bedridden" || v === "patient");
  const list = deps.shelters(place.lat, place.lon, needsCare).slice(0, 3);
  if (!list.length) return reply("ยังไม่มีข้อมูลศูนย์พักพิงใกล้ตำแหน่งนี้ สอบถาม ปภ. 1784");
  const lines = [
    needsCare ? `ศูนย์พักพิงที่รับผู้ป่วย ใกล้ ${place.label}:` : `ศูนย์พักพิงใกล้ ${place.label}:`,
    ...list.map(
      (sh) =>
        `• ${sh.name} ห่าง ${formatDistance(sh.distance_km)}` +
        (sh.accepts_patients ? " · รับผู้ป่วย" : "") +
        (sh.accepts_pets ? " · รับสัตว์เลี้ยง" : ""),
    ),
    "",
    "ก่อนเดินทาง โทรสอบถาม ปภ. 1784 ว่าศูนย์ยังรับคนได้",
  ];
  return reply(lines.join("\n"), {
    sources: list.map((sh) => ({ type: "shelter", shelter_id: sh.id, name: sh.name, distance_km: sh.distance_km })),
  });
}

/** Danger: the hotline first. NamMa sends nothing on the person's behalf, so it says so and lists what to tell 1784. */
function emergencyAnswer(text: string, s: ChatSessionState): ChatResponse {
  const place = findPlace(text) ?? s.place;
  const vulnerable = union(extractVulnerable(text), s.household);
  const tell = [
    place && `• ตำแหน่ง: ${place.label}`,
    vulnerable.length > 0 && `• ผู้ที่ต้องช่วยเป็นพิเศษ: ${listVulnerable(vulnerable)}`,
  ].filter(Boolean);
  const lines = [
    "ถ้าอยู่ในอันตรายตอนนี้ โทร 1784 ได้ทันที",
    "น้ำมาไม่ได้ส่งเรื่องให้หน่วยกู้ภัย ต้องโทรแจ้งเอง",
    ...(tell.length ? ["ตอนโทร แจ้งว่า:", ...tell] : []),
    "ระหว่างรอ:",
    "• ขึ้นไปชั้นบนหรือที่สูง พาผู้ที่เดินไม่ได้ขึ้นก่อน",
    "• ตัดไฟชั้นล่างถ้าทำได้โดยไม่ต้องลุยน้ำ",
    "• เตรียมยา น้ำดื่ม ไฟฉาย และเปิดโทรศัพท์ไว้",
    "• ถ้าสถานการณ์แย่ลง โทร 1784 ซ้ำได้ทันที",
  ];
  return reply(lines.join("\n"), { emergency: true });
}

function handlePostback(data: string, s: ChatSessionState, deps: ChatDeps): ChatResponse {
  if (data.startsWith("consent:sensitive_memory:")) {
    const granted = data.endsWith(":yes");
    const facts = s.pendingConsent ?? [];
    s.household = union(s.household, facts);
    s.consent = granted;
    s.consentTs = new Date().toISOString();
    s.pendingConsent = null;
    if (!granted) return reply("ไม่บันทึก จะใช้ข้อมูลนี้เฉพาะในการสนทนานี้เท่านั้น");
    const lines = [`บันทึกแล้ว: ที่บ้านมี${listVulnerable(facts)} ลบได้ทุกเมื่อโดยพิมพ์ "ข้อมูลอะไรที่จำเกี่ยวกับฉัน"`];
    let sources: Source[] = [];
    if (s.place && facts.some((v) => v === "bedridden" || v === "patient")) {
      const sh = deps.shelters(s.place.lat, s.place.lon, true)[0];
      if (sh) {
        lines.push(
          `ถ้าระดับน้ำใกล้จุดเสี่ยง น้ำมาจะแจ้งเตือนให้อพยพเร็วขึ้น ศูนย์พักพิงที่รับผู้ป่วยใกล้ที่สุดคือ ${sh.name} ห่าง ${formatDistance(sh.distance_km)}`,
        );
        sources = [{ type: "shelter", shelter_id: sh.id, name: sh.name, distance_km: sh.distance_km }];
      }
    }
    return reply(lines.join("\n"), { sources });
  }
  if (data === "memory:delete_all") {
    s.household = [];
    s.places = [];
    s.consent = null;
    return reply("ลบข้อมูลที่จำไว้ทั้งหมดแล้ว");
  }
  return fallback();
}

function fallback(): ChatResponse {
  return reply("ยังไม่เข้าใจคำถาม ลองถามเรื่องระดับน้ำใกล้บ้าน หรือส่งตำแหน่งมาได้", {
    quick_replies: ASK_LOCATION,
  });
}

export function respond(req: ChatRequest, s: ChatSessionState, deps: ChatDeps): ChatResponse {
  if (req.postback) return handlePostback(req.postback, s, deps);

  if (req.location) {
    const place = { label: "ตำแหน่งที่ส่งมา", ...req.location };
    s.place = place;
    savePlace(s, { label: s.places?.length ? "ตำแหน่งที่แชร์" : "บ้าน", ...req.location, approx: false, where: null });
    return riskAnswer(place, s, deps);
  }

  const text = (req.message ?? "").trim();
  if (!text) return fallback();

  if (DANGER.test(text)) return emergencyAnswer(text, s);

  if (OUT_OF_AREA.test(text) && !findPlace(text)) {
    return reply(
      "ตอนนี้น้ำมาทดลองเฉพาะลุ่มเจ้าพระยา ตั้งแต่นครสวรรค์ถึงกรุงเทพฯ ยังไม่มีข้อมูลสถานีสำหรับพื้นที่นี้\nส่งตำแหน่งหรือพิมพ์อำเภอในลุ่มเจ้าพระยาได้ หรือติดตามประกาศ ปภ. 1784",
      { quick_replies: ASK_LOCATION },
    );
  }

  const place = findPlace(text);
  if (SHELTER.test(text)) return shelterAnswer(place ?? s.place, s, deps);

  if (MEMORY.test(text)) {
    if (!s.consent || s.household.length === 0) return reply("ตอนนี้ยังไม่ได้บันทึกข้อมูลส่วนตัวของคุณ");
    return reply(`ข้อมูลที่จำไว้:\n• สมาชิกในบ้าน: ${listVulnerable(s.household)}`, {
      quick_replies: [{ type: "postback", label: "ลบข้อมูลทั้งหมด", data: "memory:delete_all", display_text: "ลบข้อมูลทั้งหมด" }],
    });
  }

  if (NO_HOUSEHOLD.test(text)) {
    s.consent = s.consent ?? false;
    return reply("รับทราบ ถ้าระดับน้ำเปลี่ยน ถามได้ตลอด");
  }

  const facts = extractVulnerable(text);
  if (facts.length && !place) {
    s.pendingConsent = facts;
    return reply(
      `ขออนุญาตจำข้อมูลนี้ (${listVulnerable(facts)}) เพื่อแจ้งเตือนและช่วยเหลือได้เร็วขึ้นไหม\nข้อมูลสุขภาพเป็นข้อมูลอ่อนไหว จะใช้เพื่อแจ้งเตือนและช่วยเหลือเท่านั้น และลบได้ทุกเมื่อ`,
      {
        quick_replies: [
          { type: "postback", label: "อนุญาต", data: "consent:sensitive_memory:yes", display_text: "อนุญาต" },
          { type: "postback", label: "ไม่อนุญาต", data: "consent:sensitive_memory:no", display_text: "ไม่อนุญาต" },
        ],
      },
    );
  }

  if (place) {
    s.place = place;
    const label = locationLabel(text);
    if (label) savePlace(s, { label, lat: place.lat, lon: place.lon, approx: true, where: place.label });
    return riskAnswer(place, s, deps);
  }
  if (RISK.test(text)) {
    if (s.place) return riskAnswer(s.place, s, deps);
    return reply("บอกตำแหน่งบ้านหรือชื่ออำเภอได้ไหม จะดูสถานีวัดน้ำที่ใกล้ที่สุดให้", { quick_replies: ASK_LOCATION });
  }
  return fallback();
}
