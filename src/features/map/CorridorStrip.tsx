import type { StationSummary } from "../../api/types";
import { agencyName, copy } from "../../copy";
import { formatBankGap, trendDirection } from "../../lib/format";
import { stationTier } from "../../lib/tiers";
import { TierBadge } from "../../components/TierBadge";
import { StationName } from "./StationSheet";
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
      <h2 className="m-0 text-heading font-semibold">{copy.map.corridor}</h2>
      <ol className="m-0 mt-1 list-none p-0">
        {main.map((s, i) => (
          <StripRow key={s.id} s={s} first={i === 0} last={i === main.length - 1} onSelect={onSelect} />
        ))}
      </ol>
      {others.length > 0 && (
        <>
          <h2 className="m-0 mt-4 text-heading font-semibold">{copy.map.branches}</h2>
          <ol className="m-0 mt-1 list-none p-0">
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
  const Icon = dir === "up" ? ArrowUpIcon : dir === "down" ? ArrowDownIcon : dir === "flat" ? MinusIcon : null;
  if (!Icon) return null;
  const label = dir === "up" ? "สูงขึ้น" : dir === "down" ? "ลดลง" : "ทรงตัว";
  return (
    <>
      <Icon className={`text-[16px] ${dir === "up" ? "text-ink" : "text-ink-muted"}`} />
      <span className="sr-only">{label}</span>
    </>
  );
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
  return (
    <li className="relative">
      {!standalone && (
        <span
          aria-hidden="true"
          className={`absolute left-[11px] w-[3px] bg-water ${first ? "top-1/2" : "top-0"} ${last ? "h-1/2" : "bottom-0"}`}
        />
      )}
      <button
        type="button"
        onClick={() => onSelect(s.id)}
        className="relative flex min-h-14 w-full items-center gap-3 py-2 pr-1 text-left hover:bg-surface-sunken"
      >
        {/* The station on the river line: its tier shape, on a ring of the page colour. */}
        <span aria-hidden="true" className="relative z-10 grid size-6 shrink-0 place-items-center rounded-full bg-surface">
          <span className={`nm-pin nm-pin--${tier}`} style={{ width: 16, height: 16 }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold">
            <StationName name={s.name_th} code={s.oldcode} />
          </span>
          <span className="block truncate text-caption text-ink-muted">
            จ.{s.province} · {agencyName(s.agency)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <TierBadge tier={tier} soft />
          <span className="num flex items-center gap-1 text-caption text-ink-muted">
            <TrendArrow cmPerHr={s.risk?.trend_cm_per_hr} />
            {formatBankGap(s.latest?.diff_wl_bank)}
          </span>
        </span>
      </button>
    </li>
  );
}
