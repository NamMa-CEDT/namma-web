import type { Map as LeafletMap } from "leaflet";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { API_MODE } from "../../api/client";
import { useNearest, useProfile, useRivers, useStations } from "../../api/queries";
import type { LatLon, River, SavedPlace, StationSummary } from "../../api/types";
import { HouseIcon, LocateIcon } from "../../components/icons";
import { BasemapPicker, MapHud } from "../../components/MapHud";
import { RiverSearch } from "../../components/RiverSearch";
import { ErrorState, Loading } from "../../components/States";
import { TierBadge, TierShape } from "../../components/TierBadge";
import { agencyName, copy, DDPM } from "../../copy";
import type { Basemap } from "../../lib/basemaps";
import { loadSessionId } from "../../lib/chatSession";
import { readFloodFocus } from "../../lib/floodLink";
import { formatBankGap, formatDistance } from "../../lib/format";
import { getCurrentPosition } from "../../lib/geolocation";
import { stationTier, TIER_ORDER, tierInfo, type TierKey } from "../../lib/tiers";
import { RiverList, RiverStrip, StripRow } from "./RiverStrip";
import { StationName, StationSheet } from "./StationSheet";

const StationMap = lazy(() => import("./StationMap"));
const MAX_PLACES = 3;
/** Stations listed per page when a level filter is on: across the country that can be hundreds. */
const FILTER_PAGE = 20;

/** Every tier as word + shape; tiers are NamMa's estimate, so the legend says so. */
function Legend() {
  return (
    <div className="rounded-md border border-line-strong bg-surface-raised px-3 py-2 shadow-float">
      <div className="text-caption font-semibold text-ink">{copy.map.legend}</div>
      <div className="mb-1 text-caption text-ink-muted">{copy.map.estimated}</div>
      <ul className="m-0 grid list-none gap-0.5 p-0">
        {TIER_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-2 text-caption text-ink">
            <TierShape tier={k} />
            {tierInfo(k).label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Where "stations near" is measured from: a GPS fix or a tap on the map (no label), a saved place, or the place a
 * chat answer linked here with. */
interface NearFrom {
  point: LatLon;
  label: string | null;
  /** The saved place it is, if any. */
  placeId: number | null;
}

function NearPanel({ from, onSelect }: { from: NearFrom; onSelect: (id: number) => void }) {
  const near = useNearest(from.point, 3);
  return (
    <section className="border-b border-line px-4 py-3">
      <h2 className="m-0 text-heading font-semibold">{from.label ? copy.map.nearPlace(from.label) : copy.map.nearYou}</h2>
      {near.isPending ? (
        <Loading />
      ) : near.isError ? (
        <ErrorState error={near.error} onRetry={() => near.refetch()} />
      ) : (
        <ul className="m-0 mt-1 list-none p-0">
          {near.data.map((s) => (
            <li key={s.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left hover:bg-surface-sunken"
              >
                <span className="min-w-0">
                  <span className="block text-body font-semibold">
                    <StationName name={s.name_th} code={s.oldcode} />
                  </span>
                  <span className="num block text-caption text-ink-muted">
                    ห่าง {formatDistance(s.distance_km)} · {formatBankGap(s.latest?.diff_wl_bank)}
                  </span>
                </span>
                <TierBadge tier={stationTier(s)} soft />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Each saved place with its nearest station's level now (live from the station list when it's there, else the
 * profile's copy), and a way to list the other stations near it. */
function PlaceStatus({
  places,
  stations,
  active,
  onStation,
  onNear,
}: {
  places: SavedPlace[];
  stations: StationSummary[];
  active: number | null;
  onStation: (id: number) => void;
  onNear: (p: SavedPlace) => void;
}) {
  if (!places.length) return null;
  return (
    <section className="border-b border-line px-4 py-3">
      <h2 className="m-0 text-heading font-semibold">{copy.map.placesTitle}</h2>
      <ul className="m-0 mt-1 list-none p-0">
        {places.map((p) => {
          const n = p.nearest;
          const live = n ? stations.find((s) => s.id === n.station_id) : undefined;
          const tier: TierKey = live ? stationTier(live) : (n?.risk_tier ?? "unknown");
          const gap = live ? live.latest?.diff_wl_bank : n?.diff_wl_bank;
          const name = live?.name_th ?? n?.name_th ?? copy.unknown;
          const code = live?.oldcode ?? n?.code;
          const head = (
            <span className="flex items-center gap-1.5 text-body font-semibold">
              <HouseIcon className="shrink-0 text-[18px] text-home" />
              {p.label}
            </span>
          );
          return (
            <li key={p.id} className="border-b border-line py-1 last:border-b-0">
              {n ? (
                <button
                  type="button"
                  onClick={() => onStation(n.station_id)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 py-1 text-left hover:bg-surface-sunken"
                >
                  <span className="min-w-0">
                    {head}
                    <span className="num block text-caption text-ink-muted">
                      {copy.map.placeNearest(`${name}${code ? ` (${code})` : ""}`, formatDistance(n.distance_km) ?? "")} ·{" "}
                      {formatBankGap(gap)}
                    </span>
                  </span>
                  <TierBadge tier={tier} soft />
                </button>
              ) : (
                <div className="py-1">
                  {head}
                  <p className="m-0 text-caption text-ink-muted">{copy.map.placeNoStation}</p>
                </div>
              )}
              <button
                type="button"
                aria-pressed={p.id === active}
                onClick={() => onNear(p)}
                className={`-ml-2 min-h-9 rounded-md px-2 text-caption font-semibold ${
                  p.id === active ? "bg-river-soft text-river" : "text-river hover:bg-river-soft"
                }`}
              >
                {copy.map.placeMore}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** How many stations sit at each level now, each a filter for the map and the lists; with no filter, the stations
 * most worth watching, highest level and nearest the bank first. */
function Summary({
  stations,
  tier,
  onTier,
  onSelect,
}: {
  stations: StationSummary[];
  tier: TierKey | null;
  onTier: (t: TierKey | null) => void;
  onSelect: (id: number) => void;
}) {
  const [limit, setLimit] = useState(FILTER_PAGE);
  const [limitFor, setLimitFor] = useState(tier);
  if (limitFor !== tier) {
    setLimitFor(tier);
    setLimit(FILTER_PAGE);
  }
  const counts = new Map<TierKey, number>();
  for (const s of stations) counts.set(stationTier(s), (counts.get(stationTier(s)) ?? 0) + 1);
  const rank = (s: StationSummary) => tierInfo(stationTier(s)).rank;
  const byConcern = (a: StationSummary, b: StationSummary) =>
    rank(b) - rank(a) || (b.latest?.diff_wl_bank ?? -99) - (a.latest?.diff_wl_bank ?? -99);
  const worrying = stations.filter((s) => rank(s) >= tierInfo("watch").rank).sort(byConcern).slice(0, 5);
  const inTier = tier ? stations.filter((s) => stationTier(s) === tier).sort(byConcern) : [];
  return (
    <section className="border-b border-line px-4 py-3">
      <h2 className="m-0 text-heading font-semibold">{copy.map.summaryTitle}</h2>
      <div role="group" aria-label={copy.map.filterLabel} className="mt-2 flex flex-wrap gap-1.5">
        {TIER_ORDER.filter((k) => counts.get(k)).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === tier}
            onClick={() => onTier(k === tier ? null : k)}
            className={`flex min-h-9 items-center gap-1.5 rounded-pill border px-3 text-caption font-semibold ${
              k === tier ? "border-river bg-river-soft text-ink shadow-[inset_0_0_0_1px_var(--river)]" : "border-line-strong text-ink hover:bg-surface-sunken"
            }`}
          >
            <TierShape tier={k} />
            {tierInfo(k).label}
            <span className="num text-ink-muted">{counts.get(k)}</span>
          </button>
        ))}
      </div>
      <p className="m-0 mt-1 text-caption text-ink-muted">{copy.map.estimated}</p>
      {tier ? (
        <p className="m-0 mt-2 flex flex-wrap items-center gap-x-2 text-caption" role="status">
          {copy.map.filtered(tierInfo(tier).label, counts.get(tier) ?? 0)}
          <button type="button" onClick={() => onTier(null)} className="min-h-9 font-semibold text-river underline">
            {copy.map.filterClear}
          </button>
        </p>
      ) : null}
      {tier ? (
        <>
          <ol className="m-0 mt-1 list-none p-0">
            {inTier.slice(0, limit).map((s) => (
              <StripRow key={s.id} s={s} onSelect={onSelect} standalone />
            ))}
          </ol>
          {inTier.length > limit && (
            <button
              type="button"
              onClick={() => setLimit(limit + FILTER_PAGE)}
              className="mt-1 min-h-9 text-caption font-semibold text-river underline"
            >
              {copy.map.showMoreStations(Math.min(FILTER_PAGE, inTier.length - limit))}
            </button>
          )}
        </>
      ) : worrying.length ? (
        <>
          <h3 className="m-0 mt-3 text-caption font-semibold text-ink-muted">{copy.map.worrying}</h3>
          <ul className="m-0 list-none p-0">
            {worrying.map((s) => (
              <li key={s.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left hover:bg-surface-sunken"
                >
                  <span className="min-w-0">
                    <span className="block text-body font-semibold">
                      <StationName name={s.name_th} code={s.oldcode} />
                    </span>
                    <span className="num block text-caption text-ink-muted">
                      {[s.river, formatBankGap(s.latest?.diff_wl_bank)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <TierBadge tier={stationTier(s)} soft />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="m-0 mt-2 text-body">{copy.map.allCalm}</p>
      )}
    </section>
  );
}

function Notes({ agencies }: { agencies: string[] }) {
  return (
    <div className="grid gap-2 border-t border-line px-4 pt-3 pb-4 text-caption text-ink-muted">
      <p className="m-0">{copy.station.stationNotHouse}</p>
      <p className="m-0">
        {copy.footer.unofficial} · {copy.footer.emergency}{" "}
        <a href={DDPM.telHref} className="font-semibold text-tier-danger-ink underline">
          {DDPM.hotline}
        </a>
      </p>
      <p className="m-0">
        {copy.footer.dataCredit} · {agencies.map(agencyName).join(", ")}
      </p>
    </div>
  );
}

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("station") ? Number(params.get("station")) : null;
  const stations = useStations();
  const profile = useProfile(loadSessionId());
  const places = useMemo(() => profile.data?.places.slice(0, MAX_PLACES) ?? [], [profile.data]);
  // Opened from a chat answer: that place's nearest stations, the place pinned (unless it is a saved place already).
  const focus = readFloodFocus(params);
  const focusKey = focus ? `${focus.lat},${focus.lon},${focus.label}` : "";
  const pins = useMemo(() => {
    const out = places.map((p) => ({ lat: p.lat, lon: p.lon, label: p.label }));
    const near = (p: LatLon) => focus != null && Math.abs(p.lat - focus.lat) < 1e-4 && Math.abs(p.lon - focus.lon) < 1e-4;
    if (focus && !out.some(near)) out.push({ lat: focus.lat, lon: focus.lon, label: focus.label });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, focusKey]);
  const tierParam = params.get("tier");
  const tier = TIER_ORDER.find((k) => k === tierParam) ?? null;
  const [showHii, setShowHii] = useState(false);
  const [nearFrom, setNearFrom] = useState<NearFrom | null>(null);
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [riverText, setRiverText] = useState("");
  const [river, setRiver] = useState<River | null>(null); // the river picked in the search: the map zooms to it
  const [basemap, setBasemap] = useState<Basemap>("streets");
  const [controlsOpen, setControlsOpen] = useState(false);
  const [leaflet, setLeaflet] = useState<LeafletMap | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  const select = useCallback(
    (id: number | null) => {
      const next = new URLSearchParams(params);
      if (id == null) next.delete("station");
      else next.set("station", String(id));
      setParams(next, { replace: id == null });
    },
    [params, setParams],
  );

  const locate = async () => {
    setLocating(true);
    setNotice(null);
    try {
      setNearFrom({ point: await getCurrentPosition(), label: null, placeId: null });
      setPicking(false);
    } catch {
      setPicking(true);
      setNotice(copy.map.locationFailed);
    } finally {
      setLocating(false);
    }
  };

  const nearPlace = (p: SavedPlace) => {
    setNearFrom({ point: { lat: p.lat, lon: p.lon }, label: p.label, placeId: p.id });
    setPicking(false);
    setNotice(null);
  };

  const setTier = (t: TierKey | null) => {
    const next = new URLSearchParams(params);
    if (t) next.set("tier", t);
    else next.delete("tier");
    setParams(next, { replace: true });
  };

  // The rivers list: at-risk rivers, then the one by the point in use (a GPS fix, a chat place, the first saved place).
  const riverNear = nearFrom?.point ?? (focus ? { lat: focus.lat, lon: focus.lon } : null) ?? places[0] ?? null;
  const rivers = useRivers(riverNear ? { lat: riverNear.lat, lon: riverNear.lon } : null);
  const pickRiver = (r: River | null) => {
    setRiver(r);
    setRiverText(r?.name_th ?? "");
  };

  const onTilesFailed = useCallback(() => setTilesFailed(true), []);
  const onMap = useCallback((m: LeafletMap) => {
    setLeaflet(m);
    setZoom(m.getZoom());
  }, []);

  if (stations.isPending) return <Loading className="h-full" />;
  if (stations.isError) return <ErrorState className="h-full" error={stations.error} onRetry={() => stations.refetch()} />;

  const all = stations.data;
  const live = new Map(all.map((s) => [s.id, s]));
  // Data credit: the agencies behind the stations, most stations first.
  const perAgency = new Map<string, number>();
  for (const s of all) if (s.agency) perAgency.set(s.agency, (perAgency.get(s.agency) ?? 0) + 1);
  const agencies = [...perAgency].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  const selected = all.find((s) => s.id === selectedId) ?? null;
  // RID stations are the primary sources (CLAUDE.md §4); HII 10-min stations are opt-in.
  // Some share a site with an RID station but use a different bank reference.
  // A second agency's gauge at the same spot is drawn and counted once, as the one it duplicates.
  const shown = all.filter(
    (s: StationSummary) => s.id === selectedId || ((showHii || s.agency !== "HII") && s.same_place_as == null),
  );
  const visible = tier ? shown.filter((s) => stationTier(s) === tier || s.id === selectedId) : shown;
  const from: NearFrom | null =
    nearFrom ?? (focus ? { point: { lat: focus.lat, lon: focus.lon }, label: focus.label || null, placeId: null } : null);

  return (
    <div className="flex h-full flex-col lg:flex-row-reverse">
      <div className="relative h-[46%] shrink-0 lg:h-full lg:min-w-0 lg:flex-1">
        <Suspense fallback={<Loading className="h-full" />}>
          <StationMap
            stations={visible}
            selectedId={selectedId}
            point={from?.point ?? null}
            pointIsPlace={from?.placeId != null || (nearFrom == null && focus != null)}
            fitTo={river ? river.stations.map((s) => ({ lat: s.lat, lon: s.lon })) : null}
            picking={picking}
            basemap={basemap}
            places={pins}
            onSelect={select}
            onPick={(p) => {
              setNearFrom({ point: p, label: null, placeId: null });
              setPicking(false);
              setNotice(null);
            }}
            onTilesFailed={onTilesFailed}
            onMap={onMap}
            onZoom={setZoom}
          />
        </Suspense>

        <MapHud
          map={leaflet}
          zoom={zoom}
          open={controlsOpen}
          setOpen={setControlsOpen}
          hint={copy.map.optionsHint}
          hintKey="namma.stationMapOptionsSeen"
        >
          <p className="m-0 text-caption font-semibold text-ink-muted">{copy.map.stationsLabel}</p>
          <label className="flex min-h-11 items-center gap-3 rounded-md bg-surface-sunken px-3 text-body">
            <input
              type="checkbox"
              checked={showHii}
              onChange={(e) => setShowHii(e.target.checked)}
              className="size-5 shrink-0 accent-river"
            />
            {copy.map.showHii}
          </label>
          <BasemapPicker value={basemap} onChange={setBasemap} />
        </MapHud>

        <div className="pointer-events-none absolute top-2.5 right-2.5 z-[500] flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="nm-btn nm-btn--secondary nm-btn--sm pointer-events-auto shadow-float"
          >
            <LocateIcon className="text-[20px] text-river" />
            {locating ? copy.map.locating : copy.map.myLocation}
          </button>
          {(notice || picking || tilesFailed) && (
            <p
              role="status"
              className="pointer-events-auto m-0 max-w-[15rem] rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-caption text-ink shadow-float"
            >
              {tilesFailed ? copy.map.tilesFailed : (notice ?? copy.map.pickHint)}
            </p>
          )}
        </div>
        <div className="absolute bottom-6 left-2 z-[500] hidden sm:block">
          <Legend />
        </div>
      </div>

      <aside className="min-h-0 flex-1 overflow-y-auto border-t border-line bg-surface lg:w-[420px] lg:flex-none lg:border-t-0 lg:border-r">
        {selected ? (
          <StationSheet id={selected.id} onClose={() => select(null)} onSelect={select} />
        ) : (
          <>
            <header className="border-b border-line px-4 py-4">
              <h1 className="m-0 text-title font-semibold">{copy.map.title}</h1>
              <p className="m-0 text-body text-ink-muted">{copy.map.subtitle(all.filter((s) => s.same_place_as == null).length)}</p>
              {API_MODE === "mock" && <p className="nm-stale m-0 mt-3">{copy.map.sample}</p>}
            </header>
            {from && <NearPanel from={from} onSelect={select} />}
            <PlaceStatus places={places} stations={all} active={from?.placeId ?? null} onStation={select} onNear={nearPlace} />
            <Summary stations={shown} tier={tier} onTier={setTier} onSelect={select} />
            <div className="border-b border-line px-4 py-3">
              <RiverSearch
                value={riverText}
                onChange={(v) => {
                  setRiverText(v);
                  if (!v) setRiver(null);
                }}
                onPick={pickRiver}
                className="max-w-md"
              />
              {river && (
                <p className="m-0 mt-2 text-caption text-ink-muted" role="status">
                  {copy.river.search.showOnMap(river.name_th)} · {copy.river.search.stations(river.stations.length)}
                </p>
              )}
            </div>
            {river ? (
              <RiverStrip river={river} live={live} showHii={showHii} onSelect={select} onBack={() => pickRiver(null)} />
            ) : (
              <RiverList rivers={rivers.data ?? []} onPick={pickRiver} />
            )}
            <Notes agencies={agencies} />
          </>
        )}
      </aside>
    </div>
  );
}
