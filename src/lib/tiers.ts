import type { RiskTier, StationSummary, TicketStatus, Urgency } from "../api/types";
import { copy } from "../copy";

export type TierKey = RiskTier | "unknown";

export interface TierInfo {
  key: TierKey;
  label: string;
  description: string;
  /** Fill colour, matches --color-tier-* in index.css. Never used as text colour. */
  color: string;
  /** Text colour to put on top of `color` (ink or white, by luminance; ≥ 4.5:1). */
  onColor: string;
  rank: number;
}

const COLORS: Record<TierKey, string> = {
  normal: "#64748b",
  watch: "#fab219",
  warning: "#ec835a",
  danger: "#d03b3b",
  unknown: "#a1a1aa",
};

const ON_COLORS: Record<TierKey, string> = {
  normal: "#ffffff",
  watch: "#0f172a",
  warning: "#0f172a",
  danger: "#ffffff",
  unknown: "#0f172a",
};

const RANK: Record<TierKey, number> = { unknown: -1, normal: 0, watch: 1, warning: 2, danger: 3 };

export const TIER_ORDER: TierKey[] = ["danger", "warning", "watch", "normal", "unknown"];

export function tierInfo(key: TierKey): TierInfo {
  return { key, ...copy.tier[key], color: COLORS[key], onColor: ON_COLORS[key], rank: RANK[key] };
}

/** A station with no risk row is "unknown", never "normal" (don't imply safety without data). */
export function stationTier(s: Pick<StationSummary, "risk">): TierKey {
  return s.risk?.tier ?? "unknown";
}

export const URGENCY_RANK: Record<Urgency, number> = { critical: 0, high: 1, normal: 2 };

export const ACTIVE_STATUSES: TicketStatus[] = ["open", "acknowledged", "in_progress"];
export const CLOSED_STATUSES: TicketStatus[] = ["resolved", "cancelled"];
