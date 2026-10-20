import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router";
import { API_MODE } from "../../api/client";
import {
  useFloodAreas,
  useFloodCells,
  useFloodHistory,
  useFloodHistoryTambons,
  useFloodNear,
  useFloodTambons,
  useProfile,
  useProvinceShapes,
  useTambonShapes,
} from "../../api/queries";
import type { FloodArea, FloodAreas, FloodHistory, FloodHistoryArea, FloodLevel, FloodPeriod, SavedPlace } from "../../api/types";
import { ErrorState, Loading } from "../../components/States";
import { copy, DDPM } from "../../copy";
import { containsPoint, joinAreas, nameKey, provincesInView, type AreaShape } from "../../lib/boundaries";
import { loadSessionId, type ChatHandoff } from "../../lib/chatSession";
import type { FloodFocus } from "../../lib/floodLink";
import {
  areaName,
  floodClass,
  formatCount,
  formatKm2,
  formatRai,
  historyClass,
  historyShare,
  lastSeen,
  seasonClass,
  type MapClass,
  placeName,
  placeParts,
  shareWords,
  worstYear,
  type FloodClass,
} from "../../lib/flood";
import { formatDate, formatDateTime, formatDistance } from "../../lib/format";
import { distanceToWaterKm, viewBox, waterPatches, type WaterPatch } from "../../lib/water";
import type { Map as LeafletMap } from "leaflet";
import type { Basemap, FlyTarget, MapArea, MapView } from "./FloodMap";
import { HEAT_GRADIENT, heatColor } from "./heat";
import { FloodPatterns, Swatch } from "./patterns";
import { TambonStory } from "./TambonStory";

const FloodMap = lazy(() => import("./FloodMap"));

// The map's layer switch: the latest satellite layers (30 days: where water is now and where it has gone down), or
// the 2011– history.
const LAYERS = ["3days", "7days", "30days", "history"] as const;
// How close to fly when a row is tapped: an amphoe at 11, a tambon at 12.
const FLY_ZOOM: Record<FloodLevel, number> = { province: 9, amphoe: 11, tambon: 12 };
const MAX_PLACES = 3;
// Zoom stages (design row "ซูมเข้าทีละขั้น"): provinces, then tambons (of the provinces in view, nearest first), then
// close up the water itself: GISTDA's cells merged into patches over dashed tambon borders.
const TAMBON_ZOOM = 9;
const WATER_ZOOM = 13;
type Stage = "province" | "tambon" | "water";
const MAX_PROVINCES = 6;
const CLASSES: FloodClass[] = ["many", "some", "few", "none"];
const SEASON_CLASSES: MapClass[] = ["many", "earlier", "none"];
const TOTAL_PROVINCES = 77;
export interface FloodScope {
  period: FloodPeriod;
  province: string | null;
  amphoe: string | null;
  /** The history layer (2011– record) instead of the latest satellite layer. */
  history?: boolean;
  /** History layer: one year, or null for all years. */
  year?: number | null;
}

/** What the legend says: the live layer, or the history layer for one year / all years, zoomed out / in. */
interface LegendText {
  title: string;
  classes: MapClass[];
  labels: Partial<Record<MapClass, string>>;
  note: string;
  /** The 30-day map: close up, water seen only weeks ago is drawn apart from the heat. */
  season?: boolean;
}

function legendText(history: boolean, year: number | null, zoomedIn: boolean, season: boolean): LegendText {
  const h = copy.flood.history;
  const se = copy.flood.season;
  if (season) return { title: se.legend, classes: SEASON_CLASSES, labels: se.cls, note: se.note, season };
  if (!history) return { title: copy.flood.legend, classes: CLASSES, labels: copy.flood.cls, note: copy.flood.legendNote };
  if (year != null) return { title: h.legendYear(year), classes: CLASSES, labels: copy.flood.cls, note: copy.flood.legendNote };
  if (zoomedIn) return { title: h.legendOften, classes: CLASSES, labels: h.often, note: h.oftenNote };
  return { title: h.legendWorst, classes: CLASSES, labels: copy.flood.cls, note: h.worstNote };
}

function Legend({ text, stage }: { text: LegendText; stage: Stage }) {
  return (
    <div className="rounded-md border border-line-strong bg-surface-raised px-3 py-2 shadow-float">
      <div className="text-caption font-semibold text-ink">{text.title}</div>
      {stage === "water" ? (
        <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0 text-caption text-ink">
          <li className="flex flex-col gap-0.5">
            {copy.flood.legendWater}
            <span aria-hidden="true" className="block h-2.5 w-36 rounded-sm" style={{ background: HEAT_GRADIENT }} />
            <span className="flex w-36 justify-between text-ink-muted">
              <span>{copy.flood.heatLow}</span>
              <span>{copy.flood.heatHigh}</span>
            </span>
          </li>
          {text.season && (
            <li className="flex items-center gap-2">
              <Swatch cls="earlier" />
              {copy.flood.season.legendEarlier}
            </li>
          )}
          <li className="flex items-center gap-2">
            <Swatch cls="border" />
            {copy.flood.legendBorder}
          </li>
        </ul>
      ) : (
        <>
          <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0 text-caption text-ink">
            {text.classes.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <Swatch cls={c} />
                {text.labels[c]}
              </li>
            ))}
          </ul>
          <p className="m-0 mt-1 max-w-[14rem] text-caption text-ink-muted">{text.note}</p>
        </>
      )}
    </div>
  );
}

/** "ทุกปี", 2011 … 2024: which year of the history the map shades. `scroll`: one row that scrolls sideways on a phone
 * (the map options sheet), instead of wrapping. */
function YearChips({
  years,
  year,
  onYear,
  scroll = false,
}: {
  years: number[];
  year: number | null;
  onYear: (y: number | null) => void;
  scroll?: boolean;
}) {
  const options: (number | null)[] = [null, ...years];
  return (
    <div
      role="group"
      aria-label={copy.flood.history.yearLabel}
      className={`flex flex-wrap gap-1.5 ${scroll ? "max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none]" : ""}`}
    >
      {options.map((y) => (
        <button
          key={y ?? "all"}
          type="button"
          aria-pressed={y === year}
          onClick={() => onYear(y)}
          className={`num min-h-9 shrink-0 rounded-pill border px-3 text-caption font-semibold ${
            y === year ? "border-river bg-river text-on-river" : "border-line-strong text-ink-muted hover:text-ink"
          }`}
        >
          {y ?? copy.flood.history.allYears}
        </button>
      ))}
    </div>
  );
}
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  name,
  flush = false,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  name: (v: T) => string;
  /** Inside a panel that already draws the frame: no border, fill or shadow of its own. */
  flush?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`pointer-events-auto rounded-md p-0.5 ${flush ? "flex bg-surface-sunken" : "inline-flex border border-line-strong bg-surface-raised shadow-float"}`}
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`min-h-9 rounded-[8px] px-2 text-label font-semibold whitespace-nowrap ${flush ? "flex-1" : ""} ${
            o === value ? "bg-river text-on-river" : "text-ink-muted hover:text-ink"
          }`}
        >
          {name(o)}
        </button>
      ))}
    </div>
  );
}

// The basemap picture buttons: one real tile of each, the upper Gulf of Thailand at zoom 8.
const BASEMAP_THUMB: Record<Basemap, string> = {
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/8/118/199",
  streets: "https://tile.openstreetmap.org/8/199/118.png",
};

const HINT_KEY = "namma.mapOptionsSeen";

/** Whether this browser has opened the map options (or closed their hint); a convenience only, so any storage failure
 * shows the hint again. */
function readHintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function saveHintSeen(): void {
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    // Private mode or blocked storage: the hint comes back next visit.
  }
}

function Icon({ d, className = "", weight = 2 }: { d: string; className?: string; weight?: number }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d={d} />
    </svg>
  );
}
const ICON = {
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  layers: "m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5",
  close: "M6 6l12 12M18 6 6 18",
  check: "m5 12 5 5 9-10",
};

/**
 * The map's own buttons (DS map controls option B): one 44px column top-left, zoom in / out over a layers button, so
 * the rest of the map stays clear. Open, the map options (layer, history year, basemap) come up as a sheet from the
 * bottom on a phone, a card beside the column on larger screens. Until this browser has opened them once (or closed
 * the hint), a hint bubble beside the layers button says what's in there.
 */
function MapHud({
  map,
  zoom,
  open,
  setOpen,
  layer,
  onLayer,
  years,
  year,
  onYear,
  basemap,
  onBasemap,
}: {
  map: LeafletMap | null;
  zoom: number | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  layer: (typeof LAYERS)[number];
  onLayer: (l: (typeof LAYERS)[number]) => void;
  /** The history layer's years; empty on the live layers. */
  years: number[];
  year: number | null;
  onYear: (y: number | null) => void;
  basemap: Basemap;
  onBasemap: (b: Basemap) => void;
}) {
  const layersBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    layersBtn.current?.focus({ preventScroll: true });
  };
  const [hint, setHint] = useState(() => !readHintSeen());
  const hideHint = () => {
    setHint(false);
    saveHintSeen();
  };
  const openByTap = () => {
    hideHint();
    flushSync(() => setOpen(true));
    closeBtn.current?.focus({ preventScroll: true });
  };

  const h = copy.flood.history;
  const atMin = map != null && zoom != null && zoom <= map.getMinZoom();
  const atMax = map != null && zoom != null && zoom >= map.getMaxZoom();
  const zoomBtn = "flex aspect-square w-full items-center justify-center rounded-[8px] text-ink hover:bg-surface-sunken disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <>
      <div className="pointer-events-none absolute top-2.5 left-2.5 z-[500] flex flex-col items-start gap-2">
        <div className="pointer-events-auto flex w-11 flex-col gap-0.5 rounded-md border border-line-strong bg-surface-raised p-0.5 shadow-float">
          <button type="button" aria-label={copy.flood.zoomIn} disabled={!map || atMax} onClick={() => map?.zoomIn()} className={zoomBtn}>
            <Icon d={ICON.plus} />
          </button>
          <button type="button" aria-label={copy.flood.zoomOut} disabled={!map || atMin} onClick={() => map?.zoomOut()} className={zoomBtn}>
            <Icon d={ICON.minus} />
          </button>
        </div>
        <div className="relative">
          <button
            ref={layersBtn}
            type="button"
            aria-label={copy.flood.mapControls}
            aria-expanded={open}
            aria-controls="map-options"
            onClick={() => (open ? close() : openByTap())}
            className={`pointer-events-auto flex size-11 items-center justify-center rounded-md border shadow-float ${
              open ? "border-river bg-river text-on-river" : "border-line-strong bg-surface-raised text-river hover:bg-surface-sunken"
            }`}
          >
            <Icon d={ICON.layers} className="size-[22px]" />
          </button>
          {hint && !open && (
            <div className="pointer-events-auto absolute top-1/2 left-full ml-3 flex w-56 -translate-y-1/2 items-start gap-1 rounded-md bg-river py-1.5 pr-1 pl-3 text-on-river shadow-float">
              {/* The arrow: a turned square tucked under the bubble's left edge, pointing at the button. */}
              <span aria-hidden="true" className="absolute top-1/2 -left-1.5 size-3 -translate-y-1/2 rotate-45 bg-river" />
              <button type="button" onClick={openByTap} className="relative flex-1 text-left text-caption font-semibold">
                {copy.flood.mapControlsHint}
              </button>
              <button
                type="button"
                aria-label={copy.flood.close}
                onClick={hideHint}
                className="relative flex size-8 shrink-0 items-center justify-center rounded-sm hover:bg-[rgba(255,255,255,0.15)]"
              >
                <Icon d={ICON.close} className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {open && (
        <>
          <div aria-hidden="true" onClick={close} className="absolute inset-0 z-[600] bg-[rgba(4,12,24,0.3)] sm:hidden" />
          {/* Phone: a sheet along the map's bottom edge. Larger: a card beside the 44px column (10px + 44px + 8px in). */}
          <section
            id="map-options"
            role="dialog"
            aria-label={copy.flood.mapControls}
            onKeyDown={(e) => e.key === "Escape" && close()}
            className="absolute z-[600] flex flex-col gap-2 overflow-y-auto border-line-strong bg-surface-raised shadow-float max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[85%] max-sm:rounded-t-lg max-sm:border-t max-sm:px-4 max-sm:pt-1.5 max-sm:pb-4 sm:top-2.5 sm:left-[3.875rem] sm:max-h-[calc(100%-1.25rem)] sm:w-72 sm:max-w-[calc(100%-4.5rem)] sm:rounded-lg sm:border sm:p-3 sm:pt-2"
          >
            <span aria-hidden="true" className="mx-auto h-1 w-9 shrink-0 rounded-pill bg-line-strong sm:hidden" />
            <div className="-mr-1.5 flex items-center justify-between gap-2">
              <h2 className="m-0 flex items-center gap-2 text-label font-semibold text-ink">
                <Icon d={ICON.layers} className="text-river" />
                {copy.flood.mapControls}
              </h2>
              <button
                ref={closeBtn}
                type="button"
                aria-label={copy.flood.close}
                onClick={close}
                className="flex size-9 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                <Icon d={ICON.close} />
              </button>
            </div>

            <p className="m-0 text-caption font-semibold text-ink-muted">{copy.flood.periodLabel}</p>
            <Segmented
              flush
              label={copy.flood.periodLabel}
              options={LAYERS}
              value={layer}
              onChange={onLayer}
              name={(l) => (l === "history" ? h.tab : copy.flood.periodShort[l])}
            />
            {years.length > 0 && <YearChips scroll years={years} year={year} onYear={onYear} />}

            <p className="m-0 mt-1 text-caption font-semibold text-ink-muted">{copy.flood.basemap}</p>
            <div role="group" aria-label={copy.flood.basemap} className="grid grid-cols-2 gap-2">
              {(["satellite", "streets"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={b === basemap}
                  onClick={() => onBasemap(b)}
                  className={`relative flex flex-col gap-1 rounded-md border p-1 pb-1.5 text-caption font-semibold ${
                    b === basemap
                      ? "border-river text-river shadow-[inset_0_0_0_1px_var(--river)]"
                      : "border-line text-ink hover:border-line-strong"
                  }`}
                >
                  <img src={BASEMAP_THUMB[b]} alt="" loading="lazy" className="h-14 w-full rounded-[7px] bg-surface-sunken object-cover" />
                  {copy.flood[b]}
                  {b === basemap && (
                    <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-river text-on-river">
                      <Icon d={ICON.check} weight={3.5} className="size-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

/** One saved place: how close GISTDA's flooding is, and a way to ask NamMa about it (DS option G banner). */
function PlaceFlood({
  place,
  period,
  onAsk,
  onFocus,
}: {
  place: SavedPlace;
  period: FloodPeriod;
  onAsk: (text: string) => void;
  onFocus: (place: SavedPlace) => void;
}) {
  const near = useFloodNear(period, place);
  const d = near.data;
  let status: string | null = null;
  if (d?.fetched_at) {
    const rai = formatRai(d.nearby.area_rai);
    if (d.at_point) status = copy.flood.placeAtPoint(rai, d.radius_km);
    else if (d.nearest_km != null) status = copy.flood.placeNear(formatDistance(d.nearest_km) ?? "", rai, d.radius_km);
    else status = copy.flood.placeClear(d.radius_km);
  }
  return (
    <div className="flex min-h-12 w-full items-center rounded-md bg-home-soft text-ink">
      <button
        type="button"
        onClick={() => onFocus(place)}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-l-md py-2 pl-4 text-left hover:shadow-[inset_0_0_0_999px_rgba(0,0,0,0.06)]"
      >
        <span className="nm-house text-home" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-body">
          <b className="font-semibold">{place.label}</b>
          {place.where && <span className="text-ink-muted"> · {place.where}</span>}
          {status && (
            <span className="block sm:inline">
              <span className="max-sm:hidden"> — </span>
              {status}
              {place.approx && <span className="text-ink-muted"> ({copy.flood.placeApprox})</span>}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onAsk(copy.flood.askPlaceText(place.label))}
        className="flex min-h-12 shrink-0 items-center rounded-r-md px-4 font-semibold text-river hover:shadow-[inset_0_0_0_999px_rgba(0,0,0,0.06)]"
      >
        <span className="max-sm:sr-only">{copy.flood.ask} </span>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}

function Places({
  places,
  period,
  onAsk,
  onFocus,
}: {
  places: SavedPlace[];
  period: FloodPeriod;
  onAsk: (text: string) => void;
  onFocus: (place: SavedPlace) => void;
}) {
  if (!places.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {places.map((p) => (
        <PlaceFlood key={p.id} place={p} period={period} onAsk={onAsk} onFocus={onFocus} />
      ))}
    </div>
  );
}
/** Total for the current scope, with the layer's dates. Before the first download it says so, never "no flooding". */
function Summary({ data, period, onPeriod }: { data: FloodAreas; period: FloodPeriod; onPeriod: (p: FloodPeriod) => void }) {
  if (!data.fetched_at) {
    return (
      <section className="border-b border-line px-4 py-4">
        <h2 className="m-0 text-heading font-semibold">{copy.flood.noData}</h2>
        <p className="m-0 mt-1 text-body text-ink-muted">{copy.flood.noDataBody}</p>
        <Link to="/map" className="nm-btn nm-btn--secondary nm-btn--sm mt-3">
          {copy.nav.map}
        </Link>
      </section>
    );
  }
  return (
    <section className="border-b border-line px-4 py-4">
      <h2 className="m-0 text-caption font-semibold text-ink-muted">{copy.flood.total}</h2>
      {data.total.cells > 0 ? (
        <>
          <p className="num m-0 text-reading-lg font-semibold">{formatRai(data.total.area_rai)}</p>
          <p className="num m-0 text-body text-ink-muted">
            {formatKm2(data.total.area_km2)}
          </p>
        </>
      ) : (
        <>
          <p className="m-0 mt-1 text-body">{copy.flood.none(copy.flood.period[period])}</p>
          {period === "3days" && (
            <button type="button" className="nm-btn nm-btn--secondary nm-btn--sm mt-2" onClick={() => onPeriod("7days")}>
              {copy.flood.tryWeek}
            </button>
          )}
        </>
      )}
      <dl className="num m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-caption text-ink-muted">
        {data.observed_to && (
          <>
            <dt>{copy.flood.observed}</dt>
            <dd className="m-0 text-ink">{formatDateTime(data.observed_to)}</dd>
          </>
        )}
        <dt>{copy.flood.fetched}</dt>
        <dd className="m-0 text-ink">{formatDateTime(data.fetched_at)}</dd>
      </dl>
    </section>
  );
}

function Breadcrumb({ province, amphoe, onGo }: { province: string | null; amphoe: string | null; onGo: (p: string | null, a: string | null) => void }) {
  if (!province) return null;
  const crumbs: [string, () => void][] = [[copy.flood.allProvinces, () => onGo(null, null)]];
  crumbs.push([areaName({ province, amphoe: null, tambon: null, code: null }, "province"), () => onGo(province, null)]);
  if (amphoe) crumbs.push([areaName({ province, amphoe, tambon: null, code: null }, "amphoe"), () => onGo(province, amphoe)]);
  return (
    <nav aria-label="ระดับพื้นที่" className="flex flex-wrap items-center gap-x-1 px-4 pt-3 text-caption">
      {crumbs.map(([label, go], i) => (
        <span key={label} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden="true">›</span>}
          {i < crumbs.length - 1 ? (
            <button type="button" onClick={go} className="min-h-11 font-semibold text-river underline">
              {label}
            </button>
          ) : (
            <span className="font-semibold text-ink">{label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** "อาคาร 1,120 · คน 3,000", only the counts GISTDA sent. */
function rowStats(a: FloodArea): string | null {
  const parts = [
    a.buildings != null && `${copy.flood.rowStats.buildings} ${formatCount(a.buildings)}`,
    a.population != null && `${copy.flood.rowStats.population} ${formatCount(a.population)}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function AreaList({ data, busy, onPick }: { data: FloodAreas; busy: boolean; onPick: (a: FloodArea) => void }) {
  if (!data.areas.length) return null;
  const max = data.areas[0].area_km2 || 1;
  const drill = data.level !== "tambon";
  return (
    <section className={`px-4 py-3 ${busy ? "opacity-60" : ""}`} aria-busy={busy}>
      <h2 className="m-0 text-heading font-semibold">{copy.flood.byLevel[data.level]}</h2>
      <ul className="m-0 mt-1 list-none p-0">
        {data.areas.map((a) => {
          const stats = rowStats(a);
          return (
            <li key={`${a.province}|${a.amphoe}|${a.tambon}|${a.code}`} className="border-b border-line last:border-b-0">
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(a)}
                className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2 text-left hover:bg-surface-sunken"
              >
                <span className="min-w-0 truncate text-body font-semibold">
                  {areaName(a, data.level)}
                  {drill && <span className="sr-only"> ({copy.flood.byLevel[data.level === "province" ? "amphoe" : "tambon"]})</span>}
                </span>
                <span className="num text-body">
                  {formatRai(a.area_rai)}
                  {drill && (
                    <span className="ml-1 text-river" aria-hidden="true">
                      ›
                    </span>
                  )}
                </span>
                <span className="col-span-2 mt-1 h-1.5 rounded-pill bg-surface-sunken" aria-hidden="true">
                  <span
                    className="block h-full rounded-pill"
                    style={{ width: `${Math.max(2, (a.area_km2 / max) * 100)}%`, background: "var(--flood)" }}
                  />
                </span>
                {stats && <span className="num col-span-2 mt-1 text-caption text-ink-muted">{stats}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface PickedTambon {
  kind: "tambon";
  /** GISTDA's totals for it; null = no flooded cell in it. */
  row: FloodArea | null;
  /** Its outline once loaded (the card can show before it is, when picked from the list). */
  shape: AreaShape | null;
  /** Its flood history (history layer); null = none on record. */
  hist?: FloodHistoryArea | null;
}
/** Close up: a patch of water, or a dry spot (with how far the water in view is from it). */
type Picked =
  | PickedTambon
  | { kind: "water"; patch: WaterPatch }
  | { kind: "land"; shape: AreaShape; lat: number; lon: number; nearestKm: number | null };

function CardHead({ head, rest, onClose, children }: { head: string; rest: string[]; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 id="flood-area-h" className="m-0 text-heading font-semibold">
          {head}
        </h2>
        {rest.length > 0 && <p className="m-0 text-caption text-ink-muted">{rest.join(" · ")}</p>}
        {children}
      </div>
      <button type="button" onClick={onClose} aria-label={copy.flood.close} title={copy.flood.close} className="nm-icon-btn shrink-0">
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}

/** "ไม่ถึง 1 ไร่", "85 ไร่", "4,010 ไร่" → rounded to tens: a patch's edge is not that precise. */
function patchRai(rai: number): string {
  if (rai < 1) return copy.flood.lessThanRai;
  return formatRai(rai < 100 ? rai : Math.round(rai / 10) * 10);
}

/** How much of its cells is under water, on average: the patch's colour on the heatmap. */
function meanShare(patch: WaterPatch): number {
  return patch.cells.reduce((s, c) => s + c.share, 0) / patch.cells.length;
}

/** A patch of water picked close up (design "3 · ซูมใกล้"): how big, what's in it, how far from home. */
function WaterCard({
  patch,
  period,
  observed,
  places,
  onClose,
  onAsk,
}: {
  patch: WaterPatch;
  period: FloodPeriod;
  observed: string | null;
  places: SavedPlace[];
  onClose: () => void;
  onAsk: (text: string) => void;
}) {
  const where = { province: patch.province, amphoe: patch.amphoe, tambon: patch.tambon };
  const parts = placeParts(where);
  // 30-day map: water seen only weeks ago, which may have gone down.
  const earlier = patch.seen === "30days";
  const head = patch.tambon ? copy.flood.waterIn(parts[0]) : copy.flood.waterTitle;
  const stats = [
    patch.buildings != null && `${copy.flood.stats.buildings} ${formatCount(patch.buildings)}`,
    patch.population != null && `${copy.flood.stats.population} ~${formatCount(patch.population)}`,
  ].filter(Boolean);
  // The saved place nearest this water, and how far it is.
  const home = places
    .map((p) => ({ p, km: distanceToWaterKm(patch.cells, p.lat, p.lon) }))
    .filter((x): x is { p: SavedPlace; km: number } => x.km != null)
    .sort((a, b) => a.km - b.km)[0];
  return (
    <section aria-labelledby="flood-area-h" className="flex flex-col gap-3 px-4 py-4">
      <CardHead head={head} rest={patch.tambon ? parts.slice(1) : parts} onClose={onClose} />
      <div className="flex items-center gap-2">
        {earlier ? (
          <Swatch cls="earlier" />
        ) : (
          <span aria-hidden="true" className="block h-4 w-[22px] shrink-0 rounded-[5px]" style={{ background: heatColor(meanShare(patch)) }} />
        )}
        <p className="num m-0 text-reading-lg font-semibold">
          {(earlier ? copy.flood.waterRaiEarlier : copy.flood.waterRai)(patchRai(patch.area_rai))}
        </p>
      </div>
      {patch.seen && period !== "3days" && (
        <p className="m-0 flex items-center gap-2 text-body">
          <Swatch cls={seasonClass(patch.seen)} />
          {copy.flood.season.seenLong[patch.seen]}
        </p>
      )}
      {(stats.length > 0 || home) && (
        <p className="num m-0 text-body">
          {[
            ...stats,
            home && (home.km === 0 ? copy.flood.homeInWater(home.p.label) : copy.flood.homeAway(home.p.label, formatDistance(home.km) ?? "")),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {(patch.observed_at ?? observed) && (
        <p className="m-0 text-caption text-ink-muted">
          {copy.flood.imageDate} {formatDate((patch.observed_at ?? observed)!)}
        </p>
      )}
      <button type="button" className="nm-btn nm-btn--primary nm-btn--block" onClick={() => onAsk(copy.flood.askAreaText(placeName(where)))}>
        {copy.flood.askPoint}
      </button>
    </section>
  );
}

/** A dry spot tapped close up: no water seen here, and how far the nearest water in view is. */
function LandCard({
  shape,
  nearestKm,
  onClose,
  onAsk,
}: {
  shape: AreaShape;
  nearestKm: number | null;
  onClose: () => void;
  onAsk: (text: string) => void;
}) {
  const where = shape.properties;
  const [head, ...rest] = placeParts(where);
  return (
    <section aria-labelledby="flood-area-h" className="flex flex-col gap-3 px-4 py-4">
      <CardHead head={head} rest={rest} onClose={onClose} />
      <p className="m-0 text-reading-lg font-semibold">{copy.flood.landDry}</p>
      <p className="m-0 text-body">
        {nearestKm != null ? copy.flood.nearestWater(formatDistance(nearestKm) ?? "") : copy.flood.noWaterInView}
      </p>
      <p className="m-0 text-caption text-ink-muted">{copy.flood.landCaveat}</p>
      <button type="button" className="nm-btn nm-btn--primary nm-btn--block" onClick={() => onAsk(copy.flood.askAreaText(placeName(where)))}>
        {copy.flood.askPoint}
      </button>
    </section>
  );
}

/** The tambon picked on the map or in the list (DS option C card): how much of it is under water, in words. */
function AreaCard({
  picked,
  period,
  observed,
  places,
  onClose,
  onAsk,
}: {
  picked: PickedTambon;
  period: FloodPeriod;
  observed: string | null;
  places: SavedPlace[];
  onClose: () => void;
  onAsk: (text: string) => void;
}) {
  const { row, shape } = picked;
  const where = {
    province: shape?.properties.province ?? row?.province ?? null,
    amphoe: shape?.properties.amphoe ?? row?.amphoe ?? null,
    tambon: shape?.properties.tambon ?? row?.tambon ?? null,
  };
  const [head, ...rest] = [
    areaName({ ...where, code: row?.code ?? null }, "tambon"),
    ...(where.amphoe ? [areaName({ ...where, tambon: null, code: null }, "amphoe")] : []),
    ...(where.province ? [areaName({ ...where, amphoe: null, tambon: null, code: null }, "province")] : []),
  ];
  const share = row && shape ? Math.min(1, row.area_km2 / shape.properties.area_km2) : null;
  const cls: FloodClass = row ? (share != null ? floodClass(share) : "some") : "none";
  const home = shape ? places.find((p) => containsPoint(shape, p.lat, p.lon)) : undefined;
  const stats = row
    ? [
        row.buildings != null && `${copy.flood.stats.buildings} ${formatCount(row.buildings)}`,
        row.population != null && `${copy.flood.stats.population} ~${formatCount(row.population)}`,
      ].filter(Boolean)
    : [];
  return (
    <section aria-labelledby="flood-area-h" className="flex flex-col gap-3 px-4 py-4">
      <CardHead head={head} rest={rest} onClose={onClose}>
        {home && (
          <p className="m-0 mt-1 flex items-center gap-1.5 text-caption font-semibold text-ink">
            <span className="nm-house text-home" aria-hidden="true" />
            {copy.flood.homeHere(home.label)}
          </p>
        )}
      </CardHead>

      <div className="flex items-center gap-2">
        <p className="m-0 text-reading-lg font-semibold">
          {copy.flood.clsLong[cls]}
          {period === "30days" && cls !== "none" && <span className="text-body font-normal text-ink-muted"> {copy.flood.inMonth}</span>}
        </p>
      </div>
      <p className="num m-0 text-body">
        {row
          ? [formatRai(row.area_rai), share != null && shareWords(share, "ตำบล")].filter(Boolean).join(" · ")
          : copy.flood.noneInArea}
      </p>
      {stats.length > 0 && (
        <p className="num m-0 text-caption text-ink-muted">
          {copy.flood.inFlooded} {stats.join(" · ")}
        </p>
      )}
      {observed && (
        <p className="m-0 text-caption text-ink-muted">
          {copy.flood.imageDate} {formatDate(observed)}
        </p>
      )}

      <TambonStory code={shape?.properties.code ?? row?.code ?? null} />

      <button type="button" className="nm-btn nm-btn--primary nm-btn--block" onClick={() => onAsk(copy.flood.askAreaText(placeName(where)))}>
        {copy.flood.askArea}
      </button>
    </section>
  );
}
/** The history layer's side panel: the year picker, the total for that year (or the worst year), provinces ranked. */
function HistoryPanel({
  data,
  year,
  onYear,
  onPick,
}: {
  data: FloodHistory;
  year: number | null;
  onYear: (y: number | null) => void;
  onPick: (code: string) => void;
}) {
  const h = copy.flood.history;
  if (!data.years.length) {
    return (
      <section className="border-b border-line px-4 py-4">
        <h2 className="m-0 text-heading font-semibold">{h.noData}</h2>
        <p className="m-0 mt-1 text-body text-ink-muted">{h.noDataBody}</p>
      </section>
    );
  }
  const from = data.years[0];
  const to = data.years[data.years.length - 1];
  const byYear = new Map<number, number>();
  for (const a of data.areas) for (const [y, rai] of Object.entries(a.rai_by_year)) byYear.set(Number(y), (byYear.get(Number(y)) ?? 0) + rai);
  const widest = [...byYear.entries()].sort((a, b) => b[1] - a[1])[0];
  const rows = data.areas
    .map((a) => {
      const worst = worstYear(a);
      return { a, worst, rai: year != null ? (a.rai_by_year[String(year)] ?? 0) : (worst?.rai ?? 0) };
    })
    .filter((r) => r.rai > 0)
    .sort((x, y) => y.rai - x.rai);
  const max = rows[0]?.rai || 1;
  return (
    <>
      <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
        <h2 className="m-0 text-heading font-semibold">{h.title(from, to)}</h2>
        <YearChips years={data.years} year={year} onYear={onYear} />
        <div>
          <h3 className="m-0 text-caption font-semibold text-ink-muted">{year != null ? h.yearTotal(year) : h.worstTotal}</h3>
          {year != null ? (
            byYear.get(year) ? (
              <p className="num m-0 text-reading-lg font-semibold">{formatRai(byYear.get(year)!)}</p>
            ) : (
              <p className="m-0 mt-1 text-body">{h.noneYear(year)}</p>
            )
          ) : (
            widest && (
              <p className="num m-0 text-reading-lg font-semibold">
                {widest[0]} · {formatRai(widest[1])}
              </p>
            )
          )}
        </div>
        {data.provinces.length < TOTAL_PROVINCES && <p className="m-0 text-caption text-ink-muted">{h.copied(data.provinces.length)}</p>}
      </section>
      {rows.length > 0 && (
        <section className="px-4 py-3">
          <h2 className="m-0 text-heading font-semibold">{copy.flood.byLevel.province}</h2>
          <ul className="m-0 mt-1 list-none p-0">
            {rows.map(({ a, worst, rai }) => (
              <li key={a.code} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => onPick(a.code)}
                  className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2 text-left hover:bg-surface-sunken"
                >
                  <span className="min-w-0 truncate text-body font-semibold">{areaName({ ...a, code: a.code }, "province")}</span>
                  <span className="num text-body">
                    {formatRai(rai)}
                    <span className="ml-1 text-river" aria-hidden="true">
                      ›
                    </span>
                  </span>
                  <span className="col-span-2 mt-1 h-1.5 rounded-pill bg-surface-sunken" aria-hidden="true">
                    <span className="block h-full rounded-pill" style={{ width: `${Math.max(2, (rai / max) * 100)}%`, background: "var(--flood)" }} />
                  </span>
                  {year == null && worst && (
                    <span className="num col-span-2 mt-1 text-caption text-ink-muted">
                      {h.yearsFlooded(a.years.length, data.years.length)} · {h.worst(worst.year, formatRai(worst.rai))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** A tambon picked in the history layer: how many years it flooded, and how much each year. */
function HistoryCard({
  picked,
  years,
  year,
  copied,
  places,
  onClose,
  onAsk,
}: {
  picked: PickedTambon;
  years: number[];
  year: number | null;
  /** Its province is in the copy: no history then means it never flooded, not "unknown". */
  copied: boolean;
  places: SavedPlace[];
  onClose: () => void;
  onAsk: (text: string) => void;
}) {
  const h = copy.flood.history;
  const { shape } = picked;
  const hist = picked.hist ?? null;
  const where = {
    province: shape?.properties.province ?? hist?.province ?? null,
    amphoe: shape?.properties.amphoe ?? hist?.amphoe ?? null,
    tambon: shape?.properties.tambon ?? hist?.tambon ?? null,
  };
  const [head, ...rest] = [
    areaName({ ...where, code: hist?.code ?? null }, "tambon"),
    ...(where.amphoe ? [areaName({ ...where, tambon: null, code: null }, "amphoe")] : []),
    ...(where.province ? [areaName({ ...where, amphoe: null, tambon: null, code: null }, "province")] : []),
  ];
  const areaKm2 = shape?.properties.area_km2 ?? 0;
  const cls = historyClass(hist ?? undefined, areaKm2, year, "tambon");
  const home = shape ? places.find((p) => containsPoint(shape, p.lat, p.lon)) : undefined;
  const max = hist ? (worstYear(hist)?.rai ?? 1) : 1;
  const yearRai = year != null && hist ? (hist.rai_by_year[String(year)] ?? 0) : 0;
  return (
    <section aria-labelledby="flood-history-h" className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="flood-history-h" className="m-0 text-heading font-semibold">
            {head}
          </h2>
          {rest.length > 0 && <p className="m-0 text-caption text-ink-muted">{rest.join(" · ")}</p>}
          {home && (
            <p className="m-0 mt-1 flex items-center gap-1.5 text-caption font-semibold text-ink">
              <span className="nm-house text-home" aria-hidden="true" />
              {copy.flood.homeHere(home.label)}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label={copy.flood.close} title={copy.flood.close} className="nm-icon-btn shrink-0">
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Swatch cls={cls} />
        <p className={`m-0 font-semibold ${hist ? "text-reading-lg" : "text-body"}`}>
          {hist ? h.yearsFlooded(hist.years.length, years.length) : copied ? h.never : h.notCopied}
        </p>
      </div>
      {year != null && hist && (
        <p className="num m-0 text-body">
          {yearRai > 0
            ? [`${year}: ${formatRai(yearRai)}`, areaKm2 > 0 && shareWords(historyShare(hist, year, areaKm2), "ตำบล")].filter(Boolean).join(" · ")
            : h.noneYear(year)}
        </p>
      )}
      {hist && (
        <div>
          <h3 className="m-0 text-caption font-semibold text-ink-muted">{h.byYear}</h3>
          <ul className="m-0 mt-1 grid list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 p-0">
            {years.map((y) => {
              const rai = hist.rai_by_year[String(y)] ?? 0;
              return (
                <li key={y} className={`contents text-caption ${y === year ? "font-semibold text-ink" : "text-ink-muted"}`}>
                  <span className="num">{y}</span>
                  <span className="h-2 rounded-pill bg-surface-sunken" aria-hidden="true">
                    {rai > 0 && <span className="block h-full rounded-pill" style={{ width: `${Math.max(3, (rai / max) * 100)}%`, background: "var(--flood)" }} />}
                  </span>
                  <span className="num text-right">{rai > 0 ? formatRai(rai) : "–"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button type="button" className="nm-btn nm-btn--primary nm-btn--block" onClick={() => onAsk(h.askText(placeName(where)))}>
        {copy.flood.askArea}
      </button>
    </section>
  );
}

function Notes({ legend, stage, history, season }: { legend: LegendText; stage: Stage; history: boolean; season: boolean }) {
  const h = copy.flood.history;
  return (
    <div className="grid gap-2 border-t border-line px-4 pt-3 pb-4 text-caption text-ink-muted">
      <div className="sm:hidden">
        <Legend text={legend} stage={stage} />
      </div>
      <p className="m-0">{history ? h.subtitle : season ? copy.flood.season.subtitle : copy.flood.subtitle}</p>
      <p className="m-0">{history ? h.tapHint : season ? copy.flood.season.tapHint : copy.flood.tapHint}</p>
      <p className="m-0">{history ? h.caveat : copy.flood.caveat}</p>
      <p className="m-0">
        {copy.footer.unofficial} · {copy.footer.emergency}{" "}
        <a href={DDPM.telHref} className="font-semibold text-tier-danger-ink underline">
          {DDPM.hotline}
        </a>
      </p>
      <p className="m-0">{history ? h.source : copy.flood.source}</p>
    </div>
  );
}

/**
 * GISTDA's satellite flooding, area by area (DS option C on option A's satellite map): saved places on top, the map
 * shading provinces (zoomed out) or tambons (zoomed in) by how much of each is under water, and beside it either the
 * tambon picked or the province → amphoe → tambon ranking. The /flood page fills the screen with it; the home page
 * embeds it as its first tab (`embedded`: fixed heights, the page scrolls instead of the panel).
 */
export function FloodExplorer({
  scope,
  onScope,
  embedded = false,
  focus = null,
}: {
  scope: FloodScope;
  onScope: (changes: Partial<FloodScope>) => void;
  embedded?: boolean;
  /** Opened from a chat answer: fly to this point and pin it. */
  focus?: FloodFocus | null;
}) {
  const { period, province, amphoe } = scope;
  const history = scope.history ?? false;
  const year = scope.year ?? null;
  // The 30-day map shades each area by how lately water was seen there: it needs the shorter layers too.
  const season = !history && period === "30days";
  const navigate = useNavigate();
  const hist = useFloodHistory(history);
  const areas = useFloodAreas(period, province, amphoe);
  const provinceRows = useFloodAreas(period);
  const provinceRows3 = useFloodAreas("3days", null, null, season);
  const provinceRows7 = useFloodAreas("7days", null, null, season);
  const provinceShapes = useProvinceShapes();
  const profile = useProfile(loadSessionId());
  const places = useMemo(() => profile.data?.places.slice(0, MAX_PLACES) ?? [], [profile.data]);
  // The chat answer's place is pinned too, unless it is one of the saved places already shown.
  const focusLat = focus?.lat;
  const focusLon = focus?.lon;
  const focusLabel = focus?.label;
  const mapPlaces = useMemo(() => {
    const pins = places.map((p) => ({ lat: p.lat, lon: p.lon, label: p.label }));
    const near = (p: { lat: number; lon: number }) => Math.abs(p.lat - focusLat!) < 1e-4 && Math.abs(p.lon - focusLon!) < 1e-4;
    if (focusLat != null && focusLon != null && !pins.some(near))
      pins.push({ lat: focusLat, lon: focusLon, label: focusLabel ?? "" });
    return pins;
  }, [places, focusLat, focusLon, focusLabel]);

  const [view, setView] = useState<MapView | null>(null);
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [leaflet, setLeaflet] = useState<LeafletMap | null>(null);
  const detail = useRef<HTMLDivElement>(null);
  const mapEl = useRef<HTMLDivElement>(null);

  // The history layer has no cells to show close up: it stays on tambons.
  const stage: Stage =
    view == null || view.zoom < TAMBON_ZOOM ? "province" : view.zoom < WATER_ZOOM || history ? "tambon" : "water";
  // Zoomed in: the tambons of the provinces in view, with GISTDA's totals for each.
  const zoomedIn = stage !== "province";
  const inView = useMemo(
    () => (view && zoomedIn && provinceShapes.data ? provincesInView(provinceShapes.data.features, view.bbox, MAX_PROVINCES) : []),
    [zoomedIn, provinceShapes.data, view],
  );
  const tambonShapes = useTambonShapes(inView.map((p) => p.properties.code));
  const tambonRows = useFloodTambons(period, inView.map((p) => p.properties.province));
  const tambonRows3 = useFloodTambons("3days", inView.map((p) => p.properties.province), season);
  const tambonRows7 = useFloodTambons("7days", inView.map((p) => p.properties.province), season);
  const tambonHist = useFloodHistoryTambons(
    inView.map((p) => p.properties.code),
    history,
  );
  // Close up: GISTDA's own cells in view, merged into patches of water.
  const cells = useFloodCells(period, stage === "water" && view ? viewBox(view.bbox) : null);
  const patches = useMemo(() => (stage === "water" && cells.data ? waterPatches(cells.data.cells) : []), [stage, cells.data]);

  // useQueries hands back new arrays every render: rebuild only when some result's data changed.
  const shapesKey = tambonShapes.map((q) => q.dataUpdatedAt).join();
  const rowsKey = [tambonRows, tambonRows3, tambonRows7].map((qs) => qs.map((q) => q.dataUpdatedAt).join()).join("|");
  const histKey = tambonHist.map((q) => q.dataUpdatedAt).join();
  const tambons = useMemo(() => {
    const out: { shape: AreaShape; row: FloodArea | null; hist: FloodHistoryArea | null; seen: FloodPeriod | null }[] = [];
    tambonShapes.forEach((q, i) => {
      if (!q.data) return;
      const joined = joinAreas(q.data.features, tambonRows[i]?.data?.areas ?? [], "tambon");
      const joined3 = joinAreas(q.data.features, tambonRows3[i]?.data?.areas ?? [], "tambon");
      const joined7 = joinAreas(q.data.features, tambonRows7[i]?.data?.areas ?? [], "tambon");
      const hist = new Map((tambonHist[i]?.data?.areas ?? []).map((a) => [a.code, a]));
      for (const shape of q.data.features) {
        const code = shape.properties.code;
        const row = joined.get(code) ?? null;
        const seen = lastSeen((p) => (p === "3days" ? joined3.has(code) : p === "7days" ? joined7.has(code) : row != null));
        out.push({ shape, row, hist: hist.get(code) ?? null, seen });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapesKey, rowsKey, histKey]);

  const mapAreas: MapArea[] = useMemo(() => {
    if (history) {
      if (zoomedIn) {
        return tambons.map(({ shape, hist: h }) => ({
          shape,
          cls: historyClass(h ?? undefined, shape.properties.area_km2, year, "tambon"),
          label: shape.properties.tambon,
        }));
      }
      const byCode = new Map((hist.data?.areas ?? []).map((a) => [a.code, a]));
      return (provinceShapes.data?.features ?? []).map((shape) => {
        const h = byCode.get(shape.properties.code);
        return { shape, cls: historyClass(h, shape.properties.area_km2, year, "province"), label: h ? shape.properties.province : null };
      });
    }
    if (zoomedIn) {
      return tambons.map(({ shape, row, seen }) => ({
        shape,
        cls: season ? seasonClass(seen) : row ? floodClass(row.area_km2 / shape.properties.area_km2) : "none",
        label: shape.properties.tambon,
      }));
    }
    const shapes = provinceShapes.data?.features ?? [];
    const joined = joinAreas(shapes, provinceRows.data?.areas ?? [], "province");
    const joined3 = joinAreas(shapes, provinceRows3.data?.areas ?? [], "province");
    const joined7 = joinAreas(shapes, provinceRows7.data?.areas ?? [], "province");
    return shapes.map((shape) => {
      const code = shape.properties.code;
      const row = joined.get(code);
      const seen = lastSeen((p) => (p === "3days" ? joined3.has(code) : p === "7days" ? joined7.has(code) : row != null));
      return {
        shape,
        cls: season ? seasonClass(seen) : row ? floodClass(row.area_km2 / shape.properties.area_km2) : "none",
        label: row ? shape.properties.province : null,
      };
    });
  }, [history, season, year, hist.data, zoomedIn, tambons, provinceShapes.data, provinceRows.data, provinceRows3.data, provinceRows7.data]);

  const onView = useCallback((v: MapView) => setView(v), []);
  // From a chat answer: a GPS point close enough to see the water cells, a district centre (approx) at amphoe level.
  const focusApprox = focus?.approx ?? false;
  useEffect(() => {
    if (focusLat == null || focusLon == null) return;
    setFlyTo({ lat: focusLat, lon: focusLon, zoom: focusApprox ? FLY_ZOOM.amphoe : WATER_ZOOM });
  }, [focusLat, focusLon, focusApprox]);
  const onTilesFailed = useCallback(() => setTilesFailed(true), []);
  // Another period is another layer: the picked tambon's numbers change.
  useEffect(() => {
    setPicked(null);
  }, [period, history]);
  // A tambon picked from the list before its outline loaded: attach the outline once it has.
  useEffect(() => {
    if (picked?.kind !== "tambon" || !picked.row || picked.shape) return;
    const r = picked.row;
    const key = nameKey(r.province, r.amphoe, r.tambon);
    const hit = tambons.find(
      (t) =>
        (r.code != null && t.shape.properties.code === r.code) ||
        nameKey(t.shape.properties.province, t.shape.properties.amphoe, t.shape.properties.tambon) === key,
    );
    if (hit) setPicked({ kind: "tambon", row: r, shape: hit.shape });
  }, [tambons, picked]);
  // On a phone the panel is under the map: bring the picked tambon into view.
  useEffect(() => {
    if (picked) detail.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [picked]);

  const ask = (text: string) => navigate("/chat", { state: { send: text } satisfies ChatHandoff });
  const focusPlace = (p: SavedPlace) => {
    setFlyTo({ lat: p.lat, lon: p.lon, zoom: FLY_ZOOM.tambon });
    mapEl.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const goTo = (p: string | null, a: string | null) => onScope({ province: p, amphoe: a });

  /** A tap on the map: a province zooms in to its tambons, a tambon opens its card; close up, a dry spot says how far
   * the water is. */
  const pickOnMap = (code: string, lat: number, lon: number) => {
    if (zoomedIn) {
      const t = tambons.find((x) => x.shape.properties.code === code);
      if (!t) return;
      if (stage === "water") {
        setPicked({ kind: "land", shape: t.shape, lat, lon, nearestKm: distanceToWaterKm(cells.data?.cells ?? [], lat, lon) });
      } else setPicked({ kind: "tambon", row: t.row, shape: t.shape, hist: t.hist });
      return;
    }
    const shape = provinceShapes.data?.features.find((f) => f.properties.code === code);
    if (!shape) return;
    if (shape.properties.bbox) setFlyTo({ bounds: shape.properties.bbox });
    goTo(shape.properties.province, null);
  };

  /** A row in the ranking: provinces and amphoes drill down, a tambon opens its card. */
  const pickRow = (a: FloodArea) => {
    const level = areas.data!.level;
    const name = (n: string | null) => n ?? a.code;
    if (level === "province") {
      const shape = provinceShapes.data?.features.find(
        (f) => (a.code != null && f.properties.code === a.code) || nameKey(f.properties.province) === nameKey(a.province),
      );
      if (shape?.properties.bbox) setFlyTo({ bounds: shape.properties.bbox });
      else if (a.lat != null && a.lon != null) setFlyTo({ lat: a.lat, lon: a.lon, zoom: FLY_ZOOM.province });
      goTo(name(a.province), null);
      return;
    }
    if (a.lat != null && a.lon != null) setFlyTo({ lat: a.lat, lon: a.lon, zoom: FLY_ZOOM[level] });
    if (level === "amphoe") goTo(province, name(a.amphoe));
    else setPicked({ kind: "tambon", row: a, shape: null });
  };
  const pickWater = (id: string) => {
    const patch = patches.find((p) => p.id === id);
    if (patch) setPicked({ kind: "water", patch });
  };

  const pickHistoryProvince = (code: string) => {
    const shape = provinceShapes.data?.features.find((f) => f.properties.code === code);
    if (shape?.properties.bbox) setFlyTo({ bounds: shape.properties.bbox });
  };
  const legend = legendText(history, year, zoomedIn, season);
  const histCopied = new Set(hist.data?.provinces ?? []);

  const loadingShapes = provinceShapes.isPending || tambonShapes.some((q) => q.isPending);
  const failedShapes =
    provinceShapes.isError ||
    tambonShapes.some((q) => q.isError) ||
    (history ? tambonHist.some((q) => q.isError) : tambonRows.some((q) => q.isError));
  const status = tilesFailed
    ? copy.flood.tilesFailed
    : failedShapes
      ? copy.flood.areasFailed
      : stage === "water" && cells.isError
        ? copy.flood.waterFailed
        : loadingShapes
          ? copy.flood.loadingAreas
          : stage === "water" && cells.isFetching && !cells.data
            ? copy.flood.loadingWater
            : stage === "water" && cells.data?.truncated
              ? copy.flood.waterTruncated
              : stage === "province"
                ? copy.flood.zoomForTambons
                : stage === "tambon" && !history
                  ? copy.flood.zoomForWater
                  : null;
  const selectedArea =
    picked?.kind === "tambon" ? (picked.shape?.properties.code ?? null) : picked?.kind === "land" ? picked.shape.properties.code : null;

  const map = (
    <div
      ref={mapEl}
      className={
        embedded
          ? "relative h-[440px] overflow-hidden rounded-md border border-line lg:h-auto lg:min-w-0 lg:flex-1"
          : "relative h-[50%] shrink-0 lg:h-full lg:min-w-0 lg:flex-1"
      }
    >
      <Suspense fallback={<Loading className="h-full" />}>
        <FloodMap
          areas={mapAreas}
          selected={selectedArea}
          onPick={pickOnMap}
          closeUp={stage === "water"}
          water={patches}
          selectedWater={picked?.kind === "water" ? picked.patch.id : null}
          onPickWater={pickWater}
          basemap={basemap}
          flyTo={flyTo}
          places={mapPlaces}
          onView={onView}
          onTilesFailed={onTilesFailed}
          onMap={setLeaflet}
          scrollWheelZoom={!embedded}
        />
      </Suspense>

      <MapHud
        map={leaflet}
        zoom={view?.zoom ?? null}
        open={controlsOpen}
        setOpen={setControlsOpen}
        layer={history ? "history" : period}
        onLayer={(l) => (l === "history" ? onScope({ history: true }) : onScope({ period: l, history: false }))}
        years={history ? (hist.data?.years ?? []) : []}
        year={year}
        onYear={(y) => onScope({ year: y })}
        basemap={basemap}
        onBasemap={setBasemap}
      />
      <div className="absolute bottom-6 left-2 z-[500] hidden sm:block">
        <Legend text={legend} stage={stage} />
      </div>
      {status && (
        <p
          role="status"
          className="pointer-events-auto absolute right-2 bottom-6 z-[500] m-0 max-w-[15rem] rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-caption text-ink shadow-float"
        >
          {status}
        </p>
      )}
    </div>
  );

  const panel = (
    <aside
      className={
        embedded
          ? "relative rounded-md border border-line bg-surface lg:max-h-[640px] lg:w-[380px] lg:shrink-0 lg:overflow-y-auto"
          : "relative min-h-0 flex-1 overflow-y-auto border-t border-line bg-surface lg:w-[420px] lg:flex-none lg:border-t-0 lg:border-l"
      }
    >
      {!embedded && (
        <header className="border-b border-line px-4 py-3">
          <h1 className="m-0 text-title font-semibold">{copy.flood.title}</h1>
        </header>
      )}
      {API_MODE === "mock" && (
        <div className="px-4 pt-3">
          <p className="nm-stale m-0">{history ? copy.flood.history.sample : copy.flood.sample}</p>
        </div>
      )}

      <div ref={detail} className="scroll-mt-4">
        {history ? (
          picked?.kind === "tambon" ? (
            <HistoryCard
              picked={picked}
              years={hist.data?.years ?? []}
              year={year}
              copied={histCopied.has(picked.shape?.properties.code.slice(0, 2) ?? "")}
              places={places}
              onClose={() => setPicked(null)}
              onAsk={ask}
            />
          ) : hist.isPending ? (
            <Loading />
          ) : hist.isError ? (
            <ErrorState error={hist.error} onRetry={() => hist.refetch()} />
          ) : (
            <HistoryPanel data={hist.data} year={year} onYear={(y) => onScope({ year: y })} onPick={pickHistoryProvince} />
          )
        ) : picked?.kind === "water" ? (
          <WaterCard
            patch={picked.patch}
            period={period}
            observed={areas.data?.observed_to ?? null}
            places={places}
            onClose={() => setPicked(null)}
            onAsk={ask}
          />
        ) : picked?.kind === "land" ? (
          <LandCard shape={picked.shape} nearestKm={picked.nearestKm} onClose={() => setPicked(null)} onAsk={ask} />
        ) : picked ? (
          <AreaCard
            picked={picked}
            period={period}
            observed={areas.data?.observed_to ?? null}
            places={places}
            onClose={() => setPicked(null)}
            onAsk={ask}
          />
        ) : areas.isPending ? (
          <Loading />
        ) : areas.isError ? (
          <ErrorState error={areas.error} onRetry={() => areas.refetch()} />
        ) : (
          <>
            <Breadcrumb province={province} amphoe={amphoe} onGo={goTo} />
            <Summary data={areas.data} period={period} onPeriod={(p) => onScope({ period: p })} />
            <AreaList data={areas.data} busy={areas.isPlaceholderData} onPick={pickRow} />
            {areas.data.total.cells > 0 && <p className="m-0 px-4 pb-3 text-caption text-ink-muted">{copy.flood.selectHint}</p>}
          </>
        )}
      </div>

      <Notes legend={legend} stage={stage} history={history} season={season} />
    </aside>
  );

  return (
    <div className={embedded ? "flex flex-col gap-3" : "flex h-full flex-col"}>
      <FloodPatterns />
      <div className={embedded ? "" : "shrink-0 border-b border-line px-4 py-2 empty:hidden"}>
        <Places places={places} period={period} onAsk={ask} onFocus={focusPlace} />
      </div>
      <div className={embedded ? "flex flex-col gap-3 lg:h-[640px] lg:flex-row" : "flex min-h-0 flex-1 flex-col lg:flex-row"}>
        {map}
        {panel}
      </div>
    </div>
  );
}
