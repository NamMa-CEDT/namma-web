import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { API_MODE } from "../../api/client";
import { useFloodAreas, useFloodNear, useFloodTambons, useProfile, useProvinceShapes, useTambonShapes } from "../../api/queries";
import type { FloodArea, FloodAreas, FloodLevel, FloodPeriod, SavedPlace } from "../../api/types";
import { ErrorState, Loading } from "../../components/States";
import { copy, DDPM } from "../../copy";
import { containsPoint, joinAreas, nameKey, provincesInView, type AreaShape } from "../../lib/boundaries";
import { loadSessionId, type ChatHandoff } from "../../lib/chatSession";
import { areaName, floodClass, formatCount, formatKm2, formatRai, placeName, shareWords, type FloodClass } from "../../lib/flood";
import { formatDate, formatDateTime, formatDistance } from "../../lib/format";
import type { Basemap, FlyTarget, MapArea, MapView } from "./FloodMap";
import { FloodPatterns, Swatch } from "./patterns";

const FloodMap = lazy(() => import("./FloodMap"));

const PERIODS: FloodPeriod[] = ["3days", "7days"];
// How close to fly when a row is tapped: an amphoe at 11, a tambon at 12.
const FLY_ZOOM: Record<FloodLevel, number> = { province: 9, amphoe: 11, tambon: 12 };
const MAX_PLACES = 3;
// From this zoom the map shades tambons (of the provinces in view, nearest first) instead of provinces.
const TAMBON_ZOOM = 9;
const MAX_PROVINCES = 6;
const CLASSES: FloodClass[] = ["many", "some", "none"];
export interface FloodScope {
  period: FloodPeriod;
  province: string | null;
  amphoe: string | null;
}

function Legend() {
  return (
    <div className="rounded-sm border border-line bg-surface-raised px-3 py-2 shadow-float">
      <div className="text-caption font-semibold text-ink">{copy.flood.legend}</div>
      <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0 text-caption text-ink">
        {CLASSES.map((c) => (
          <li key={c} className="flex items-center gap-2">
            <Swatch cls={c} />
            {copy.flood.cls[c]}
          </li>
        ))}
      </ul>
      <p className="m-0 mt-1 max-w-[14rem] text-caption text-ink-muted">{copy.flood.legendNote}</p>
    </div>
  );
}
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  name,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  name: (v: T) => string;
}) {
  return (
    <div role="group" aria-label={label} className="pointer-events-auto inline-flex rounded-md border border-line-strong bg-surface-raised p-0.5 shadow-float">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`min-h-10 rounded-[8px] px-3 text-label font-semibold ${
            o === value ? "bg-river text-on-river" : "text-ink-muted hover:text-ink"
          }`}
        >
          {name(o)}
        </button>
      ))}
    </div>
  );
}

/** One saved place: how close GISTDA's flooding is, and a way to ask NamMa about it (DS option G banner). */
function PlaceFlood({ place, period, onAsk }: { place: SavedPlace; period: FloodPeriod; onAsk: (text: string) => void }) {
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
    <button
      type="button"
      onClick={() => onAsk(copy.flood.askPlaceText(place.label))}
      className="flex min-h-12 w-full items-center gap-3 rounded-md bg-home-soft px-4 py-2 text-left text-ink hover:shadow-[inset_0_0_0_999px_rgba(0,0,0,0.06)]"
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
      <span className="shrink-0 font-semibold text-river">
        <span className="max-sm:sr-only">{copy.flood.ask} </span>
        <span aria-hidden="true">›</span>
      </span>
    </button>
  );
}

function Places({ places, period, onAsk }: { places: SavedPlace[]; period: FloodPeriod; onAsk: (text: string) => void }) {
  if (!places.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {places.map((p) => (
        <PlaceFlood key={p.id} place={p} period={period} onAsk={onAsk} />
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

interface Picked {
  /** GISTDA's totals for it; null = no flooded cell in it. */
  row: FloodArea | null;
  /** Its outline once loaded (the card can show before it is, when picked from the list). */
  shape: AreaShape | null;
}

/** The tambon picked on the map or in the list (DS option C card): how much of it is under water, in words. */
function AreaCard({
  picked,
  observed,
  places,
  onClose,
  onAsk,
}: {
  picked: Picked;
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
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="flood-area-h" className="m-0 text-heading font-semibold">
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
        <p className="m-0 text-reading-lg font-semibold">{copy.flood.clsLong[cls]}</p>
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

      <button type="button" className="nm-btn nm-btn--primary nm-btn--block" onClick={() => onAsk(copy.flood.askAreaText(placeName(where)))}>
        {copy.flood.askArea}
      </button>
    </section>
  );
}
function Notes() {
  return (
    <div className="grid gap-2 border-t border-line px-4 pt-3 pb-4 text-caption text-ink-muted">
      <div className="sm:hidden">
        <Legend />
      </div>
      <p className="m-0">{copy.flood.subtitle}</p>
      <p className="m-0">{copy.flood.tapHint}</p>
      <p className="m-0">{copy.flood.caveat}</p>
      <p className="m-0">
        {copy.footer.unofficial} · {copy.footer.emergency}{" "}
        <a href={DDPM.telHref} className="font-semibold text-tier-danger-ink underline">
          {DDPM.hotline}
        </a>
      </p>
      <p className="m-0">{copy.flood.source}</p>
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
}: {
  scope: FloodScope;
  onScope: (changes: Partial<FloodScope>) => void;
  embedded?: boolean;
}) {
  const { period, province, amphoe } = scope;
  const navigate = useNavigate();
  const areas = useFloodAreas(period, province, amphoe);
  const provinceRows = useFloodAreas(period);
  const provinceShapes = useProvinceShapes();
  const profile = useProfile(loadSessionId());
  const places = useMemo(() => profile.data?.places.slice(0, MAX_PLACES) ?? [], [profile.data]);
  const mapPlaces = useMemo(() => places.map((p) => ({ lat: p.lat, lon: p.lon, label: p.label })), [places]);

  const [view, setView] = useState<MapView | null>(null);
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const detail = useRef<HTMLDivElement>(null);

  // Zoomed in: the tambons of the provinces in view, with GISTDA's totals for each.
  const zoomedIn = view != null && view.zoom >= TAMBON_ZOOM;
  const inView = useMemo(
    () => (view && zoomedIn && provinceShapes.data ? provincesInView(provinceShapes.data.features, view.bbox, MAX_PROVINCES) : []),
    [zoomedIn, provinceShapes.data, view],
  );
  const tambonShapes = useTambonShapes(inView.map((p) => p.properties.code));
  const tambonRows = useFloodTambons(period, inView.map((p) => p.properties.province));

  // useQueries hands back new arrays every render: rebuild only when some result's data changed.
  const shapesKey = tambonShapes.map((q) => q.dataUpdatedAt).join();
  const rowsKey = tambonRows.map((q) => q.dataUpdatedAt).join();
  const tambons = useMemo(() => {
    const out: { shape: AreaShape; row: FloodArea | null }[] = [];
    tambonShapes.forEach((q, i) => {
      if (!q.data) return;
      const joined = joinAreas(q.data.features, tambonRows[i]?.data?.areas ?? [], "tambon");
      for (const shape of q.data.features) out.push({ shape, row: joined.get(shape.properties.code) ?? null });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapesKey, rowsKey]);

  const mapAreas: MapArea[] = useMemo(() => {
    if (zoomedIn) {
      return tambons.map(({ shape, row }) => ({
        shape,
        cls: row ? floodClass(row.area_km2 / shape.properties.area_km2) : "none",
        label: shape.properties.tambon,
      }));
    }
    const shapes = provinceShapes.data?.features ?? [];
    const joined = joinAreas(shapes, provinceRows.data?.areas ?? [], "province");
    return shapes.map((shape) => {
      const row = joined.get(shape.properties.code);
      return {
        shape,
        cls: row ? floodClass(row.area_km2 / shape.properties.area_km2) : "none",
        label: row ? shape.properties.province : null,
      };
    });
  }, [zoomedIn, tambons, provinceShapes.data, provinceRows.data]);

  const onView = useCallback((v: MapView) => setView(v), []);
  const onTilesFailed = useCallback(() => setTilesFailed(true), []);
  // Another period is another layer: the picked tambon's numbers change.
  useEffect(() => {
    setPicked(null);
  }, [period]);
  // A tambon picked from the list before its outline loaded: attach the outline once it has.
  useEffect(() => {
    if (!picked?.row || picked.shape) return;
    const r = picked.row;
    const key = nameKey(r.province, r.amphoe, r.tambon);
    const hit = tambons.find(
      (t) =>
        (r.code != null && t.shape.properties.code === r.code) ||
        nameKey(t.shape.properties.province, t.shape.properties.amphoe, t.shape.properties.tambon) === key,
    );
    if (hit) setPicked({ row: r, shape: hit.shape });
  }, [tambons, picked]);
  // On a phone the panel is under the map: bring the picked tambon into view.
  useEffect(() => {
    if (picked) detail.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [picked]);

  const ask = (text: string) => navigate("/chat", { state: { send: text } satisfies ChatHandoff });
  const goTo = (p: string | null, a: string | null) => onScope({ province: p, amphoe: a });

  /** A tap on the map: a province zooms in to its tambons, a tambon opens its card. */
  const pickOnMap = (code: string) => {
    if (zoomedIn) {
      const t = tambons.find((x) => x.shape.properties.code === code);
      if (t) setPicked({ row: t.row, shape: t.shape });
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
    else setPicked({ row: a, shape: null });
  };

  const loadingShapes = provinceShapes.isPending || tambonShapes.some((q) => q.isPending);
  const failedShapes = provinceShapes.isError || tambonShapes.some((q) => q.isError) || tambonRows.some((q) => q.isError);
  const status = tilesFailed
    ? copy.flood.tilesFailed
    : failedShapes
      ? copy.flood.areasFailed
      : loadingShapes
        ? copy.flood.loadingAreas
        : !zoomedIn
          ? copy.flood.zoomForTambons
          : null;

  const map = (
    <div
      className={
        embedded
          ? "relative h-[440px] overflow-hidden rounded-md border border-line lg:h-auto lg:min-w-0 lg:flex-1"
          : "relative h-[50%] shrink-0 lg:h-full lg:min-w-0 lg:flex-1"
      }
    >
      <Suspense fallback={<Loading className="h-full" />}>
        <FloodMap
          areas={mapAreas}
          selected={picked?.shape?.properties.code ?? null}
          onPick={pickOnMap}
          basemap={basemap}
          flyTo={flyTo}
          places={mapPlaces}
          onView={onView}
          onTilesFailed={onTilesFailed}
          scrollWheelZoom={!embedded}
        />
      </Suspense>

      {/* Leaflet's zoom buttons sit top-left; the period goes next to them, the basemap top-right. */}
      <div className="pointer-events-none absolute top-2.5 right-2 left-[3.5rem] z-[500] flex flex-wrap items-start justify-between gap-2">
        <Segmented
          label={copy.flood.periodLabel}
          options={PERIODS}
          value={period}
          onChange={(p) => onScope({ period: p })}
          name={(p) => copy.flood.period[p]}
        />
        <div className="flex flex-col items-end gap-2">
          <Segmented
            label={copy.flood.basemap}
            options={["satellite", "streets"] as const}
            value={basemap}
            onChange={setBasemap}
            name={(b) => copy.flood[b]}
          />
          {status && (
            <p role="status" className="pointer-events-auto m-0 max-w-[15rem] rounded-sm border border-line bg-surface-raised px-3 py-2 text-caption text-ink shadow-float">
              {status}
            </p>
          )}
        </div>
      </div>
      <div className="absolute bottom-6 left-2 z-[500] hidden sm:block">
        <Legend />
      </div>
    </div>
  );

  const panel = (
    <aside
      className={
        embedded
          ? "rounded-md border border-line bg-surface lg:max-h-[640px] lg:w-[380px] lg:shrink-0 lg:overflow-y-auto"
          : "min-h-0 flex-1 overflow-y-auto border-t border-line bg-surface lg:w-[420px] lg:flex-none lg:border-t-0 lg:border-l"
      }
    >
      {!embedded && (
        <header className="border-b border-line px-4 py-3">
          <h1 className="m-0 text-title font-semibold">{copy.flood.title}</h1>
        </header>
      )}
      {API_MODE === "mock" && (
        <div className="px-4 pt-3">
          <p className="nm-stale m-0">{copy.flood.sample}</p>
        </div>
      )}

      <div ref={detail} className="scroll-mt-4">
        {picked ? (
          <AreaCard picked={picked} observed={areas.data?.observed_to ?? null} places={places} onClose={() => setPicked(null)} onAsk={ask} />
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

      <Notes />
    </aside>
  );

  return (
    <div className={embedded ? "flex flex-col gap-3" : "flex h-full flex-col"}>
      <FloodPatterns />
      <div className={embedded ? "" : "shrink-0 border-b border-line px-4 py-2 empty:hidden"}>
        <Places places={places} period={period} onAsk={ask} />
      </div>
      <div className={embedded ? "flex flex-col gap-3 lg:h-[640px] lg:flex-row" : "flex min-h-0 flex-1 flex-col lg:flex-row"}>
        {map}
        {panel}
      </div>
    </div>
  );
}
