import "leaflet/dist/leaflet.css";

import type { LatLngBoundsExpression } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { LatLon, StationSummary } from "../../api/types";
import { copy } from "../../copy";
import { PIN_SIZE, pinIcon } from "../../lib/pins";
import { stationTier, tierInfo } from "../../lib/tiers";

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
        const size = PIN_SIZE[tier] - (s.agency === "HII" ? 4 : 0) + (isSelected ? 4 : 0);
        const permanent = s.agency === "RID" && (zoom >= LABEL_ALL_ZOOM || s.role === "main" || s.id === 2611);
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
            <Tooltip
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

      {point && (
        <Marker position={[point.lat, point.lon]} icon={pinIcon("here", 18)} zIndexOffset={2000}>
          <Tooltip direction="top" offset={[0, -12]}>
            {copy.map.pickedPoint}
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
