import { lazy, Suspense, useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { useNearest, useStations } from "../../api/queries";
import type { LatLon, StationSummary } from "../../api/types";
import { LocateIcon } from "../../components/icons";
import { ErrorState, Loading } from "../../components/States";
import { TierBadge, TierShape } from "../../components/TierBadge";
import { agencyName, copy } from "../../copy";
import { formatBankGap, formatDistance } from "../../lib/format";
import { getCurrentPosition } from "../../lib/geolocation";
import { stationTier, TIER_ORDER, tierInfo } from "../../lib/tiers";
import { CorridorStrip } from "./CorridorStrip";
import { StationName, StationSheet } from "./StationSheet";

const StationMap = lazy(() => import("./StationMap"));

/** Every tier as word + shape; tiers are NamMa's estimate, so the legend says so. */
function Legend() {
  return (
    <div className="rounded-sm border border-line bg-surface-raised px-3 py-2 shadow-float">
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

function NearPanel({ point, onSelect }: { point: LatLon; onSelect: (id: number) => void }) {
  const near = useNearest(point, 3);
  return (
    <section className="border-b border-line px-4 py-3">
      <h2 className="m-0 text-heading font-semibold">{copy.map.nearYou}</h2>
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

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("station") ? Number(params.get("station")) : null;
  const stations = useStations();
  const [showHii, setShowHii] = useState(false);
  const [point, setPoint] = useState<LatLon | null>(null);
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

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
      setPoint(await getCurrentPosition());
      setPicking(false);
    } catch {
      setPicking(true);
      setNotice(copy.map.locationFailed);
    } finally {
      setLocating(false);
    }
  };

  const onTilesFailed = useCallback(() => setTilesFailed(true), []);

  if (stations.isPending) return <Loading className="h-full" />;
  if (stations.isError) return <ErrorState className="h-full" error={stations.error} onRetry={() => stations.refetch()} />;

  const all = stations.data;
  const selected = all.find((s) => s.id === selectedId) ?? null;
  // RID stations are the primary sources (CLAUDE.md §4); HII 10-min stations are opt-in.
  // Some share a site with an RID station but use a different bank reference.
  const visible = all.filter((s: StationSummary) => showHii || s.agency !== "HII" || s.id === selectedId);

  return (
    <div className="flex h-full flex-col lg:flex-row-reverse">
      <div className="relative h-[46%] shrink-0 lg:h-full lg:min-w-0 lg:flex-1">
        <Suspense fallback={<Loading className="h-full" />}>
          <StationMap
            stations={visible}
            selectedId={selectedId}
            point={point}
            picking={picking}
            onSelect={select}
            onPick={(p) => {
              setPoint(p);
              setPicking(false);
              setNotice(null);
            }}
            onTilesFailed={onTilesFailed}
          />
        </Suspense>

        <div className="pointer-events-none absolute inset-x-2 top-2 z-[500] flex flex-col items-end gap-2">
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
            <p className="pointer-events-auto m-0 max-w-xs rounded-sm border border-line bg-surface-raised px-3 py-2 text-caption text-ink shadow-float">
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
              <p className="m-0 text-body text-ink-muted">{copy.map.subtitle}</p>
              <label className="mt-2 flex min-h-11 items-center gap-3 text-body">
                <input
                  type="checkbox"
                  checked={showHii}
                  onChange={(e) => setShowHii(e.target.checked)}
                  className="size-5 accent-river"
                />
                {copy.map.showHii}
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 sm:hidden">
                {TIER_ORDER.map((k) => (
                  <span key={k} className="flex items-center gap-1.5 text-caption">
                    <TierShape tier={k} />
                    {tierInfo(k).label}
                  </span>
                ))}
                <span className="text-caption text-ink-muted">· {copy.map.estimated}</span>
              </div>
            </header>
            {point && <NearPanel point={point} onSelect={select} />}
            <CorridorStrip stations={visible} onSelect={select} />
            <p className="m-0 px-4 pb-4 text-caption text-ink-muted">
              {copy.footer.dataCredit} · {agencyName("RID")}
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
