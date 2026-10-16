import "leaflet/dist/leaflet.css";

import type { LatLngBoundsExpression } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { LatLon, StationSummary } from "../../api/types";
import { copy } from "../../copy";
import { stationTier, tierInfo } from "../../lib/tiers";

// Marker size grows with tier: a second channel next to colour (and the label/legend).
const RADIUS: Record<string, number> = { danger: 11, warning: 10, watch: 9, normal: 7, unknown: 6 };
const LABEL_ALL_ZOOM = 10;

interface Props {
  stations: StationSummary[];
  selectedId: number | null;
  point: LatLon | null;
  picking: boolean;
  onSelect: (id: number) => void;
  onPick: (p: LatLon) => void;
  onTilesFailed: () => void;
}

function MapEvents({ onZoom, onClick }: { onZoom: (z: number) => void; onClick?: (p: LatLon) => void }) {
  useMapEvents({
    zoomend: (e) => onZoom(e.target.getZoom()),
    click: (e) => onClick?.({ lat: e.latlng.lat, lon: e.latlng.lng }),
  });
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

/** Leaflet sizes itself once; tell it when the container changes (panel open/close, rotate). */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function StationMap({ stations, selectedId, point, picking, onSelect, onPick, onTilesFailed }: Props) {
  const [zoom, setZoom] = useState(8);
  const [tileErrors, setTileErrors] = useState(0);

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
      boundsOptions={{ padding: [24, 24] }}
      center={bounds ? undefined : [14.6, 100.4]}
      zoom={bounds ? undefined : 8}
      className={`h-full w-full ${picking ? "cursor-crosshair" : ""}`}
      scrollWheelZoom
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ข้อมูลน้ำ: ThaiWater (สสน.)'
        maxZoom={18}
        eventHandlers={{ tileerror: () => setTileErrors((n) => n + 1) }}
      />
      <MapEvents onZoom={setZoom} onClick={picking ? onPick : undefined} />
      <InvalidateOnResize />
      <FlyTo target={selected ? { lat: selected.lat, lon: selected.lon } : point} />

      {ordered.map((s) => {
        const tier = stationTier(s);
        const t = tierInfo(tier);
        const isSelected = s.id === selectedId;
        const small = s.agency === "HII";
        const permanent = s.agency === "RID" && (zoom >= LABEL_ALL_ZOOM || s.role === "main" || s.id === 2611);
        return (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lon]}
            radius={RADIUS[tier] - (small ? 2 : 0) + (isSelected ? 2 : 0)}
            pathOptions={{
              color: isSelected ? "#0c4a6e" : "#ffffff",
              weight: isSelected ? 4 : 2,
              fillColor: t.color,
              fillOpacity: 1,
              dashArray: tier === "unknown" ? "3 3" : undefined,
            }}
            eventHandlers={{ click: () => onSelect(s.id) }}
          >
            <Tooltip
              permanent={permanent}
              direction={s.role === "branch" ? "left" : "right"}
              offset={s.role === "branch" ? [-10, 0] : [10, 0]}
              className={permanent ? "station-code" : undefined}
            >
              {permanent ? (
                s.oldcode
              ) : (
                <span>
                  <b>{s.oldcode}</b> {s.name_th} · {t.label}
                </span>
              )}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {point && (
        <CircleMarker
          center={[point.lat, point.lon]}
          radius={8}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2a78d6", fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            {copy.map.pickedPoint}
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
