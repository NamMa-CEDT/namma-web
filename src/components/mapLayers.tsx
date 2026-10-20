// Leaflet layers both maps share. Imported only by the lazily loaded map modules, so Leaflet stays out of the main
// bundle.
import L from "leaflet";
import { useEffect, useState } from "react";
import { TileLayer, useMap, useMapEvents } from "react-leaflet";
import { ESRI_CREDIT, LABELS_URL, OSM_CREDIT, SATELLITE_URL, STREETS_URL, type Basemap } from "../lib/basemaps";

export interface MapPlace {
  lat: number;
  lon: number;
  label: string;
}

/** Esri's English labels only while zoomed out (below `untilZoom`); closer in, the map's own names take over. */
function ImageryLabels({ untilZoom }: { untilZoom: number }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return zoom < untilZoom ? <TileLayer key="labels" url={LABELS_URL} maxZoom={18} /> : null;
}

/** The background tiles for `basemap`; `credit` is the map's own data credit, after the tiles'. */
export function BasemapTiles({
  basemap,
  credit,
  labelsUntilZoom,
  onTileError,
}: {
  basemap: Basemap;
  credit: string;
  labelsUntilZoom: number;
  onTileError: () => void;
}) {
  const events = { tileerror: onTileError };
  return basemap === "satellite" ? (
    <>
      <TileLayer key="sat" url={SATELLITE_URL} attribution={`${ESRI_CREDIT} · ${credit}`} maxZoom={18} eventHandlers={events} />
      <ImageryLabels untilZoom={labelsUntilZoom} />
    </>
  ) : (
    <TileLayer key="osm" url={STREETS_URL} attribution={`${OSM_CREDIT} · ${credit}`} maxZoom={18} eventHandlers={events} />
  );
}

/** Hands the Leaflet map up, so the page's own zoom buttons (drawn over the map, outside it) can zoom it. */
export function MapHandle({ onMap }: { onMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => onMap(map), [map, onMap]);
  return null;
}

const HOUSE_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 L12 4 L21 11 M5.5 9.5 V20 H18.5 V9.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>';

/** The person's saved places as house pins, so they can find their own place on the map. */
export function PlacePins({ places }: { places: MapPlace[] }) {
  const map = useMap();
  useEffect(() => {
    const icon = L.divIcon({ className: "nm-home-pin", html: HOUSE_SVG, iconSize: [26, 26] });
    const markers = places.map((p) => {
      const m = L.marker([p.lat, p.lon], { icon, interactive: false, keyboard: false, zIndexOffset: 1000 });
      // Labels are text nodes, never HTML: the label is what the user typed.
      const text = document.createElement("span");
      text.textContent = p.label;
      m.bindTooltip(text, { permanent: true, direction: "right", offset: [12, 0], className: "nm-area-label" });
      return m.addTo(map);
    });
    return () => {
      for (const m of markers) m.remove();
    };
  }, [map, places]);
  return null;
}
