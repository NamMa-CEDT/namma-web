// API contract between the web app and the FastAPI backend.
// Source of truth together with docs/api.md; keep both in sync.
//
// Conventions:
// - Every 2xx response is an Envelope<T>: { data, meta }.
// - Errors are { error: { code, message } } with a 4xx/5xx status.
// - Timestamps are ISO-8601 with an offset. The client displays them in Asia/Bangkok.
// - Every number shown to users comes from these responses (CLAUDE.md §2 rule 1).

export interface Meta {
  /** When the backend last ingested ThaiWater data. Drives the "data is stale" banner. */
  ingested_at: string | null;
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

// --- stations ---------------------------------------------------------------

export type RiskTier = "normal" | "watch" | "warning" | "danger";

export interface LatestReading {
  ts: string;
  level_msl: number;
  /** Signed metres: + above bank (overflow), - below bank. */
  diff_wl_bank: number | null;
  /** ThaiWater situation level 1–5; missing on some records. */
  situation_level: number | null;
  /** m³/s, RID stations only. */
  discharge: number | null;
}

export interface StationRisk {
  tier: RiskTier;
  trend_cm_per_hr: number | null;
  /** Hours until the level reaches the bank at the current trend; null if not rising or already over. */
  hours_to_bank: number | null;
  computed_at: string;
}

export interface StationSummary {
  id: number;
  oldcode: string | null;
  name_th: string | null;
  name_en: string | null;
  lat: number;
  lon: number;
  river: string | null;
  province: string | null;
  amphoe: string | null;
  /** HII, RID, EGAT… */
  agency: string | null;
  is_key_station: boolean;
  /** Position along the demo corridor, upstream → downstream. Null off the main stem. */
  stem_order: number | null;
  role: "main" | "branch" | "tributary" | null;
  latest: LatestReading | null;
  risk: StationRisk | null;
}

export interface NearbyStation extends StationSummary {
  distance_km: number;
}

export interface StationLink {
  station: StationSummary;
  approx_travel_hours: number | null;
}

export interface StationDetail extends StationSummary {
  left_bank: number | null;
  right_bank: number | null;
  min_bank: number | null;
  ground_level: number | null;
  critical_level_msl: number | null;
  upstream: StationLink[];
  downstream: StationLink[];
}

export interface Reading {
  ts: string;
  level_msl: number;
  diff_wl_bank: number | null;
  discharge: number | null;
}

export interface StationReadings {
  station_id: number;
  readings: Reading[];
}

// --- shelters ---------------------------------------------------------------

export interface Shelter {
  id: number;
  name: string;
  lat: number;
  lon: number;
  capacity: number | null;
  accepts_patients: boolean;
  accepts_pets: boolean;
  phone: string | null;
  /** Present when the request had lat/lon. */
  distance_km: number | null;
  /** DDPM live status (backend ingest/shelters.py). Optional: the mock fixtures don't have them. */
  is_open?: boolean | null;
  current_residents?: number | null;
  /** true / false / null = DDPM doesn't say (most shelters). accepts_patients is true only when this is true. */
  accepts_bedridden?: boolean | null;
  province?: string | null;
  district?: string | null;
  source?: "ddpm" | "manual";
  updated_at?: string | null;
}

// --- household (what the chat may remember, with consent) -------------------

export type Vulnerable =
  | "elderly"
  | "bedridden"
  | "child"
  | "infant"
  | "pregnant"
  | "disabled"
  | "patient"
  | "pet";

// --- chat -------------------------------------------------------------------

export type Source =
  | {
      type: "station";
      station_id: number;
      code: string | null;
      name_th: string | null;
      distance_km: number | null;
      observed_at: string | null;
      /** The reading the reply used, for the StationCard. Optional: older backends send only the fields above. */
      river?: string | null;
      agency?: string | null;
      amphoe?: string | null;
      province?: string | null;
      level_msl?: number | null;
      /** Signed: + over bank, − below. */
      diff_wl_bank?: number | null;
      bank_msl?: number | null;
      /** 3 h trend. */
      trend_cm_per_hr?: number | null;
      hours_to_bank?: number | null;
      risk_tier?: RiskTier | null;
      /** Codes of upstream stations already over bank. */
      upstream_over?: string[];
    }
  | {
      type: "gistda";
      kind: "flood_extent" | "flood_recurrence";
      summary: string;
      observed_at: string | null;
    }
  | {
      type: "shelter";
      shelter_id: number;
      name: string;
      distance_km: number | null;
    };

/** Mirrors LINE quick-reply actions so one backend handler serves LINE and web. */
export type QuickReply =
  | { type: "message"; label: string; text: string }
  | { type: "postback"; label: string; data: string; display_text?: string }
  | { type: "location"; label: string };

export interface LatLon {
  lat: number;
  lon: number;
}

export interface ChatRequest {
  session_id: string;
  /** Exactly one of message / postback / location. */
  message?: string;
  postback?: string;
  location?: LatLon;
}

export interface ChatResponse {
  reply: string;
  sources: Source[];
  quick_replies: QuickReply[];
  /** True when the user signalled danger. The UI then shows the DDPM 1784 card first. */
  emergency: boolean;
}

// --- profile ----------------------------------------------------------------

export interface SavedPlace {
  id: number;
  /** Exactly as the user said it: "บ้านแม่". */
  label: string;
  lat: number;
  lon: number;
  /** Geocoded from a place name, not a GPS share. */
  approx: boolean;
  /** "อ.บางบาล จ.พระนครศรีอยุธยา" */
  where: string | null;
  nearest: {
    station_id: number;
    code: string | null;
    name_th: string | null;
    distance_km: number;
    risk_tier: RiskTier | null;
    diff_wl_bank: number | null;
    observed_at: string | null;
  } | null;
}

export type FactKind = "household" | "needs" | "house" | "assets" | "history";

export interface Fact {
  kind: FactKind;
  text: string;
  /** Health or vulnerability: saved only with consent (PDPA). */
  sensitive: boolean;
}

export interface Profile {
  places: SavedPlace[];
  facts: Fact[];
  /** Latest sensitive_memory decision; ts null = never asked. */
  consent: { granted: boolean; ts: string | null };
  pending_consent: boolean;
  line_linked: boolean;
}

// --- auth -------------------------------------------------------------------

export type Role = "user" | "responder";

export interface SessionUser {
  display_name: string;
  role: Role;
  picture_url: string | null;
  /** Ways to sign in to this account: LINE (also gets LINE alerts) and Google (its email). */
  identities?: { line: boolean; google: string | null };
}

export interface LoginResponse {
  session_token: string;
  user: SessionUser;
  /** The anonymous web chat (chat_session) was folded into the account. */
  merged_chat?: boolean;
}

export type Provider = "line" | "google";
