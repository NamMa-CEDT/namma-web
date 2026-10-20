import { useState } from "react";
import type { River, StationSummary } from "../../api/types";
import { agencyName, copy } from "../../copy";
import { formatBankGap, formatDistance, trendDirection } from "../../lib/format";
import { stationTier, tierInfo } from "../../lib/tiers";
import { TierBadge } from "../../components/TierBadge";
import { FOLDED_RIVERS } from "../../components/RiverProfile";
import { StationName } from "./StationSheet";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "../../components/icons";

/** Why /api/rivers listed it, or where it runs when the reason says nothing. */
function riverNote(r: River): string {
  if (r.reason === "at_risk" && r.worst_tier) return copy.river.reason.atRisk(tierInfo(r.worst_tier).label);
  if (r.reason === "near_you") return copy.river.reason.nearYou(formatDistance(r.distance_km));
  const p = r.provinces;
  return p.length > 1 ? copy.river.fromTo(p[0], p[p.length - 1]) : (p[0] ?? "");
}

/**
 * The rivers worth watching now (over or near the bank first, then the one by the user's place), each a way into
 * its stations. Doubles, with the summary's filtered list, as the accessible list when map tiles fail.
 */
export function RiverList({ rivers, onPick }: { rivers: River[]; onPick: (r: River) => void }) {
  const [open, setOpen] = useState(false);
  if (!rivers.length) return null;
  const fallback = rivers.every((r) => r.reason === "largest");
  // The river by the user's place is listed last by the API; never fold it away.
  const folded = open ? rivers : rivers.filter((r, i) => i < FOLDED_RIVERS || r.reason === "near_you");
  const hidden = rivers.length - folded.length;
  return (
    <div className="px-4 py-3">
      <h2 className="m-0 text-heading font-semibold">{copy.map.riversTitle}</h2>
      <p className="m-0 text-caption text-ink-muted">{fallback ? copy.map.riversLargest : copy.map.riversHint}</p>
      <ul className="m-0 mt-1 list-none p-0">
        {folded.map((r) => (
          <li key={r.key} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => onPick(r)}
              className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left hover:bg-surface-sunken"
            >
              <span className="min-w-0">
                <span className="block text-body font-semibold">{r.name_th}</span>
                <span className="num block text-caption text-ink-muted">
                  {riverNote(r)} · {copy.river.search.stations(r.stations.length)}
                </span>
              </span>
              {r.worst_tier && <TierBadge tier={r.worst_tier} soft />}
            </button>
          </li>
        ))}
      </ul>
      {(hidden > 0 || open) && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 min-h-9 text-caption font-semibold text-river underline">
          {open ? copy.river.showLess : copy.river.showMore(hidden)}
        </button>
      )}
    </div>
  );
}

/**
 * One river as a line: its stations upstream → downstream, so a flood wave moving down it is readable at a glance.
 * Levels come from the live station list where it has the station.
 */
export function RiverStrip({
  river,
  live,
  showHii,
  onSelect,
  onBack,
}: {
  river: River;
  live: Map<number, StationSummary>;
  showHii: boolean;
  onSelect: (id: number) => void;
  onBack: () => void;
}) {
  const all = river.stations.map((s) => live.get(s.id) ?? s);
  const stations = showHii ? all : all.filter((s) => s.agency !== "HII");
  const hidden = all.length - stations.length;
  return (
    <div className="px-4 py-3">
      <h2 className="m-0 text-heading font-semibold">{copy.map.riverStations(river.name_th)}</h2>
      <p className="m-0 text-caption text-ink-muted">{copy.river.upstreamFirst}</p>
      <ol className="m-0 mt-1 list-none p-0">
        {stations.map((s, i) => (
          <StripRow key={s.id} s={s} first={i === 0} last={i === stations.length - 1} onSelect={onSelect} />
        ))}
      </ol>
      {hidden > 0 && <p className="m-0 mt-1 text-caption text-ink-muted">{copy.map.riverHidden(hidden)}</p>}
      <button type="button" onClick={onBack} className="mt-2 min-h-9 text-caption font-semibold text-river underline">
        {copy.map.riverBack}
      </button>
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

export function StripRow({
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
            {s.province ? `จ.${s.province} · ` : ""}
            {agencyName(s.agency)}
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
