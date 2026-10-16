import { lazy, Suspense, useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { useNearest, useStations } from "../../api/queries";
import type { LatLon, StationSummary } from "../../api/types";
import { LocateIcon } from "../../components/icons";
import { ErrorState, Loading } from "../../components/States";
import { TierBadge, TierDot } from "../../components/TierBadge";
import { copy } from "../../copy";
import { formatBankGap, formatDistance } from "../../lib/format";
import { getCurrentPosition } from "../../lib/geolocation";
import { stationTier, TIER_ORDER, tierInfo } from "../../lib/tiers";
import { CorridorStrip } from "./CorridorStrip";
import { StationSheet } from "./StationSheet";

const StationMap = lazy(() => import("./StationMap"));

function Legend() {
  return (
    <div className="rounded-xl bg-white/95 px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold text-slate-700">{copy.map.legend}</div>
      <ul className="space-y-0.5">
        {TIER_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-1.5 text-slate-700">
            <TierDot tier={k} />
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
    <section className="border-b border-slate-200 px-4 py-3">
      <h2 className="text-sm font-semibold text-slate-700">{copy.map.nearYou}</h2>
      {near.isPending ? (
        <Loading />
      ) : near.isError ? (
        <ErrorState error={near.error} onRetry={() => near.refetch()} />
      ) : (
        <ul className="mt-2 space-y-1">
          {near.data.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{s.oldcode}</span> {s.name_th}
                  <span className="block text-xs text-slate-500">
                    ห่าง {formatDistance(s.distance_km)} · {formatBankGap(s.latest?.diff_wl_bank)}
                  </span>
                </span>
                <TierBadge tier={stationTier(s)} size="sm" />
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
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-semibold text-brand-800 shadow-md disabled:opacity-60"
          >
            <LocateIcon />
            {locating ? copy.map.locating : copy.map.myLocation}
          </button>
          {(notice || picking || tilesFailed) && (
            <p className="pointer-events-auto max-w-xs rounded-lg bg-slate-900/85 px-3 py-2 text-xs text-white">
              {tilesFailed ? copy.map.tilesFailed : (notice ?? copy.map.pickHint)}
            </p>
          )}
        </div>
        <div className="absolute bottom-6 left-2 z-[500] hidden sm:block">
          <Legend />
        </div>
      </div>

      <aside className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 bg-white lg:w-[400px] lg:flex-none lg:border-t-0 lg:border-r">
        {selected ? (
          <StationSheet id={selected.id} onClose={() => select(null)} onSelect={select} />
        ) : (
          <>
            <header className="border-b border-slate-200 px-4 py-3">
              <h1 className="text-lg font-semibold">{copy.map.title}</h1>
              <p className="text-sm text-slate-600">{copy.map.subtitle}</p>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={showHii}
                  onChange={(e) => setShowHii(e.target.checked)}
                  className="size-4 accent-brand-700"
                />
                {copy.map.showHii}
              </label>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 sm:hidden">
                {TIER_ORDER.map((k) => (
                  <span key={k} className="flex items-center gap-1 text-xs text-slate-600">
                    <TierDot tier={k} />
                    {tierInfo(k).label}
                  </span>
                ))}
              </div>
            </header>
            {point && <NearPanel point={point} onSelect={select} />}
            <CorridorStrip stations={visible} onSelect={select} />
            <p className="px-4 pb-4 text-xs text-slate-500">{copy.footer.dataCredit}</p>
          </>
        )}
      </aside>
    </div>
  );
}
