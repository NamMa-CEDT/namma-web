import { Link } from "react-router";
import { copy } from "../copy";
import { formatBankGap } from "../lib/format";
import { crossSection } from "../lib/riverShapes";
import { stationTier, tierInfo, type TierKey } from "../lib/tiers";
import { RiverNote, type River } from "./RiverProfile";
import { TIER_INK, TierShape } from "./TierBadge";

const W = 100;
const H = 60;

/** Tile behind a station that needs attention: its tier's soft colour; normal stations sit on the page. */
const TILE: Record<TierKey, string> = {
  danger: "bg-tier-danger-soft",
  warning: "bg-tier-warning-soft",
  watch: "bg-tier-watch-soft",
  normal: "",
  unknown: "border border-dashed border-line-strong",
};

/** One channel cut across: grey land, blue water, and the water spreading over both banks once it is over them. */
function Section({ diff, className = "w-full bg-surface-sunken" }: { diff: number; className?: string }) {
  const s = crossSection(diff, W, H);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className={`block h-auto rounded-sm ${className}`}>
      <rect x="0" y={s.waterTop} width={W} height={H - s.waterTop} className="fill-water" />
      <polygon points={s.land} className="fill-line-strong" />
      {s.overHeight > 0 && <rect x="0" y={s.waterTop} width={W} height={s.overHeight} className="fill-water" />}
    </svg>
  );
}

/**
 * River Now option F: a small cross-section at every station, upstream first, so the water level reads as
 * "still in the channel" or "over the banks" without a scale. Stations that need attention get their tier's tile.
 */
export function RiverSections({ rivers }: { rivers: River[] }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-md bg-surface-sunken p-3">
        <Section diff={-1.2} className="w-24 flex-none bg-surface-raised" />
        <p className="m-0 text-caption sm:text-body">
          {copy.river.sectionsKey.lead} · <b>{copy.river.sectionsKey.land}</b> {copy.river.sectionsKey.landIs} ·{" "}
          <b className="text-river">{copy.river.sectionsKey.water}</b> {copy.river.sectionsKey.waterIs}
          <span className="max-sm:hidden"> · {copy.river.sectionsKey.over}</span>
        </p>
      </div>

      {rivers.map((r) => (
        <section key={r.key} className="flex flex-col gap-2">
          <h3 className="m-0 text-heading font-semibold text-river">
            {r.name} <span className="text-caption font-normal text-ink-muted">· {copy.river.upstreamFirst}</span>
            <RiverNote river={r} />
          </h3>
          <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4 lg:grid-cols-6">
            {r.stations.map((s) => {
              const tier = stationTier(s);
              const reading = formatBankGap(s.latest?.diff_wl_bank);
              return (
                <li key={s.id}>
                  <Link
                    to={`/map?station=${s.id}`}
                    aria-label={`${s.name_th ?? ""} ${s.oldcode ?? ""} ${reading} ${tierInfo(tier).label}`}
                    className={`flex h-full flex-col gap-1 rounded-md p-2 text-ink no-underline hover:underline ${TILE[tier]}`}
                  >
                    <Section diff={s.latest!.diff_wl_bank!} />
                    <span className="text-caption font-semibold [overflow-wrap:anywhere]">{s.name_th}</span>
                    {/* The tier's shape and word (a badge is too wide for a phone tile). */}
                    {tier !== "normal" && (
                      <span className={`inline-flex items-center gap-1.5 text-caption font-semibold ${TIER_INK[tier]}`}>
                        <TierShape tier={tier} />
                        {tierInfo(tier).label}
                      </span>
                    )}
                    <span className={`num text-caption ${tier === "normal" ? "text-ink-muted" : "font-semibold"}`}>{reading}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
