import type { StationSummary } from "../../api/types";
import { copy } from "../../copy";
import { formatBankGap, trendDirection } from "../../lib/format";
import { stationTier, tierInfo } from "../../lib/tiers";
import { TierBadge } from "../../components/TierBadge";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "../../components/icons";

/**
 * The river as a line: stations upstream → downstream, so the flood wave moving south is
 * readable at a glance. Doubles as the accessible list / fallback when map tiles fail.
 */
export function CorridorStrip({
  stations,
  onSelect,
}: {
  stations: StationSummary[];
  onSelect: (id: number) => void;
}) {
  const main = stations
    .filter((s) => s.role === "main" && s.stem_order != null)
    .sort((a, b) => a.stem_order! - b.stem_order! || (a.agency === "RID" ? -1 : 1));
  const others = stations.filter((s) => s.role !== "main");

  return (
    <div className="px-4 py-3">
      <h2 className="text-sm font-semibold text-slate-700">{copy.map.corridor}</h2>
      <ol className="mt-2">
        {main.map((s, i) => (
          <StripRow key={s.id} s={s} first={i === 0} last={i === main.length - 1} onSelect={onSelect} />
        ))}
      </ol>
      {others.length > 0 && (
        <>
          <h2 className="mt-4 text-sm font-semibold text-slate-700">{copy.map.branches}</h2>
          <ol className="mt-2">
            {others.map((s) => (
              <StripRow key={s.id} s={s} onSelect={onSelect} standalone />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function TrendArrow({ cmPerHr }: { cmPerHr: number | null | undefined }) {
  const dir = trendDirection(cmPerHr);
  if (dir === "up") return <ArrowUpIcon aria-label="กำลังขึ้น" className="text-slate-700" />;
  if (dir === "down") return <ArrowDownIcon aria-label="กำลังลง" className="text-slate-400" />;
  if (dir === "flat") return <MinusIcon aria-label="ทรงตัว" className="text-slate-400" />;
  return null;
}

function StripRow({
  s,
  onSelect,
  first = false,
  last = false,
  standalone = false,
}: {
  s: StationSummary;
  onSelect: (id: number) => void;
  first?: boolean;
  last?: boolean;
  standalone?: boolean;
}) {
  const tier = stationTier(s);
  const t = tierInfo(tier);
  return (
    <li className="relative">
      {!standalone && (
        <span
          aria-hidden="true"
          className={`absolute left-[11px] w-0.5 bg-sky-200 ${first ? "top-1/2" : "top-0"} ${last ? "h-1/2" : "bottom-0"}`}
        />
      )}
      <button
        type="button"
        onClick={() => onSelect(s.id)}
        className="relative flex w-full items-center gap-3 rounded-lg py-2 pr-2 text-left hover:bg-slate-50"
      >
        <span
          aria-hidden="true"
          className="relative z-10 ml-[5px] inline-block shrink-0 rounded-full ring-2 ring-white"
          style={{
            width: s.agency === "HII" ? 10 : 14,
            height: s.agency === "HII" ? 10 : 14,
            marginLeft: s.agency === "HII" ? 7 : 5,
            background: tier === "unknown" ? "white" : t.color,
            border: tier === "unknown" ? "1.5px dashed #71717a" : undefined,
          }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">
            <span className="font-semibold">{s.oldcode}</span> {s.name_th}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {s.province} · {s.agency}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <TierBadge tier={tier} size="sm" />
          <span className="num flex items-center gap-1 text-xs text-slate-600">
            <TrendArrow cmPerHr={s.risk?.trend_cm_per_hr} />
            {formatBankGap(s.latest?.diff_wl_bank)}
          </span>
        </span>
      </button>
    </li>
  );
}
