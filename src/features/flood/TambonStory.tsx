// One tambon's flood story, in the tambon card: when GISTDA last saw water there this season (its 3-, 7- and 30-day
// layers), the years it flooded since 2011, and the daily record NamMa keeps of the layers. Every number comes from
// /api/flood/tambon; nothing is estimated. GISTDA gives no date per cell, so "last seen" is the shortest layer with
// water, and the record is only as long as we have been keeping it: it is never stretched or filled in.
import { ApiError } from "../../api/client";
import { useFloodTambon } from "../../api/queries";
import type { FloodPeriod, FloodTambon } from "../../api/types";
import { copy } from "../../copy";
import { formatRai, seasonClass, worstYear } from "../../lib/flood";
import { formatDate } from "../../lib/format";
import { Swatch } from "./patterns";

const s = copy.flood.story;

export function TambonStory({ code }: { code: string | null }) {
  const q = useFloodTambon(code);
  if (code == null) return null;
  if (q.isPending) return <p className="m-0 text-caption text-ink-muted">{s.loading}</p>;
  // 404: no source knows the tambon. Nothing to add to the card then.
  if (q.isError) return q.error instanceof ApiError && q.error.status === 404 ? null : <p className="m-0 text-caption text-ink-muted">{s.failed}</p>;
  return (
    <>
      <Season data={q.data} />
      <Years data={q.data} />
      <Record data={q.data} />
    </>
  );
}

/** This season: one bar per layer, and the headline "water last seen …". */
function Season({ data }: { data: FloodTambon }) {
  const month = data.windows.find((w) => w.period === "30days");
  const headline = data.last_seen
    ? copy.flood.season.seenLong[data.last_seen]
    : month?.fetched_at
      ? s.noneMonth
      : s.notYet;
  const max = Math.max(1, ...data.windows.map((w) => w.area_rai));
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="m-0 text-caption font-semibold text-ink-muted">{s.now}</h3>
      <p className="m-0 flex items-center gap-2 text-body font-semibold">
        <Swatch cls={seasonClass(data.last_seen)} />
        {headline}
      </p>
      <ul className="m-0 grid list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 p-0">
        {data.windows.map((w) => (
          <li key={w.period} className="contents text-caption text-ink-muted">
            <span>{copy.flood.periodShort[w.period]}</span>
            <span className="h-2 rounded-pill bg-surface-sunken" aria-hidden="true">
              {w.cells > 0 && (
                <span className="block h-full rounded-pill" style={{ width: `${Math.max(3, (w.area_rai / max) * 100)}%`, background: "var(--flood)" }} />
              )}
            </span>
            <span className="num text-right">{!w.fetched_at ? s.windowMissing : w.cells > 0 ? formatRai(w.area_rai) : s.windowEmpty}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 2011–2024 as a strip of years (filled = flooded), and this season's square next to it. */
function Years({ data }: { data: FloodTambon }) {
  const h = data.history;
  const covered = h?.years_covered ?? [];
  if (!h || covered.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-caption font-semibold text-ink-muted">{s.years}</h3>
        <p className="m-0 text-caption text-ink-muted">{copy.flood.history.notCopied}</p>
      </div>
    );
  }
  const flooded = new Set(h.years);
  const from = covered[0];
  const to = covered[covered.length - 1];
  const worst = worstYear(h);
  const now = data.last_seen != null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="m-0 text-caption font-semibold text-ink-muted">{s.years}</h3>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div role="img" aria-label={s.yearsAria(h.years)} className="flex gap-[3px]">
            {covered.map((y) => (
              <span
                key={y}
                title={String(y)}
                className={`block h-5 min-w-0 flex-1 rounded-[3px] ${flooded.has(y) ? "" : "border border-line bg-surface-sunken"}`}
                style={flooded.has(y) ? { background: "var(--flood)" } : undefined}
              />
            ))}
          </div>
          <div className="num mt-0.5 flex justify-between text-caption text-ink-muted" aria-hidden="true">
            <span>{from}</span>
            <span>{to}</span>
          </div>
        </div>
        <div className="w-10 shrink-0 text-center">
          <span
            role="img"
            aria-label={`${s.thisYear}: ${now ? s.thisYearToo : s.noneMonth}`}
            className={`block h-5 rounded-[3px] border-2 ${now ? "border-ink" : "border-line bg-surface-sunken"}`}
            style={now ? { background: "var(--flood)" } : undefined}
          />
          <span className="mt-0.5 block text-caption font-semibold text-ink">{s.thisYear}</span>
        </div>
      </div>
      <p className="num m-0 text-body">
        {h.years.length > 0
          ? [s.yearsLine(h.years.length, from, to), worst && copy.flood.history.worst(worst.year, formatRai(worst.rai))].filter(Boolean).join(" · ")
          : now
            ? s.firstTime(from, to)
            : copy.flood.history.never}
      </p>
      {now && h.years.length > 0 && <p className="m-0 text-caption text-ink-muted">{s.thisYearToo}</p>}
    </div>
  );
}

/** The flooded area of one layer, per day: 7 days if we have it (steadier than 3), else 30. */
export function recordSeries(data: Pick<FloodTambon, "record">): { day: string; rai: number }[] {
  const period: FloodPeriod | undefined = (["7days", "30days", "3days"] as const).find((p) => data.record.some((r) => r.period === p));
  if (!period) return [];
  const rows = data.record.filter((r) => r.period === period);
  const byDay = new Map(rows.map((r) => [r.day, r.area_rai]));
  // A day between the first and last with no row had no water there in that day's layer: 0, not a gap.
  const out: { day: string; rai: number }[] = [];
  for (let t = Date.parse(rows[0].day); t <= Date.parse(rows[rows.length - 1].day); t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push({ day, rai: byDay.get(day) ?? 0 });
  }
  return out;
}

/** Our own daily record: a small line once there are two days or more. */
function Record({ data }: { data: FloodTambon }) {
  const series = recordSeries(data);
  const W = 300;
  const H = 48;
  const peak = Math.max(1, ...series.map((p) => p.rai));
  const pts = series.map((p, i) => [series.length > 1 ? (i / (series.length - 1)) * W : 0, H - 2 - (p.rai / peak) * (H - 6)]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <div className="flex flex-col gap-1">
      <h3 className="m-0 text-caption font-semibold text-ink-muted">{s.record}</h3>
      {series.length >= 2 ? (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-12 w-full"
            role="img"
            aria-label={s.recordAria(formatDate(series[0].day), formatDate(series[series.length - 1].day), formatRai(peak))}
          >
            <polygon points={`0,${H} ${line} ${W},${H}`} fill="var(--flood)" fillOpacity="0.18" />
            <polyline points={line} fill="none" stroke="var(--flood)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="num flex justify-between text-caption text-ink-muted" aria-hidden="true">
            <span>{formatDate(series[0].day)}</span>
            <span>{s.recordPeak(formatRai(peak))}</span>
            <span>{formatDate(series[series.length - 1].day)}</span>
          </div>
        </>
      ) : (
        <p className="m-0 text-caption text-ink-muted">{series.length === 1 ? s.recordStart(formatDate(series[0].day)) : s.recordNone}</p>
      )}
    </div>
  );
}
