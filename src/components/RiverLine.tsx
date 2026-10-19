import { Link } from "react-router";
import type { StationSummary } from "../api/types";
import { copy } from "../copy";
import { formatBankGap } from "../lib/format";
import { waterLine } from "../lib/riverShapes";
import { stationTier, tierInfo, type TierKey } from "../lib/tiers";
import { RiverNote, type River } from "./RiverProfile";
import { TIER_INK, TierBadge } from "./TierBadge";

const HEIGHT = 150;
const PAD = 7; // percent of the width kept free at each end, so the end labels fit

/** "ต้นน้ำ นครสวรรค์ → ปลายน้ำ กรุงเทพมหานคร" when the river leaves its province; otherwise just the order. */
function course(stations: StationSummary[]): string {
  const from = stations[0]?.province;
  const to = stations.at(-1)?.province;
  return from && to && from !== to ? copy.river.fromTo(from, to) : copy.river.upstreamFirst;
}

function label(s: StationSummary, tier: TierKey): string {
  return `${s.name_th ?? ""} ${s.oldcode ?? ""} ${formatBankGap(s.latest?.diff_wl_bank)} ${tierInfo(tier).label}`;
}

/**
 * River Now option E: each river drawn as its water surface through every station (upstream on the left) against
 * one bank line; water over the bank is filled with the danger colour. Wide screens name every station under its
 * marker; narrower ones list the stations that aren't normal, so the names never overlap.
 */
function OneRiver({ river }: { river: River }) {
  const { stations } = river;
  const line = waterLine(
    stations.map((s) => s.latest!.diff_wl_bank!),
    HEIGHT,
    PAD,
  );
  const tiers = stations.map(stationTier);
  const notNormal = stations.map((s, i) => ({ s, tier: tiers[i] })).filter((x) => x.tier !== "normal");
  const normal = stations.length - notNormal.length;
  const step = stations.length > 1 ? (100 - 2 * PAD) / (stations.length - 1) : 100;
  // A label goes at the left edge unless the upstream marker sits in its band; then at the right edge.
  const first = line.points[0];
  const last = line.points.at(-1)!;
  const clear = (y: number, top: number) => y + 9 <= top || y - 9 >= top + 22;
  const edge = (top: number) =>
    clear(first.y, top) || !clear(last.y, top) ? { top, left: 8 } : { top, right: 8 };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="m-0 text-heading font-semibold text-river">
          {river.name}
          <RiverNote river={river} />
        </h3>
        <span className="text-caption text-ink-muted">{course(stations)}</span>
      </div>

      <div className="nm-riverline" style={{ height: HEIGHT }} aria-hidden="true">
        <svg viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none">
          <rect x="0" y="0" width="100" height={line.bank} className="fill-surface-raised" />
          <rect x="0" y={line.bank} width="100" height={HEIGHT - line.bank} className="fill-surface-sunken" />
          <path d={line.water} className="fill-water" />
          {line.over && <path d={line.over} className="fill-tier-danger" />}
        </svg>
        <span className="nm-riverline__bank" style={{ top: line.bank }} />
        <span className="nm-riverline__label" style={edge(4)}>
          {copy.river.landSide}
        </span>
        <span className="nm-riverline__label is-bank" style={edge(line.bank + 2)}>
          {copy.river.bank}
        </span>
        {line.points.map((p, i) => (
          <span
            key={stations[i].id}
            className={`nm-riverline__mark nm-riverline__mark--${tiers[i]}`}
            style={{ left: `${p.x}%`, top: p.y }}
          />
        ))}
      </div>

      {/* Wide: every station's name under its marker; the reading and tier word only where it isn't normal. */}
      <ol className={`relative m-0 hidden list-none p-0 lg:block ${notNormal.length ? "h-[124px]" : "h-[52px]"}`}>
        {stations.map((s, i) => {
          const tier = tiers[i];
          const alert = tier !== "normal";
          return (
            <li
              key={s.id}
              className="absolute top-0 -translate-x-1/2"
              style={{ left: `${line.points[i].x}%`, width: `min(124px, ${step}%)` }}
            >
              <Link
                to={`/map?station=${s.id}`}
                aria-label={label(s, tier)}
                title={formatBankGap(s.latest?.diff_wl_bank)}
                className="flex flex-col items-center gap-1 text-center no-underline"
              >
                <span className={`text-caption ${alert ? `font-semibold ${TIER_INK[tier]}` : "text-ink-muted"}`}>
                  {s.name_th}
                </span>
                {alert && (
                  <>
                    <TierBadge tier={tier} soft />
                    <span className={`num text-caption font-semibold ${TIER_INK[tier]}`}>
                      {formatBankGap(s.latest?.diff_wl_bank)}
                    </span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      {/* Narrow: the stations that need attention as rows, then how many are normal. */}
      <div className="flex flex-col lg:hidden">
        {notNormal.map(({ s, tier }) => (
          <Link
            key={s.id}
            to={`/map?station=${s.id}`}
            aria-label={label(s, tier)}
            className="flex min-h-11 flex-wrap items-center gap-x-2 text-ink no-underline"
          >
            <TierBadge tier={tier} soft />
            <span className="flex-1 text-label font-semibold">{s.name_th}</span>
            <span className={`num text-caption font-semibold ${TIER_INK[tier]}`}>
              {formatBankGap(s.latest?.diff_wl_bank)}
            </span>
          </Link>
        ))}
        {normal > 0 && (
          <span className="text-caption text-ink-muted">
            {notNormal.length ? copy.river.othersNormal(normal) : copy.river.allNormal(normal)}
          </span>
        )}
      </div>
    </section>
  );
}

export function RiverLine({ rivers }: { rivers: River[] }) {
  return (
    <div className="flex flex-col gap-6">
      {rivers.map((r) => (
        <OneRiver key={r.key} river={r} />
      ))}
    </div>
  );
}
