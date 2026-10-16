import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { TicketSummary } from "../../api/types";
import { copy } from "../../copy";
import { URGENCY_PIN } from "./badges";

function Fit({ points, selected }: { points: [number, number][]; selected: [number, number] | null }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");
  useEffect(() => {
    const size = map.getSize();
    if (!size.x || !size.y) return; // hidden container: Leaflet would compute NaN coordinates
    if (selected) map.flyTo(selected, Math.max(map.getZoom(), 12), { duration: 0.5 });
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 12 });
    else if (points.length === 1) map.setView(points[0], 12);
  }, [map, key, selected?.[0], selected?.[1]]);
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function TicketMap({
  tickets,
  selectedId,
  onSelect,
  interactive = true,
}: {
  tickets: Pick<TicketSummary, "id" | "lat" | "lon" | "urgency" | "place_label">[];
  selectedId: number | null;
  onSelect?: (id: number) => void;
  interactive?: boolean;
}) {
  const located = tickets.filter((t) => t.lat != null && t.lon != null);
  const points = located.map((t) => [t.lat!, t.lon!] as [number, number]);
  const sel = located.find((t) => t.id === selectedId);

  return (
    <MapContainer
      center={points[0] ?? [14.36, 100.5]}
      zoom={11}
      className="h-full w-full"
      scrollWheelZoom={interactive}
      dragging={interactive}
      zoomControl={interactive}
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Fit points={points} selected={interactive && sel ? [sel.lat!, sel.lon!] : null} />
      {located.map((t) => (
        <CircleMarker
          key={t.id}
          center={[t.lat!, t.lon!]}
          radius={t.id === selectedId ? 11 : t.urgency === "critical" ? 9 : 7}
          pathOptions={{
            color: t.id === selectedId ? "#0c4a6e" : "#ffffff",
            weight: t.id === selectedId ? 4 : 2,
            fillColor: URGENCY_PIN[t.urgency],
            fillOpacity: 1,
          }}
          eventHandlers={onSelect ? { click: () => onSelect(t.id) } : undefined}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            #{t.id} {copy.urgency[t.urgency]} · {t.place_label ?? copy.dashboard.noLocation}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
