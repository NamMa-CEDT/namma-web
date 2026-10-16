import { lazy, Suspense, type ReactNode } from "react";
import { useReadings, useStation } from "../../api/queries";
import type { StationLink } from "../../api/types";
import { ChevronLeftIcon } from "../../components/icons";
import { StaleBadge } from "../../components/Stale";
import { ErrorState, Loading } from "../../components/States";
import { TierBadge } from "../../components/TierBadge";
import { copy } from "../../copy";
import {
  formatAge,
  formatBankGap,
  formatDateTime,
  formatDischarge,
  formatHoursToBank,
  formatLevel,
  formatTrend,
} from "../../lib/format";
import { stationTier, tierInfo } from "../../lib/tiers";

const LevelChart = lazy(() => import("./LevelChart"));

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg leading-tight font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Links({ title, links, onSelect }: { title: string; links: StationLink[]; onSelect: (id: number) => void }) {
  if (!links.length) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500">{title}</h3>
      <ul className="mt-1 space-y-1">
        {links.map(({ station: s, approx_travel_hours }) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="min-w-0 truncate">
                <span className="font-semibold">{s.oldcode}</span> {s.name_th}
                <span className="block text-xs text-slate-500">
                  {formatBankGap(s.latest?.diff_wl_bank)}
                  {approx_travel_hours != null && ` · น้ำเดินทางมาถึงประมาณ ${Math.round(approx_travel_hours)} ชม.`}
                </span>
              </span>
              <TierBadge tier={stationTier(s)} size="sm" />
            </button>
          </li>
        ))}
      </ul>
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
  const t = tierInfo(tier);
  const hours = formatHoursToBank(s.risk?.hours_to_bank);
  const discharge = formatDischarge(s.latest?.discharge);

  return (
    <article className="px-4 pt-2 pb-6">
      <button
        type="button"
        onClick={onClose}
        className="-ml-1 flex items-center gap-1 rounded-lg px-1 py-1 text-sm text-brand-700 hover:bg-brand-50"
      >
        <ChevronLeftIcon />
        {copy.map.back}
      </button>

      <header className="mt-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">
            {s.oldcode} {s.name_th}
          </h2>
          <TierBadge tier={tier} />
        </div>
        <p className="mt-0.5 text-sm text-slate-600">
          {[s.river, s.amphoe && `อ.${s.amphoe}`, s.province].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 text-sm text-slate-700">{t.description}</p>
      </header>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Tile label={copy.station.levelAtStation} value={formatLevel(s.latest?.level_msl)} sub={s.min_bank != null && `${copy.station.bank} ${s.min_bank.toFixed(2)}`} />
        <Tile label={copy.station.gapToBank} value={formatBankGap(s.latest?.diff_wl_bank)} />
        <Tile label={copy.station.trend} value={formatTrend(s.risk?.trend_cm_per_hr)} />
        {hours ? (
          <Tile label={copy.station.hoursToBank} value={hours} sub="ถ้าแนวโน้มยังเท่าเดิม" />
        ) : discharge ? (
          <Tile label={copy.station.discharge} value={discharge} />
        ) : (
          <Tile label={copy.station.observedAt} value={formatDateTime(s.latest?.ts)} />
        )}
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>
          {copy.station.observedAt} {formatDateTime(s.latest?.ts)} ({formatAge(s.latest?.ts)})
        </span>
        <StaleBadge ts={s.latest?.ts} agency={s.agency} />
      </p>

      <div className="mt-3 space-y-3">
        <Links title={copy.station.upstream} links={s.upstream} onSelect={onSelect} />
        <Links title={copy.station.downstream} links={s.downstream} onSelect={onSelect} />
      </div>

      <section className="mt-4">
        <h3 className="text-sm font-semibold text-slate-700">{copy.station.chartTitle}</h3>
        <div className={`mt-2 transition-opacity ${readings.isFetching && readings.data ? "opacity-60" : ""}`}>
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

      <p className="mt-4 rounded-lg bg-slate-100 p-3 text-xs leading-relaxed text-slate-700">{copy.station.stationNotHouse}</p>
      <p className="mt-2 text-xs text-slate-500">{copy.station.source(s.agency)}</p>
    </article>
  );
}
