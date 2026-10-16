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

const SERIES = "#2a78d6";
const BANK = "#d03b3b";
const GRID = "#e2e8f0";
const MUTED = "#64748b";

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
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded" style={{ background: SERIES }} />
        <span className="text-sm font-semibold text-slate-900">{formatLevel(p.level)}</span>
      </div>
      <div className="mt-0.5 text-slate-500">{formatDateTime(new Date(p.t).toISOString())}</div>
    </div>
  );
}

export default function LevelChart({ readings, bank }: { readings: Reading[]; bank: number | null }) {
  const data = useMemo(() => withGaps(readings), [readings]);
  const last = [...data].reverse().find((p) => p.level != null) ?? null;

  if (!last) return <p className="py-6 text-center text-sm text-slate-500">{copy.station.chartEmpty}</p>;

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
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[start, end]}
              ticks={dayTicks}
              tickFormatter={(t: number) => tickFmt.format(t)}
              tick={{ fontSize: 11, fill: MUTED }}
              tickLine={false}
              axisLine={{ stroke: "#cbd5e1" }}
            />
            <YAxis
              domain={domain}
              width={40}
              tick={{ fontSize: 11, fill: MUTED }}
              tickFormatter={(v: number) => v.toFixed(1)}
              tickLine={false}
              axisLine={false}
            />
            {bank != null && (
              <ReferenceLine
                y={bank}
                stroke={BANK}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                label={{
                  value: `${copy.station.chartBankLine} ${bank.toFixed(2)}`,
                  position: "insideTopLeft",
                  fill: "#7f1d1d",
                  fontSize: 11,
                }}
              />
            )}
            <Tooltip
              content={<TooltipBody />}
              cursor={{ stroke: "#94a3b8", strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="level"
              stroke={SERIES}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: SERIES, stroke: "#ffffff", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={last.t}
              y={last.level!}
              r={4}
              fill={SERIES}
              stroke="#ffffff"
              strokeWidth={2}
              label={{ value: last.level!.toFixed(2), position: "right", fill: "#0f172a", fontSize: 12, fontWeight: 600 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-slate-500">หน่วย: {copy.station.msl} (เมตรเหนือระดับทะเลปานกลาง)</p>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-brand-700">{copy.map.tableView}</summary>
        <table className="num mt-2 w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 font-semibold">เวลา</th>
              <th className="py-1 font-semibold">ระดับ ({copy.station.msl})</th>
              <th className="py-1 font-semibold">{copy.station.gapToBank}</th>
            </tr>
          </thead>
          <tbody>
            {readings
              .slice(-24)
              .reverse()
              .map((r) => (
                <tr key={r.ts} className="border-t border-slate-100">
                  <td className="py-1">{hourFmt.format(new Date(r.ts))} น. {tickFmt.format(new Date(r.ts))}</td>
                  <td className="py-1">{r.level_msl.toFixed(2)}</td>
                  <td className="py-1">{formatBankGap(r.diff_wl_bank)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
