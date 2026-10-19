import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { InvalidateOnResize } from "../../components/InvalidateOnResize";
import type { AreaShape } from "../../lib/boundaries";
import type { FloodClass } from "../../lib/flood";
import { PATTERN_FILL } from "./patterns";

export type Basemap = "satellite" | "streets";
export type FlyTarget = { lat: number; lon: number; zoom: number } | { bounds: [number, number, number, number] };
export type MapView = { bbox: [number, number, number, number]; zoom: number };

/** One shaded area on the map: a province zoomed out, a tambon zoomed in. */
export interface MapArea {
  shape: AreaShape;
  cls: FloodClass;
  /** Thai name drawn on the map; null = none (unflooded provinces, to keep the country view calm). */
  label: string | null;
}

export interface MapPlace {
  lat: number;
  lon: number;
  label: string;
}

const SATELLITE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
// English place names and borders over the imagery while zoomed out; from ALL_LABELS_ZOOM our Thai tambon names
// take over.
const LABELS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ESRI_CREDIT = "&copy; Esri, Maxar, Earthstar Geographics";
const CREDIT = "น้ำท่วม: GISTDA · ขอบเขต: กรมแผนที่ทหาร/OCHA";
// Tambon names: the flooded ones from zoom 10, every one from 12 (all of them at 10 is a wall of labels).
const FLOODED_LABELS_ZOOM = 10;
const ALL_LABELS_ZOOM = 12;

const FILL_OPACITY: Record<FloodClass, number> = { many: 0.8, some: 0.65, none: 0 };

function ViewWatcher({ onView }: { onView: (v: MapView) => void }) {
  const map = useMap();
  const emit = useCallback(() => {
    const size = map.getSize();
    if (!size.x || !size.y) return; // hidden container: Leaflet would compute NaN bounds
    const b = map.getBounds();
    onView({ bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: map.getZoom() });
  }, [map, onView]);
  useMapEvents({ moveend: emit });
  useEffect(emit, [emit]);
  return null;
}

function FlyTo({ target }: { target: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    const size = map.getSize();
    if (!target || !size.x || !size.y) return;
    if ("bounds" in target) {
      const [w, s, e, n] = target.bounds;
      map.flyToBounds(
        [
          [s, w],
          [n, e],
        ],
        { padding: [16, 16], duration: 0.6 },
      );
    } else map.flyTo([target.lat, target.lon], target.zoom, { duration: 0.6 });
  }, [map, target]);
  return null;
}

/**
 * The areas as SVG paths (a few hundred at most, so patterns work: stripes = ท่วมมาก, dots = ท่วมบางส่วน, outline
 * only = ไม่พบน้ำ, never shades of blue alone). Imperative on purpose: one layer group, rebuilt when the areas change.
 */
function AreasLayer({
  areas,
  selected,
  onPick,
  basemap,
}: {
  areas: MapArea[];
  selected: string | null;
  onPick: (code: string) => void;
  basemap: Basemap;
}) {
  const map = useMap();
  const pick = useRef(onPick);
  pick.current = onPick;
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const group = useMemo(() => L.layerGroup(), []);

  useEffect(() => {
    group.addTo(map);
    return () => {
      group.remove();
    };
  }, [map, group]);

  useEffect(() => {
    group.clearLayers();
    // Light lines on imagery, dark ones on street tiles.
    const edge = basemap === "satellite" ? "#ffffff" : "#0b1a2e";
    let chosen: L.GeoJSON | null = null;
    for (const a of areas) {
      const code = a.shape.properties.code;
      const isSel = code === selected;
      const layer = L.geoJSON(a.shape, {
        style: {
          color: edge,
          weight: isSel ? 4 : 1.2,
          opacity: isSel ? 1 : 0.75,
          fillColor: PATTERN_FILL[a.cls],
          fillOpacity: FILL_OPACITY[a.cls],
        },
      });
      layer.on("click", () => pick.current(code));
      group.addLayer(layer);
      if (isSel) chosen = layer;
      const tambon = a.shape.properties.tambon != null;
      const named = !tambon || zoom >= ALL_LABELS_ZOOM || (a.cls !== "none" && zoom >= FLOODED_LABELS_ZOOM);
      if (a.label && named) {
        const [lat, lon] = a.shape.properties.label;
        group.addLayer(
          L.tooltip({ permanent: true, direction: "center", className: "nm-area-label", interactive: false })
            .setLatLng([lat, lon])
            .setContent(a.label),
        );
      }
    }
    (chosen as L.GeoJSON | null)?.bringToFront();
  }, [areas, selected, basemap, zoom, group]);

  return null;
}

const HOUSE_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 L12 4 L21 11 M5.5 9.5 V20 H18.5 V9.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>';

/** The person's saved places as house pins, so they can find their own tambon. */
function Places({ places }: { places: MapPlace[] }) {
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

/** Esri's English labels only while zoomed out; closer in, the Thai tambon names. */
function ImageryLabels() {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return zoom < ALL_LABELS_ZOOM ? <TileLayer key="labels" url={LABELS_URL} maxZoom={18} /> : null;
}

interface Props {
  areas: MapArea[];
  selected: string | null;
  onPick: (code: string) => void;
  basemap: Basemap;
  flyTo: FlyTarget | null;
  places: MapPlace[];
  onView: (v: MapView) => void;
  onTilesFailed: () => void;
  /** Off when the map sits inside a scrolling page: the wheel scrolls the page, the buttons zoom. */
  scrollWheelZoom?: boolean;
}

export default function FloodMap({
  areas,
  selected,
  onPick,
  basemap,
  flyTo,
  places,
  onView,
  onTilesFailed,
  scrollWheelZoom = true,
}: Props) {
  const [tileErrors, setTileErrors] = useState(0);
  useEffect(() => {
    if (tileErrors === 8) onTilesFailed();
  }, [tileErrors, onTilesFailed]);
  const onTileError = { tileerror: () => setTileErrors((n) => n + 1) };

  return (
    <MapContainer center={[14.6, 100.45]} zoom={8} minZoom={5} className="h-full w-full" scrollWheelZoom={scrollWheelZoom}>
      {basemap === "satellite" ? (
        <>
          <TileLayer key="sat" url={SATELLITE_URL} attribution={`${ESRI_CREDIT} · ${CREDIT}`} maxZoom={18} eventHandlers={onTileError} />
          <ImageryLabels />
        </>
      ) : (
        <TileLayer
          key="osm"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ${CREDIT}`}
          maxZoom={18}
          eventHandlers={onTileError}
        />
      )}
      <InvalidateOnResize />
      <ViewWatcher onView={onView} />
      <FlyTo target={flyTo} />
      <AreasLayer areas={areas} selected={selected} onPick={onPick} basemap={basemap} />
      <Places places={places} />
    </MapContainer>
  );
}
