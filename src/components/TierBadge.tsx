import { tierInfo, type TierKey } from "../lib/tiers";

/**
 * Design system RiskBadge: the tier's Thai word plus its shape, never colour alone.
 * Solid once per card (next to the station name); `soft` in lists and tables.
 */
export function TierBadge({ tier, soft = false }: { tier: TierKey; soft?: boolean }) {
  return (
    <span className={`nm-badge nm-badge--${tier} ${soft ? "nm-badge--soft" : ""} shrink-0`}>{tierInfo(tier).label}</span>
  );
}

/** The tier shape alone, for places with no room for a badge (legend, river line). Pair it with the word. */
export function TierShape({ tier, className = "" }: { tier: TierKey; className?: string }) {
  return <span aria-hidden="true" className={`nm-shape nm-shape--${tier} ${TIER_INK[tier]} ${className}`} />;
}

/** Text colour for a shape sitting on surface/surface-raised (the "-ink" token: 4.5:1). */
export const TIER_INK: Record<TierKey, string> = {
  danger: "text-tier-danger-ink",
  warning: "text-tier-warning-ink",
  watch: "text-tier-watch-ink",
  normal: "text-tier-normal-ink",
  unknown: "text-ink-muted",
};
