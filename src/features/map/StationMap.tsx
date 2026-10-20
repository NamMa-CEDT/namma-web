import "leaflet/dist/leaflet.css";

import type { LatLngBoundsExpression, Map as LeafletMap } from "leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { LatLon, StationSummary } from "../../api/types";
import { InvalidateOnResize } from "../../components/InvalidateOnResize";
import { BasemapTiles, MapHandle, PlacePins, type MapPlace } from "../../components/mapLayers";
import { copy } from "../../copy";
import type { Basemap } from "../../lib/basemaps";
import { PIN_SIZE, pinIcon } from "../../lib/pins";
import { stationTier, tierInfo, type TierKey } from "../../lib/tiers";

const LABEL_ALL_ZOOM = 10;
/** The demo corridor's main stem keeps its codes from here in, before every RID station gets one. */
const LABEL_MAIN_ZOOM = 9;
/** Zoomed out to the whole country, calm pins shrink so the raised ones stand out among ~500. */
const COUNTRY_ZOOM = 7;
const CALM: TierKey[] = ["normal", "unknown"];
const CREDIT = "ข้อมูลน้ำ: ThaiWater (สสน.)";

interface Props {
  stations: StationSummary[];
  selectedId: number | null;
  point: LatLon | null;
  /** The point is a saved place, already drawn as a house pin: no "picked point" pin over it. */
  pointIsPlace: boolean;
  /** Points to fit the view to (a river's stations, from the search); null leaves the view alone. */
  fitTo: LatLon[] | null;
  picking: boolean;
  basemap: Basemap;
  /** Saved places, as house pins. */
  places: MapPlace[];
  onSelect: (id: number) => void;
  onPick: (p: LatLon) => void;
  onTilesFailed: () => void;
  /** The Leaflet map, once made. The page draws its own zoom buttons: Leaflet's are off. */
  onMap: (map: LeafletMap) => void;
  onZoom: (zoom: number) => void;
}

function MapEvents({ onZoom, onClick }: { onZoom: (z: number) => void; onClick?: (p: LatLon) => void }) {
  const map = useMapEvents({
    zoomend: (e) => onZoom(e.target.getZoom()),
    click: (e) => onClick?.({ lat: e.latlng.lat, lon: e.latlng.lng }),
  });
  // The zoom the bounds fit picked (the whole country is ~6), before any zoomend.
  useEffect(() => onZoom(map.getZoom()), [map, onZoom]);
  return null;
}

/** Zooms to fit these points, when the search picks a river. Re-runs when the picked river changes. */
function FitTo({ points }: { points: LatLon[] | null }) {
  const map = useMap();
  const key = points?.map((p) => `${p.lat},${p.lon}`).join(";") ?? "";
  useEffect(() => {
    const size = map.getSize();
    if (!points?.length || !size.x || !size.y) return; // hidden container: see FlyTo
    const bounds = points.map((p) => [p.lat, p.lon] as [number, number]);
    map.flyToBounds(bounds, { padding: [32, 32], maxZoom: 12, duration: 0.6 });
  }, [map, key]);
  return null;
}

function FlyTo({ target }: { target: LatLon | null }) {
  const map = useMap();
  useEffect(() => {
    const size = map.getSize();
    if (!target || !size.x || !size.y) return; // hidden container: Leaflet would compute NaN coordinates
    const zoom = Math.max(map.getZoom(), 10);
    map.flyTo([target.lat, target.lon], zoom, { duration: 0.6 });
  }, [map, target?.lat, target?.lon]);
  return null;
}

export default function StationMap({
  stations,
  selectedId,
  point,
  pointIsPlace,
  fitTo,
  picking,
  basemap,
  places,
  onSelect,
  onPick,
  onTilesFailed,
  onMap,
  onZoom,
}: Props) {
  const [zoom, setZoom] = useState(8);
  const [tileErrors, setTileErrors] = useState(0);
  const onTileError = useCallback(() => setTileErrors((n) => n + 1), []);
  const zoomed = useCallback(
    (z: number) => {
      setZoom(z);
      onZoom(z);
    },
    [onZoom],
  );

  const bounds = useMemo<LatLngBoundsExpression | undefined>(() => {
    if (!stations.length) return undefined;
    const lats = stations.map((s) => s.lat);
    const lons = stations.map((s) => s.lon);
    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ];
  }, [stations.length]);

  useEffect(() => {
    if (tileErrors === 8) onTilesFailed();
  }, [tileErrors, onTilesFailed]);

  const selected = stations.find((s) => s.id === selectedId) ?? null;
  // Draw raised tiers last so they sit on top where markers overlap.
  const ordered = [...stations].sort((a, b) => tierInfo(stationTier(a)).rank - tierInfo(stationTier(b)).rank);

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [12, 12] }}
      // Quarter steps: on a phone the map is short and wide, and whole steps leave the country at zoom 4, small
      // among its neighbours.
      zoomSnap={0.25}
      center={bounds ? undefined : [13.0, 101.0]}
      zoom={bounds ? undefined : 6}
      className={`h-full w-full ${picking ? "cursor-crosshair" : ""}`}
      scrollWheelZoom
      zoomControl={false}
    >
      <BasemapTiles basemap={basemap} credit={CREDIT} labelsUntilZoom={LABEL_ALL_ZOOM} onTileError={onTileError} />
      <MapEvents onZoom={zoomed} onClick={picking ? onPick : undefined} />
      <MapHandle onMap={onMap} />
      <InvalidateOnResize />
      <FlyTo target={selected ? { lat: selected.lat, lon: selected.lon } : point} />
      <FitTo points={selected ? null : fitTo} />

      {ordered.map((s) => {
        const tier = stationTier(s);
        const t = tierInfo(tier);
        const isSelected = s.id === selectedId;
        const shrink = (s.agency === "HII" ? 4 : 0) + (zoom <= COUNTRY_ZOOM && CALM.includes(tier) ? 4 : 0);
        const size = Math.max(8, PIN_SIZE[tier] - shrink) + (isSelected ? 4 : 0);
        const permanent =
          s.agency === "RID" &&
          (zoom >= LABEL_ALL_ZOOM || (zoom >= LABEL_MAIN_ZOOM && (s.role === "main" || s.id === 2611)));
        const side = s.role === "branch" ? -1 : 1;
        return (
          <Marker
            key={s.id}
            position={[s.lat, s.lon]}
            icon={pinIcon(tier, size, isSelected)}
            title={`${s.name_th ?? ""} ${s.oldcode ?? ""} · ${t.label}`}
            alt={`${s.name_th ?? ""} ${t.label}`}
            zIndexOffset={t.rank * 100 + (isSelected ? 1000 : 0)}
            eventHandlers={{ click: () => onSelect(s.id) }}
          >
            {/* react-leaflet reads `permanent` only when the tooltip is made: a new key remakes it as the zoom crosses
                a label threshold. */}
            <Tooltip
              key={permanent ? "label" : "hover"}
              permanent={permanent}
              direction={side < 0 ? "left" : "right"}
              offset={[side * (size / 2 + 4), 0]}
              className={permanent ? "station-code" : undefined}
            >
              {permanent ? (
                s.oldcode
              ) : (
                <span>
                  <b>{s.name_th}</b> ({s.oldcode}) · {t.label}
                </span>
              )}
            </Tooltip>
          </Marker>
        );
      })}

      <PlacePins places={places} />

      {point && !pointIsPlace && (
        <Marker position={[point.lat, point.lon]} icon={pinIcon("here", 18)} zIndexOffset={2000}>
          <Tooltip direction="top" offset={[0, -12]}>
            {copy.map.pickedPoint}
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
