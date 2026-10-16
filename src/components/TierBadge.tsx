import { tierInfo, type TierKey } from "../lib/tiers";

/**
 * Tier as fill + Thai label (never colour alone). Raised tiers are solid with ink/white text
 * chosen for contrast; normal/unknown stay quiet (neutral chip + dot) so they don't read as alarms
 * or as "safe".
 */
export function TierBadge({ tier, size = "md" }: { tier: TierKey; size?: "sm" | "md" }) {
  const t = tierInfo(tier);
  const raised = t.rank >= 1;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      } ${raised ? "" : "bg-slate-100 text-slate-700"}`}
      style={raised ? { background: t.color, color: t.onColor } : undefined}
    >
      {!raised && <TierDot tier={tier} />}
      {t.label}
    </span>
  );
}

export function TierDot({ tier, className = "" }: { tier: TierKey; className?: string }) {
  const t = tierInfo(tier);
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2.5 shrink-0 rounded-full ${className}`}
      style={
        tier === "unknown"
          ? { border: "1.5px dashed #71717a", background: "transparent" }
          : { background: t.color, boxShadow: "0 0 0 1px rgba(15,23,42,0.15)" }
      }
    />
  );
}
