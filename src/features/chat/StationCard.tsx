import { Link } from "react-router";
import type { Source } from "../../api/types";
import { Gauge } from "../../components/Gauge";
import { StaleNotice } from "../../components/Stale";
import { TierBadge } from "../../components/TierBadge";
import { agencyName, copy } from "../../copy";
import { formatBankGap, formatDateTime, formatDistance, formatHoursToBank, formatLevel, formatTrend } from "../../lib/format";
import { tierReason, type TierKey } from "../../lib/tiers";

type StationSource = Extract<Source, { type: "station" }>;

/** True when the source carries the reading (newer backends); otherwise the chat shows the source line only. */
export function hasReading(s: StationSource): boolean {
  return s.diff_wl_bank != null;
}

/**
 * DS StationCard inside a chat answer: the reading the reply used, in words a family can act on. Every number
 * is from the chat response's source, which the backend took from the same tool call as the reply.
 */
export function StationCard({ source: s, solid = true }: { source: StationSource; solid?: boolean }) {
  const tier: TierKey = s.risk_tier ?? "unknown";
  const gap = s.diff_wl_bank;
  const reason = tierReason(tier, s.hours_to_bank, (s.upstream_over?.length ?? 0) > 0);
  const hours = formatHoursToBank(s.hours_to_bank);
  const distance = formatDistance(s.distance_km);
  return (
    <article className="nm-station w-full max-w-[40rem]">
      <div className="nm-station__head">
        <div className="min-w-0">
          <h3 className="nm-station__name">
            {s.name_th ?? copy.unknown} {s.code && <span className="nm-code">{s.code}</span>}
          </h3>
          <div className="nm-station__meta">
            {[s.river, distance && `${copy.profile.away} ${distance}`].filter(Boolean).join(" · ")}
          </div>
        </div>
        <TierBadge tier={tier} soft={!solid} />
      </div>

      <StaleNotice ts={s.observed_at} agency={s.agency ?? null} />

      <div>
        <div className={`nm-station__gap ${gap != null && gap > 0 ? "nm-station__gap--over" : ""}`}>{formatBankGap(gap)}</div>
        <p className="nm-station__why m-0">
          {formatTrend(s.trend_cm_per_hr)}
          {reason && ` · ${reason}`}
        </p>
      </div>

      <Gauge level={s.level_msl} bank={s.bank_msl} />

      <dl className="nm-station__facts">
        <div>
          <dt>{copy.station.levelAtStation}</dt>
          <dd>{formatLevel(s.level_msl)}</dd>
        </div>
        {hours && (
          <div>
            <dt>{copy.station.hoursToBank}</dt>
            <dd>{hours}</dd>
          </div>
        )}
        {!!s.upstream_over?.length && (
          <div>
            <dt>{copy.station.upstream}</dt>
            <dd>{copy.station.upstreamOver(s.upstream_over)}</dd>
          </div>
        )}
      </dl>

      <p className="nm-source">
        {copy.station.sourceLead}{" "}
        <Link to={`/map?station=${s.station_id}`}>
          สถานี{s.name_th} ({s.code})
        </Link>{" "}
        {agencyName(s.agency ?? null)} ผ่าน {copy.station.thaiwater} · <span className="num">{formatDateTime(s.observed_at)}</span> ·{" "}
        {copy.station.estimated}
      </p>
    </article>
  );
}
