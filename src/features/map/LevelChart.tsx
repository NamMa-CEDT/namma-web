// 72 h water level at one station: one series (no legend box; the title names it), the bank as
// a labelled threshold, crosshair tooltip, end value labelled, and a table view twin.
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Reading } from "../../api/types";
import { copy } from "../../copy";
import { formatBankGap, formatDateTime, formatLevel } from "../../lib/format";
import { useTokens } from "../../lib/useTokens";

// Design-system tokens: water fills the level line, the bank line is `bank` (ink), grid is `line`.
const TOKENS = ["water", "bank", "line", "line-strong", "ink", "ink-muted", "surface-raised"] as const;

interface Point {
  t: number;
  level: number | null;
}

/** Insert a null where readings are missing so the line breaks instead of bridging a gap. */
export function withGaps(readings: Reading[]): Point[] {
  const pts = readings.map((r) => ({ t: Date.parse(r.ts), level: r.level_msl })).sort((a, b) => a.t - b.t);
  if (pts.length < 3) return pts;
  const steps = pts.slice(1).map((p, i) => p.t - pts[i].t).sort((a, b) => a - b);
  const median = steps[Math.floor(steps.length / 2)];
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].t - pts[i - 1].t > median * 2.5) out.push({ t: (pts[i].t + pts[i - 1].t) / 2, level: null });
    out.push(pts[i]);
  }
  return out;
}

const tickFmt = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });
const hourFmt = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });

function TooltipBody({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p || p.level == null) return null;
  return (
    <div className="rounded-sm border border-line bg-surface-raised px-3 py-2 shadow-float">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded-sm bg-water" />
        <span className="num text-label font-semibold text-ink">{formatLevel(p.level)}</span>
      </div>
      <div className="num text-caption text-ink-muted">{formatDateTime(new Date(p.t).toISOString())}</div>
    </div>
  );
}

export default function LevelChart({ readings, bank }: { readings: Reading[]; bank: number | null }) {
  const data = useMemo(() => withGaps(readings), [readings]);
  const c = useTokens(TOKENS);
  const last = [...data].reverse().find((p) => p.level != null) ?? null;

  if (!last) return <p className="m-0 py-6 text-center text-body text-ink-muted">{copy.station.chartEmpty}</p>;

  const levels = data.flatMap((p) => (p.level == null ? [] : [p.level]));
  const lo = Math.min(...levels, bank ?? Infinity);
  const hi = Math.max(...levels, bank ?? -Infinity);
  const pad = Math.max(0.2, (hi - lo) * 0.15);
  const domain: [number, number] = [Math.floor((lo - pad) * 10) / 10, Math.ceil((hi + pad) * 10) / 10];
  const start = data[0].t;
  const end = data[data.length - 1].t;
  const dayTicks: number[] = [];
  for (let d = new Date(start); d.getTime() <= end; d.setTime(d.getTime() + 3600_000)) {
    const local = new Date(d.getTime() + 7 * 3600_000);
    if (local.getUTCHours() === 0) dayTicks.push(d.getTime());
  }

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 56, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={c.line} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[start, end]}
              ticks={dayTicks}
              tickFormatter={(t: number) => tickFmt.format(t)}
              tick={{ fontSize: 14, fill: c["ink-muted"] }}
              tickLine={false}
              axisLine={{ stroke: c["line-strong"] }}
            />
            <YAxis
              domain={domain}
              width={44}
              tick={{ fontSize: 14, fill: c["ink-muted"] }}
              tickFormatter={(v: number) => v.toFixed(1)}
              tickLine={false}
              axisLine={false}
            />
            {bank != null && (
              <ReferenceLine
                y={bank}
                stroke={c.bank}
                strokeWidth={2}
                strokeDasharray="5 4"
                label={{
                  value: `${copy.station.chartBankLine} ${bank.toFixed(2)}`,
                  position: "insideTopLeft",
                  fill: c.ink,
                  fontSize: 14,
                }}
              />
            )}
            <Tooltip
              content={<TooltipBody />}
              cursor={{ stroke: c["ink-muted"], strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="level"
              stroke={c.water}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: c.water, stroke: c["surface-raised"], strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={last.t}
              y={last.level!}
              r={4}
              fill={c.water}
              stroke={c["surface-raised"]}
              strokeWidth={2}
              label={{ value: last.level!.toFixed(2), position: "right", fill: c.ink, fontSize: 14, fontWeight: 600 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="m-0 mt-1 text-caption text-ink-muted">หน่วย: {copy.station.msl} (เมตรเหนือระดับทะเลปานกลาง)</p>

      <details className="mt-2 text-body">
        <summary className="min-h-11 cursor-pointer content-center font-semibold text-river">{copy.map.tableView}</summary>
        <table className="num mt-2 w-full border-collapse text-left text-caption">
          <thead className="bg-surface-sunken text-ink-muted">
            <tr>
              <th className="px-2 py-1 font-semibold">เวลา</th>
              <th className="px-2 py-1 font-semibold">ระดับ ({copy.station.msl})</th>
              <th className="px-2 py-1 font-semibold">{copy.station.gapToBank}</th>
            </tr>
          </thead>
          <tbody>
            {readings
              .slice(-24)
              .reverse()
              .map((r) => (
                <tr key={r.ts} className="border-t border-line">
                  <td className="px-2 py-1">{hourFmt.format(new Date(r.ts))} น. {tickFmt.format(new Date(r.ts))}</td>
                  <td className="px-2 py-1">{r.level_msl.toFixed(2)}</td>
                  <td className="px-2 py-1">{formatBankGap(r.diff_wl_bank)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
