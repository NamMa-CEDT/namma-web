import { lazy, Suspense } from "react";
import { useReadings, useStation } from "../../api/queries";
import type { StationDetail, StationLink } from "../../api/types";
import { ChevronLeftIcon } from "../../components/icons";
import { StaleNotice } from "../../components/Stale";
import { ErrorState, Loading } from "../../components/States";
import { TierBadge } from "../../components/TierBadge";
import { agencyName, copy } from "../../copy";
import {
  formatBankGap,
  formatDateTime,
  formatDischarge,
  formatHoursToBank,
  formatLevel,
  formatPlace,
  formatTrend,
} from "../../lib/format";
import { stationTier, tierReason } from "../../lib/tiers";

const LevelChart = lazy(() => import("./LevelChart"));

/** "บ้านป้อม (C.35)": place name first, code second (DS content rules). */
export function StationName({ name, code }: { name: string | null; code: string | null }) {
  return (
    <>
      {name ?? copy.unknown} {code && <span className="nm-code">({code})</span>}
    </>
  );
}

function Links({ title, links, onSelect }: { title: string; links: StationLink[]; onSelect: (id: number) => void }) {
  if (!links.length) return null;
  return (
    <section className="grid gap-1">
      <h3 className="m-0 text-caption font-semibold text-ink-muted">{title}</h3>
      <ul className="m-0 list-none p-0">
        {links.map(({ station: s, approx_travel_hours }) => (
          <li key={s.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left hover:bg-surface-sunken"
            >
              <span className="min-w-0">
                <span className="block text-body font-semibold">
                  <StationName name={s.name_th} code={s.oldcode} />
                </span>
                <span className="num block text-caption text-ink-muted">
                  {formatBankGap(s.latest?.diff_wl_bank)}
                  {approx_travel_hours != null && ` · น้ำเดินทางมาถึงในราว ${Math.round(approx_travel_hours)} ชม.`}
                </span>
              </span>
              <TierBadge tier={stationTier(s)} soft />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** DS gauge: a staff gauge on its side. No house marker: we don't know the house's height. */
function Gauge({ s }: { s: StationDetail }) {
  const level = s.latest?.level_msl;
  const bank = s.min_bank;
  if (level == null || bank == null) return null;
  // Track from 3 m below the bank to 1 m above it, widened to fit the reading.
  const lo = Math.min(bank - 3, level - 0.5);
  const hi = Math.max(bank + 1, level + 0.5);
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const over = level > bank;
  return (
    <div>
      <div
        role="img"
        aria-label={`${copy.station.level} ${formatLevel(level)} ${copy.station.bankLevel} ${formatLevel(bank)}`}
        className={`nm-gauge ${over ? "nm-gauge--over" : ""}`}
        style={{ "--level-pos": pos(level), "--bank-pos": pos(bank) } as React.CSSProperties}
      >
        <div className="nm-gauge__water" />
        <div className="nm-gauge__ticks" />
        <div className="nm-gauge__bank" />
      </div>
      <div className="nm-gauge-legend">
        <span>
          {copy.station.level} {formatLevel(level)}
        </span>
        <span>
          {copy.station.bankLevel} {formatLevel(bank)}
        </span>
      </div>
    </div>
  );
}

export function StationSheet({
  id,
  onClose,
  onSelect,
}: {
  id: number;
  onClose: () => void;
  onSelect: (id: number) => void;
}) {
  const station = useStation(id);
  const readings = useReadings(id, 72);

  if (station.isPending) return <Loading />;
  if (station.isError) return <ErrorState error={station.error} onRetry={() => station.refetch()} />;

  const s = station.data;
  const tier = stationTier(s);
  const gap = s.latest?.diff_wl_bank;
  const hours = formatHoursToBank(s.risk?.hours_to_bank);
  const discharge = formatDischarge(s.latest?.discharge);
  const upstreamOver = s.upstream.some((l) => stationTier(l.station) === "danger");
  const reason = tierReason(tier, s.risk?.hours_to_bank, upstreamOver);

  return (
    <article className="grid gap-4 px-4 pt-2 pb-6">
      <button
        type="button"
        onClick={onClose}
        className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-md px-2 text-label font-semibold text-river hover:bg-river-soft"
      >
        <ChevronLeftIcon className="text-[20px]" />
        {copy.map.back}
      </button>

      <section className="nm-station">
        <div className="nm-station__head">
          <div className="min-w-0">
            <h2 className="nm-station__name">
              <StationName name={s.name_th} code={s.oldcode} />
            </h2>
            <div className="nm-station__meta">
              {[s.river, formatPlace(s.amphoe, s.province)].filter(Boolean).join(" · ")}
            </div>
          </div>
          <TierBadge tier={tier} />
        </div>

        <StaleNotice ts={s.latest?.ts} agency={s.agency} />

        <div className={`nm-station__gap ${gap != null && gap > 0 ? "nm-station__gap--over" : ""}`}>
          {formatBankGap(gap)}
        </div>
        <p className="nm-station__why m-0">
          {formatTrend(s.risk?.trend_cm_per_hr)}
          {reason && ` · ${reason}`}
        </p>

        <Gauge s={s} />

        <dl className="nm-station__facts">
          <div>
            <dt>{copy.station.levelAtStation}</dt>
            <dd>{formatLevel(s.latest?.level_msl)}</dd>
          </div>
          {hours && (
            <div>
              <dt>{copy.station.hoursToBank}</dt>
              <dd>{hours}</dd>
            </div>
          )}
          {discharge && (
            <div>
              <dt>{copy.station.discharge}</dt>
              <dd>{discharge}</dd>
            </div>
          )}
        </dl>

        <p className="nm-source">
          {copy.station.sourceLead} สถานี{s.name_th} ({s.oldcode}) {agencyName(s.agency)} ผ่าน {copy.station.thaiwater} ·{" "}
          <span className="num">{formatDateTime(s.latest?.ts)}</span> · {copy.station.estimated}
        </p>
      </section>

      <Links title={copy.station.upstream} links={s.upstream} onSelect={onSelect} />
      <Links title={copy.station.downstream} links={s.downstream} onSelect={onSelect} />

      <section className="grid gap-2">
        <h3 className="m-0 text-heading font-semibold">{copy.station.chartTitle}</h3>
        <div className={readings.isFetching && readings.data ? "opacity-60" : ""}>
          {readings.isPending ? (
            <Loading />
          ) : readings.isError ? (
            <ErrorState error={readings.error} onRetry={() => readings.refetch()} />
          ) : (
            <Suspense fallback={<Loading />}>
              <LevelChart readings={readings.data.readings} bank={s.min_bank} />
            </Suspense>
          )}
        </div>
      </section>

      <p className="m-0 rounded-sm bg-surface-sunken p-3 text-body">{copy.station.stationNotHouse}</p>
    </article>
  );
}
