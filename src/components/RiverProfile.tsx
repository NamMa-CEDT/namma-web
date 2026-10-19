import { useState, type CSSProperties } from "react";
import { Link } from "react-router";
import type { River as ApiRiver, StationSummary } from "../api/types";
import { agencyName, copy } from "../copy";
import { formatBankGap, formatDateTime, formatDistance } from "../lib/format";
import { stationTier, tierInfo } from "../lib/tiers";
import { RiverLine } from "./RiverLine";
import { RiverSections } from "./RiverSections";
import { TierBadge } from "./TierBadge";

// DS RiverProfile: the track covers 4 m below the bank to 2 m above it; --bank (66.667) is set by nm-profile.
const BELOW_M = 4;
const RANGE_M = 6;

export function staffFill(diff: number): number {
  return Math.max(0, Math.min(100, ((diff + BELOW_M) / RANGE_M) * 100));
}

/** One river as the charts draw it: stations with a reading, upstream first. */
export interface River {
  key: string;
  name: string;
  /** Why it is shown ("มีสถานีล้นตลิ่ง", "ใกล้ที่ที่คุณบันทึกไว้"); null when that says nothing. */
  note: string | null;
  /** The river by the saved place: shown even when the list is folded. */
  pinned: boolean;
  stations: StationSummary[];
}

/** /api/rivers already groups, removes duplicate gauges and orders upstream first; this keeps the readable part. */
export function fromApi(rivers: ApiRiver[]): River[] {
  return rivers
    .map((r) => ({
      key: r.key,
      name: r.name_th,
      note:
        r.reason === "at_risk" && r.worst_tier
          ? copy.river.reason.atRisk(tierInfo(r.worst_tier).label)
          : r.reason === "near_you"
            ? copy.river.reason.nearYou(formatDistance(r.distance_km))
            : null,
      pinned: r.reason === "near_you",
      stations: r.stations.filter((s) => s.latest?.diff_wl_bank != null),
    }))
    .filter((r) => r.stations.length > 0);
}

/** Rivers shown before "แสดงอีก": on a bad day a dozen rivers can be over the bank. */
export const FOLDED_RIVERS = 6;

/** The first FOLDED_RIVERS in the server's order (worst first), plus the pinned one wherever it falls. */
export function visibleRivers(rivers: River[], expanded: boolean): River[] {
  if (expanded || rivers.length <= FOLDED_RIVERS) return rivers;
  const first = rivers.filter((r) => !r.pinned).slice(0, FOLDED_RIVERS);
  return rivers.filter((r) => first.includes(r) || r.pinned);
}

/** The note beside a river's name, if any. */
export function RiverNote({ river }: { river: River }) {
  return river.note ? <span className="text-caption font-normal text-ink-muted"> · {river.note}</span> : null;
}

/** One staff gauge; the whole gauge links to the station on the map. */
function Staff({ s }: { s: StationSummary }) {
  const diff = s.latest!.diff_wl_bank!;
  const tier = stationTier(s);
  const reading = formatBankGap(diff);
  return (
    <li className="nm-profile__station">
      <Link to={`/map?station=${s.id}`} aria-label={`${s.name_th ?? ""} ${s.oldcode ?? ""} ${reading} ${tierInfo(tier).label}`}>
        <div className="nm-staff" style={{ "--fill": staffFill(diff) } as CSSProperties} aria-hidden="true">
          <div className="nm-staff__water" />
          <div className="nm-staff__over" />
        </div>
        <div className="nm-profile__place">{s.name_th}</div>
        <div className="nm-profile__code">{s.oldcode}</div>
        <div className="nm-profile__reading">{reading}</div>
        <TierBadge tier={tier} soft />
      </Link>
    </li>
  );
}

/** The original chart: one staff gauge per station, side by side, one shared bank line. Scrolls sideways. */
function StaffGauges({ rivers }: { rivers: River[] }) {
  return (
    <div className="grid gap-2">
      <p className="m-0 text-caption text-ink-muted sm:hidden">{copy.home.scrollHint}</p>
      <div className="nm-profile">
        <div className="nm-profile__axis" aria-hidden="true">
          <span style={{ bottom: "83.333%" }}>{copy.river.axisOver1}</span>
          <span className="is-bank" style={{ bottom: "66.667%" }}>
            {copy.river.axisBank}
          </span>
          <span style={{ bottom: "33.333%" }}>{copy.river.axisBelow2}</span>
          <span style={{ bottom: "0%" }}>{copy.river.axisBelow4}</span>
        </div>
        <div className="nm-profile__scroll" tabIndex={0} aria-label={copy.home.riverTitle}>
          <div className="nm-profile__rivers">
            {rivers.map((r) => (
              <section key={r.key} className="nm-profile__river">
                <h3 className="nm-profile__name">
                  {r.name}
                  <RiverNote river={r} />
                </h3>
                <ol className="nm-profile__stations">
                  {r.stations.map((s) => (
                    <Staff key={s.id} s={s} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The three ways to draw the same readings (River Now redesign): staff gauges, river line (E), cross-sections (F). */
export type RiverView = "staff" | "line" | "sections";
export const RIVER_VIEWS: RiverView[] = ["staff", "line", "sections"];
const VIEW_KEY = "namma.riverView";

/** The last chart this browser picked; a convenience only, so any storage failure falls back to the gauges. */
export function readRiverView(): RiverView {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return RIVER_VIEWS.includes(v as RiverView) ? (v as RiverView) : "staff";
  } catch {
    return "staff";
  }
}

function saveRiverView(v: RiverView): void {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }
}

function ViewToggle({ view, onChange }: { view: RiverView; onChange: (v: RiverView) => void }) {
  return (
    <div role="group" aria-label={copy.river.views.label} className="flex rounded-md border border-line-strong p-0.5 sm:inline-flex sm:self-start">
      {RIVER_VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === view}
          onClick={() => onChange(v)}
          className={`min-h-11 flex-1 rounded-[8px] px-1 text-caption font-semibold sm:flex-none sm:px-4 sm:text-label ${
            v === view ? "bg-river text-on-river" : "text-ink-muted hover:text-ink"
          }`}
        >
          {copy.river.views[v]}
        </button>
      ))}
    </div>
  );
}

export function RiverProfile({ rivers: fromServer }: { rivers: ApiRiver[] }) {
  const [view, setView] = useState(readRiverView);
  const [expanded, setExpanded] = useState(false);
  const all = fromApi(fromServer);
  const rivers = visibleRivers(all, expanded);
  const hidden = all.length - rivers.length;
  if (!rivers.length) return <p className="m-0 text-body text-ink-muted">{copy.river.empty}</p>;
  const latest = rivers
    .flatMap((r) => r.stations.map((s) => s.latest?.ts))
    .filter((t): t is string => !!t)
    .sort()
    .at(-1);
  const agencies = [...new Set(rivers.flatMap((r) => r.stations.map((s) => agencyName(s.agency))))];
  const choose = (v: RiverView) => {
    setView(v);
    saveRiverView(v);
  };
  return (
    <figure className="m-0 grid gap-4">
      <ViewToggle view={view} onChange={choose} />
      {view === "line" ? (
        <RiverLine rivers={rivers} />
      ) : view === "sections" ? (
        <RiverSections rivers={rivers} />
      ) : (
        <StaffGauges rivers={rivers} />
      )}
      {(hidden > 0 || expanded) && all.length > FOLDED_RIVERS && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
          className="min-h-11 justify-self-start font-semibold text-river"
        >
          {expanded ? copy.river.showLess : copy.river.showMore(hidden)}
        </button>
      )}
      <figcaption className="nm-source">
        {copy.river.sourceLead(agencies)} · <span className="num">{formatDateTime(latest)}</span> · {copy.river.estimated}
        {view !== "staff" && ` · ${copy.river.notes[view]}`}
      </figcaption>
    </figure>
  );
}
