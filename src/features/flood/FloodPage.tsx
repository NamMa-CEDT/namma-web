import { lazy, Suspense, useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { API_MODE } from "../../api/client";
import { useFloodAreas, useFloodCells } from "../../api/queries";
import type { FloodArea, FloodAreas, FloodLevel, FloodPeriod } from "../../api/types";
import { ErrorState, Loading } from "../../components/States";
import { copy, DDPM } from "../../copy";
import { areaName, cellOpacity, formatKm2, formatRai } from "../../lib/flood";
import { formatDateTime } from "../../lib/format";
import type { Basemap, FlyTarget } from "./FloodMap";

const FloodMap = lazy(() => import("./FloodMap"));

const PERIODS: FloodPeriod[] = ["3days", "7days"];
// How close to fly when a row is tapped: a province fills the map at 9, a tambon at 13 (GISTDA's own cells).
const FLY_ZOOM: Record<FloodLevel, number> = { province: 9, amphoe: 11, tambon: 13 };

function Legend() {
  return (
    <div className="rounded-sm border border-line bg-surface-raised px-3 py-2 shadow-float">
      <div className="text-caption font-semibold text-ink">{copy.flood.legend}</div>
      <div className="mt-1 flex items-center gap-2 text-caption text-ink-muted">
        {copy.flood.legendLow}
        {[0.15, 0.5, 1].map((s) => (
          <span
            key={s}
            aria-hidden="true"
            className="inline-block size-4 border"
            style={{ background: "var(--flood)", opacity: cellOpacity(s), borderColor: "var(--flood-edge)" }}
          />
        ))}
        {copy.flood.legendHigh}
      </div>
    </div>
  );
}

function PeriodToggle({ period, onChange }: { period: FloodPeriod; onChange: (p: FloodPeriod) => void }) {
  return (
    <div role="group" aria-label={copy.flood.periodLabel} className="inline-flex rounded-md border border-line-strong p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={p === period}
          onClick={() => onChange(p)}
          className={`min-h-11 rounded-[8px] px-4 text-label font-semibold ${
            p === period ? "bg-river text-on-river" : "text-ink-muted hover:text-ink"
          }`}
        >
          {copy.flood.period[p]}
        </button>
      ))}
    </div>
  );
}

/** Total for the current scope, with the layer's dates. Before the first download it says so, never "no flooding". */
function Summary({ data, period, onPeriod }: { data: FloodAreas; period: FloodPeriod; onPeriod: (p: FloodPeriod) => void }) {
  if (!data.fetched_at) {
    return (
      <section className="border-b border-line px-4 py-4">
        <h2 className="m-0 text-heading font-semibold">{copy.flood.noData}</h2>
        <p className="m-0 mt-1 text-body text-ink-muted">{copy.flood.noDataBody}</p>
        <Link to="/map" className="nm-btn nm-btn--secondary nm-btn--sm mt-3">
          {copy.nav.map}
        </Link>
      </section>
    );
  }
  return (
    <section className="border-b border-line px-4 py-4">
      <h2 className="m-0 text-caption font-semibold text-ink-muted">{copy.flood.total}</h2>
      {data.total.cells > 0 ? (
        <>
          <p className="num m-0 text-reading-lg font-semibold">{formatRai(data.total.area_rai)}</p>
          <p className="num m-0 text-body text-ink-muted">
            {formatKm2(data.total.area_km2)} · {copy.flood.cells(data.total.cells)}
          </p>
        </>
      ) : (
        <>
          <p className="m-0 mt-1 text-body">{copy.flood.none(copy.flood.period[period])}</p>
          {period === "3days" && (
            <button type="button" className="nm-btn nm-btn--secondary nm-btn--sm mt-2" onClick={() => onPeriod("7days")}>
              {copy.flood.tryWeek}
            </button>
          )}
        </>
      )}
      <dl className="num m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-caption text-ink-muted">
        {data.observed_to && (
          <>
            <dt>{copy.flood.observed}</dt>
            <dd className="m-0 text-ink">{formatDateTime(data.observed_to)}</dd>
          </>
        )}
        <dt>{copy.flood.fetched}</dt>
        <dd className="m-0 text-ink">{formatDateTime(data.fetched_at)}</dd>
      </dl>
    </section>
  );
}

function Breadcrumb({ province, amphoe, onGo }: { province: string | null; amphoe: string | null; onGo: (p: string | null, a: string | null) => void }) {
  if (!province) return null;
  const crumbs: [string, () => void][] = [[copy.flood.allProvinces, () => onGo(null, null)]];
  crumbs.push([areaName({ province, amphoe: null, tambon: null, code: null }, "province"), () => onGo(province, null)]);
  if (amphoe) crumbs.push([areaName({ province, amphoe, tambon: null, code: null }, "amphoe"), () => onGo(province, amphoe)]);
  return (
    <nav aria-label="ระดับพื้นที่" className="flex flex-wrap items-center gap-x-1 px-4 pt-3 text-caption">
      {crumbs.map(([label, go], i) => (
        <span key={label} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden="true">›</span>}
          {i < crumbs.length - 1 ? (
            <button type="button" onClick={go} className="min-h-11 font-semibold text-river underline">
              {label}
            </button>
          ) : (
            <span className="font-semibold text-ink">{label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function AreaList({ data, busy, onPick }: { data: FloodAreas; busy: boolean; onPick: (a: FloodArea) => void }) {
  if (!data.areas.length) return null;
  const max = data.areas[0].area_km2 || 1;
  const drill = data.level !== "tambon";
  return (
    <section className={`px-4 py-3 ${busy ? "opacity-60" : ""}`} aria-busy={busy}>
      <h2 className="m-0 text-heading font-semibold">{copy.flood.byLevel[data.level]}</h2>
      <ul className="m-0 mt-1 list-none p-0">
        {data.areas.map((a) => (
          <li key={`${a.province}|${a.amphoe}|${a.tambon}|${a.code}`} className="border-b border-line last:border-b-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(a)}
              className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2 text-left hover:bg-surface-sunken"
            >
              <span className="min-w-0 truncate text-body font-semibold">
                {areaName(a, data.level)}
                {drill && <span className="sr-only"> ({copy.flood.byLevel[data.level === "province" ? "amphoe" : "tambon"]})</span>}
              </span>
              <span className="num text-body">{formatRai(a.area_rai)}</span>
              <span className="col-span-2 mt-1 h-1.5 rounded-pill bg-surface-sunken" aria-hidden="true">
                <span
                  className="block h-full rounded-pill"
                  style={{ width: `${Math.max(2, (a.area_km2 / max) * 100)}%`, background: "var(--flood)" }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function FloodPage() {
  const [params, setParams] = useSearchParams();
  const period: FloodPeriod = params.get("period") === "7days" ? "7days" : "3days";
  const province = params.get("province");
  const amphoe = province ? params.get("amphoe") : null;
  const areas = useFloodAreas(period, province, amphoe);
  const [view, setView] = useState<{ bbox: string; res: number } | null>(null);
  const cells = useFloodCells(period, view);
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  const onView = useCallback(
    (v: { bbox: string; res: number }) => setView((old) => (old?.bbox === v.bbox && old.res === v.res ? old : v)),
    [],
  );
  const onTilesFailed = useCallback(() => setTilesFailed(true), []);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };
  const goTo = (p: string | null, a: string | null) => update({ province: p, amphoe: a });
  const pick = (a: FloodArea) => {
    if (a.lat != null && a.lon != null) setFlyTo({ lat: a.lat, lon: a.lon, zoom: FLY_ZOOM[areas.data!.level] });
    const name = (n: string | null) => n ?? a.code;
    if (areas.data!.level === "province") goTo(name(a.province), null);
    else if (areas.data!.level === "amphoe") goTo(province, name(a.amphoe));
  };

  const shown = cells.data;
  return (
    <div className="flex h-full flex-col lg:flex-row-reverse">
      <div className="relative h-[50%] shrink-0 lg:h-full lg:min-w-0 lg:flex-1">
        <Suspense fallback={<Loading className="h-full" />}>
          <FloodMap
            cells={shown?.cells ?? []}
            res={shown?.res ?? 9}
            basemap={basemap}
            flyTo={flyTo}
            onView={onView}
            onTilesFailed={onTilesFailed}
          />
        </Suspense>

        <div className="pointer-events-none absolute inset-x-2 top-2 z-[500] flex flex-col items-end gap-2">
          <div role="group" aria-label={copy.flood.basemap} className="pointer-events-auto inline-flex rounded-md border border-line-strong bg-surface-raised p-0.5 shadow-float">
            {(["satellite", "streets"] as const).map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={b === basemap}
                onClick={() => setBasemap(b)}
                className={`min-h-10 rounded-[8px] px-3 text-label font-semibold ${
                  b === basemap ? "bg-river text-on-river" : "text-ink-muted hover:text-ink"
                }`}
              >
                {copy.flood[b]}
              </button>
            ))}
          </div>
          {(cells.isFetching && !shown) || cells.isError || shown?.truncated || tilesFailed ? (
            <p role="status" className="pointer-events-auto m-0 max-w-xs rounded-sm border border-line bg-surface-raised px-3 py-2 text-caption text-ink shadow-float">
              {tilesFailed
                ? copy.flood.tilesFailed
                : cells.isError
                  ? copy.flood.cellsFailed
                  : shown?.truncated
                    ? copy.flood.truncated
                    : copy.flood.loadingCells}
            </p>
          ) : null}
        </div>
        <div className="absolute bottom-6 left-2 z-[500] hidden sm:block">
          <Legend />
        </div>
      </div>

      <aside className="min-h-0 flex-1 overflow-y-auto border-t border-line bg-surface lg:w-[420px] lg:flex-none lg:border-t-0 lg:border-r">
        {/* On a phone the map takes half the screen: the total comes right after the title, the notes last. */}
        <header className="border-b border-line px-4 py-3">
          <h1 className="m-0 text-title font-semibold">{copy.flood.title}</h1>
          {API_MODE === "mock" && <p className="nm-stale mt-2">{copy.flood.sample}</p>}
          <div className="mt-2">
            <PeriodToggle period={period} onChange={(p) => update({ period: p === "3days" ? null : p })} />
          </div>
        </header>

        {areas.isPending ? (
          <Loading />
        ) : areas.isError ? (
          <ErrorState error={areas.error} onRetry={() => areas.refetch()} />
        ) : (
          <>
            <Breadcrumb province={province} amphoe={amphoe} onGo={goTo} />
            <Summary data={areas.data} period={period} onPeriod={(p) => update({ period: p })} />
            <AreaList data={areas.data} busy={areas.isPlaceholderData} onPick={pick} />
          </>
        )}

        <div className="grid gap-2 border-t border-line px-4 pt-3 pb-4 text-caption text-ink-muted">
          <div className="sm:hidden">
            <Legend />
          </div>
          <p className="m-0">{copy.flood.subtitle}</p>
          <p className="m-0">{copy.flood.tapHint}</p>
          <p className="m-0">{copy.flood.caveat}</p>
          <p className="m-0">
            {copy.footer.unofficial} · {copy.footer.emergency}{" "}
            <a href={DDPM.telHref} className="font-semibold text-tier-danger-ink underline">
              {DDPM.hotline}
            </a>
          </p>
          <p className="m-0">{copy.flood.source}</p>
        </div>
      </aside>
    </div>
  );
}
