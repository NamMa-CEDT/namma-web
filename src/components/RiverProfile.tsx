import type { CSSProperties } from "react";
import { Link } from "react-router";
import type { StationSummary } from "../api/types";
import { copy } from "../copy";
import { formatBankGap, formatDateTime } from "../lib/format";
import { stationTier, tierInfo } from "../lib/tiers";
import { TierBadge } from "./TierBadge";

// DS RiverProfile: the track covers 4 m below the bank to 2 m above it; --bank (66.667) is set by nm-profile.
const BELOW_M = 4;
const RANGE_M = 6;

export function staffFill(diff: number): number {
  return Math.max(0, Math.min(100, ((diff + BELOW_M) / RANGE_M) * 100));
}

interface River {
  name: string;
  stations: StationSummary[];
}

/**
 * Upstream first. The main stem by stem_order (RID key stations only: the HII stations on the same stem
 * would double every place); branches and tributaries each in their own group, north to south (the basin
 * drains south), so a branch station never follows a main-stem station whose water it doesn't receive.
 */
export function riverGroups(stations: StationSummary[]): River[] {
  const withReading = stations.filter((s) => s.latest?.diff_wl_bank != null && s.agency === "RID");
  const main = withReading.filter((s) => s.role === "main" && s.stem_order != null).sort((a, b) => a.stem_order! - b.stem_order!);
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

export function RiverProfile({ stations }: { stations: StationSummary[] }) {
  const rivers = riverGroups(stations);
  if (!rivers.length) return <p className="m-0 text-body text-ink-muted">{copy.river.empty}</p>;
  const latest = rivers
    .flatMap((r) => r.stations.map((s) => s.latest?.ts))
    .filter((t): t is string => !!t)
    .sort()
    .at(-1);
  return (
    <figure className="m-0 grid gap-4">
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
      <figcaption className="nm-source">
        {copy.river.sourceLead} · <span className="num">{formatDateTime(latest)}</span> · {copy.river.estimated}
      </figcaption>
    </figure>
  );
}
