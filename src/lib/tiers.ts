import type { RiskTier, StationSummary, TicketStatus, Urgency } from "../api/types";
import { copy } from "../copy";

export type TierKey = RiskTier | "unknown";

export interface TierInfo {
  key: TierKey;
  label: string;
  description: string;
  rank: number;
}

// Colours and shapes live in CSS (nm-badge--{tier}, nm-shape--{tier}, nm-pin--{tier}), from the
// NamMa design system tokens. A tier always shows its word and its shape, never colour alone.
const RANK: Record<TierKey, number> = { unknown: -1, normal: 0, watch: 1, warning: 2, danger: 3 };

export const TIER_ORDER: TierKey[] = ["danger", "warning", "watch", "normal", "unknown"];

export function tierInfo(key: TierKey): TierInfo {
  return { key, ...copy.tier[key], rank: RANK[key] };
}

/** A station with no risk row is "unknown", never "normal" (don't imply safety without data). */
export function stationTier(s: Pick<StationSummary, "risk">): TierKey {
  return s.risk?.tier ?? "unknown";
}

/** Rescue urgency reuses the tier colours on purpose: responders already read them (DS TicketRow). */
export const URGENCY_TIER: Record<Urgency, Exclude<TierKey, "unknown" | "watch">> = {
  critical: "danger",
  high: "warning",
  normal: "normal",
};

export const URGENCY_RANK: Record<Urgency, number> = { critical: 0, high: 1, normal: 2 };

export const ACTIVE_STATUSES: TicketStatus[] = ["open", "acknowledged", "in_progress"];
export const CLOSED_STATUSES: TicketStatus[] = ["resolved", "cancelled"];

/**
 * Why a station has its tier, in words (DS: show the reason next to any watch or warning badge).
 * Only restates the rule (CLAUDE.md §8) with numbers the risk job computed; never invents one.
 */
export function tierReason(tier: TierKey, hoursToBank: number | null | undefined, upstreamOver = false): string | null {
  switch (tier) {
    case "danger":
      return "ระดับน้ำสูงกว่าตลิ่งแล้ว";
    case "warning":
      if (hoursToBank != null && hoursToBank >= 0 && hoursToBank < 6)
        return `ถึงตลิ่งในราว ${Math.max(1, Math.round(hoursToBank))} ชม.`;
      return upstreamOver ? "ต้นน้ำล้นตลิ่ง" : "อาจถึงตลิ่งภายใน 6 ชม.";
    case "watch":
      return "น้ำกำลังขึ้น ห่างตลิ่งไม่ถึง 0.5 ม.";
    default:
      return null;
  }
}
