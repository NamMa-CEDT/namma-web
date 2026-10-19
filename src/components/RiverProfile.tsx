import { useState, type CSSProperties } from "react";
import { Link } from "react-router";
import type { StationSummary } from "../api/types";
import { copy } from "../copy";
import { formatBankGap, formatDateTime } from "../lib/format";
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

export interface River {
  name: string;
  stations: StationSummary[];
}

/** Stations this close gauge the same place (C.35 and CPY011 are 10 m apart; the nearest distinct pair is 8 km). */
const SAME_PLACE_KM = 3;

/** Flat-earth distance: exact enough at a few km. */
function km(a: StationSummary, b: StationSummary): number {
  const x = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(x, b.lat - a.lat) * 111.2;
}

/**
 * Upstream first. The main stem by stem_order, RID and HII together; where two stations gauge the same place
 * the RID one stands for it (stem_order can't tell: it differs for C.35 and CPY011). Branches and tributaries
 * each in their own group, north to south (the basin drains south), so a branch station never follows a
 * main-stem station whose water it doesn't receive.
 */
export function riverGroups(stations: StationSummary[]): River[] {
  const withReading = stations.filter((s) => s.latest?.diff_wl_bank != null);
  const stem = withReading
    .filter((s) => s.role === "main" && s.stem_order != null)
    .sort((a, b) => Number(b.agency === "RID") - Number(a.agency === "RID"));
  const main: StationSummary[] = [];
  for (const s of stem) if (!main.some((m) => km(m, s) < SAME_PLACE_KM)) main.push(s);
  main.sort((a, b) => a.stem_order! - b.stem_order!);
  const groups: River[] = main.length ? [{ name: main[0].river ?? copy.river.main, stations: main }] : [];
  for (const role of ["branch", "tributary"] as const) {
    const list = withReading.filter((s) => s.role === role).sort((a, b) => b.lat - a.lat);
    if (!list.length) continue;
    const names = [...new Set(list.map((s) => s.river).filter(Boolean))];
    groups.push({ name: names.join(" และ "), stations: list });
  }
  return groups;
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
              <section key={r.name} className="nm-profile__river">
                <h3 className="nm-profile__name">{r.name}</h3>
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

export function RiverProfile({ stations }: { stations: StationSummary[] }) {
  const [view, setView] = useState(readRiverView);
  const rivers = riverGroups(stations);
  if (!rivers.length) return <p className="m-0 text-body text-ink-muted">{copy.river.empty}</p>;
  const latest = rivers
    .flatMap((r) => r.stations.map((s) => s.latest?.ts))
    .filter((t): t is string => !!t)
    .sort()
    .at(-1);
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
      <figcaption className="nm-source">
        {copy.river.sourceLead} · <span className="num">{formatDateTime(latest)}</span> · {copy.river.estimated}
        {view !== "staff" && ` · ${copy.river.notes[view]}`}
      </figcaption>
    </figure>
  );
}
