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

/** Why /api/rivers listed a river: over or near its bank, the one by the given point, a fallback, or a search hit. */
export type RiverReason = "at_risk" | "near_you" | "largest" | "match";

/** One river, each gauged place once, upstream first (docs/api.md → Rivers). */
export interface River {
  /** The river name, or "<name>@<lowest station id>" for a second river of the same name. */
  key: string;
  name_th: string;
  basins: string[];
  /** Upstream first; tells two same-named rivers apart. */
  provinces: string[];
  worst_tier: RiskTier | null;
  reason: RiverReason;
  /** To its nearest station, when the request gave lat/lon. */
  distance_km: number | null;
  stations: StationSummary[];
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

// --- flood (GISTDA satellite) -----------------------------------------------

/** GISTDA's layers, shortest first: each one's cells were seen under water within that many days. */
export type FloodPeriod = "3days" | "7days" | "30days";
export type FloodLevel = "province" | "amphoe" | "tambon";

/** The stored GISTDA layer. All null before the first download: say "no data yet", never "no flooding". */
export interface FloodLayer {
  period: FloodPeriod;
  /** When the backend downloaded the layer. */
  fetched_at: string | null;
  /** Span of GISTDA's satellite scenes in the layer (30 days: about a month). */
  observed_from: string | null;
  observed_to: string | null;
}

export interface FloodArea {
  /** Names without จ./อ./ต.; null when GISTDA gives only a code. */
  province: string | null;
  amphoe: string | null;
  tambon: string | null;
  code: string | null;
  /** Flooded H3 cells (res 9, ~0.1 km²). */
  cells: number;
  area_km2: number;
  area_rai: number;
  /** Area-weighted centre of the cells, to fly the map there. */
  lat: number | null;
  lon: number | null;
  /** Sums of GISTDA's counts in the cells; null when GISTDA sent none (unknown, not 0). Optional: older backends. */
  buildings?: number | null;
  population?: number | null;
}

export interface FloodAreas extends FloodLayer {
  level: FloodLevel;
  total: { cells: number; area_km2: number; area_rai: number };
  areas: FloodArea[];
}

export interface FloodCell {
  h3: string;
  /** How many res-9 cells it sums (1 at res 9). */
  cells: number;
  area_km2: number;
  /** Flooded part of the cell, 0–1. */
  share: number;
  /**
   * How lately water was seen there: the shortest layer that also holds the cell (a parent: its freshest cell). With
   * period 30days, "30days" = seen only 8–30 days ago. Absent from older backends.
   */
  seen?: FloodPeriod;
  /** res 9 only. */
  province?: string | null;
  amphoe?: string | null;
  tambon?: string | null;
  observed_at?: string | null;
  /** res 9 only: GISTDA's counts in the cell, null when not sent. */
  buildings?: number | null;
  population?: number | null;
  schools?: number | null;
  hospitals?: number | null;
}

/** Flooding around one point (a saved place), from the same layer. */
export interface FloodNear extends FloodLayer {
  /** The point's own cell is flooded. */
  at_point: boolean;
  /** Nearest flooded cell; null when none within radius_km. */
  nearest_km: number | null;
  radius_km: number;
  nearby: { cells: number; area_km2: number; area_rai: number };
}

export interface FloodCells extends FloodLayer {
  res: number;
  /** More cells in view than the limit: the largest are sent. */
  truncated: boolean;
  cells: FloodCell[];
  /** The layer and every shorter one, shortest first (their dates label the legend). Absent from older backends. */
  windows?: FloodLayer[];
}

/** One layer's flooding in one tambon. */
export interface FloodTambonWindow extends FloodLayer {
  cells: number;
  area_km2: number;
  area_rai: number;
  buildings: number | null;
  population: number | null;
}

/** Everything we hold on one tambon (/api/flood/tambon): this season, our own record, and 2011–. */
export interface FloodTambon {
  /** GISTDA tb_idn, the same as the map outlines' code. */
  code: string;
  province: string | null;
  amphoe: string | null;
  tambon: string | null;
  /** One per layer, shortest first. */
  windows: FloodTambonWindow[];
  /** The shortest layer with water in the tambon; null = none in any stored layer. */
  last_seen: FloodPeriod | null;
  /** Our daily copy of the layers there, oldest first; it starts the day we started keeping it. */
  record: { day: string; period: FloodPeriod; cells: number; area_km2: number; area_rai: number }[];
  /** Its 2011– record; years [] = never flooded; null = its province is not copied yet. */
  history: { years_covered: number[]; years: number[]; rai_by_year: Record<string, number> } | null;
  source: "GISTDA";
}

/** One area's flood history (our copy of GISTDA's 2011– record, /api/flood/history). */
export interface FloodHistoryArea {
  /** GISTDA pv_idn / tb_idn: the same as the map outlines' code. */
  code: string;
  province: string | null;
  amphoe: string | null;
  tambon: string | null;
  /** Years with any flooding, ascending. */
  years: number[];
  /** Flooded rai per year ("2011" → rai), only the flooded years. */
  rai_by_year: Record<string, number>;
}

export interface FloodHistory {
  level: "province" | "tambon";
  province: string | null;
  /** Every year the record covers, e.g. 2011…2024; empty before the first province is copied. */
  years: number[];
  /** Province codes copied so far: an area missing from `areas` there never flooded; elsewhere it is unknown. */
  provinces: string[];
  /** Worst year's rai first. */
  areas: FloodHistoryArea[];
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
      /** What the ShelterCard draws. Optional: older backends send only the fields above. */
      lat?: number;
      lon?: number;
      district?: string | null;
      province?: string | null;
      /** DDPM live status: null = DDPM doesn't say. */
      is_open?: boolean | null;
      capacity?: number | null;
      current_residents?: number | null;
      /** Present only when it says something: known, or the household needs it. null = DDPM doesn't say. */
      patients_ok?: boolean | null;
      source?: "ddpm" | "manual" | null;
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
  /** The point a risk or shelter answer is about: the reply links to the flood map there. Optional: older backends. */
  place?: ChatPlace | null;
}

export interface ChatPlace {
  label: string;
  lat: number;
  lon: number;
  /** Found from a place name (a district centre), not a GPS share. */
  approx: boolean;
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

/** Names the person gave, which can be renamed: who can't walk, pets, past floods (one fact each). */
export type NameList = "immobile" | "pets" | "past_floods";

export interface Fact {
  kind: FactKind;
  text: string;
  /** Health or vulnerability: saved only with consent (PDPA). */
  sensitive: boolean;
  /** The name list this line shows; null for checklist facts (มีรถยนต์, บ้าน 2 ชั้น), which have no name. */
  list: NameList | null;
  names: string[];
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

export interface SessionUser {
  display_name: string;
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
