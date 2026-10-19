import "leaflet/dist/leaflet.css";

import { cellToBoundary } from "h3-js";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { FloodCell } from "../../api/types";
import { InvalidateOnResize } from "../../components/InvalidateOnResize";
import { copy } from "../../copy";
import { cellOpacity, cellPlace, formatRai, resForZoom, viewBox } from "../../lib/flood";
import { formatDate } from "../../lib/format";
import { useTokens } from "../../lib/useTokens";

export type Basemap = "satellite" | "streets";
export interface FlyTarget {
  lat: number;
  lon: number;
  zoom: number;
}

const SATELLITE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
// Place names and borders over the imagery, so people can find their district on a photo.
const LABELS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
// Short: on a phone the attribution sits on the map itself.
const ESRI_CREDIT = "&copy; Esri, Maxar, Earthstar Geographics";
const GISTDA_CREDIT = "น้ำท่วม: GISTDA";

/** Reports the view (snapped box + H3 resolution for the zoom) after every pan or zoom, and once at start. */
function ViewWatcher({ onView }: { onView: (v: { bbox: string; res: number }) => void }) {
  const map = useMap();
  const emit = useCallback(() => {
    const size = map.getSize();
    if (!size.x || !size.y) return; // hidden container: Leaflet would compute NaN bounds
    const b = map.getBounds();
    const res = resForZoom(map.getZoom());
    onView({ bbox: viewBox(b.getWest(), b.getSouth(), b.getEast(), b.getNorth(), res), res });
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
    map.flyTo([target.lat, target.lon], target.zoom, { duration: 0.6 });
  }, [map, target]);
  return null;
}

/** Popup for one of GISTDA's cells, built as DOM nodes (place names come from GISTDA: never as HTML). */
function popup(c: FloodCell): HTMLElement {
  const el = document.createElement("div");
  const line = (text: string, bold = false) => {
    const p = document.createElement(bold ? "strong" : "div");
    p.textContent = text;
    el.appendChild(p);
  };
  const place = cellPlace(c);
  if (place) line(place, true);
  line(`${copy.flood.popupFlooded} ${formatRai(c.area_km2 * 625)} · ${copy.flood.popupShare(Math.round(c.share * 100))}`);
  if (c.observed_at) line(`${copy.flood.popupObserved} ${formatDate(c.observed_at)}`);
  return el;
}

/**
 * GISTDA's cells as hexagons (h3-js boundaries) on one canvas: thousands of SVG paths would make phones crawl.
 * Imperative on purpose: one Leaflet layer group, rebuilt when the cells change.
 */
function HexLayer({ cells, res, basemap }: { cells: FloodCell[]; res: number; basemap: Basemap }) {
  const map = useMap();
  const colors = useTokens(["flood", "flood-edge", "flood-edge-on-imagery"] as const);
  // A dark edge disappears on imagery and a light one on street tiles.
  const edge = basemap === "satellite" ? colors["flood-edge-on-imagery"] || "#e6f5ff" : colors["flood-edge"] || "#06467f";
  const group = useMemo(() => L.layerGroup(), []);
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  useEffect(() => {
    group.addTo(map);
    return () => {
      group.remove();
    };
  }, [map, group]);

  useEffect(() => {
    group.clearLayers();
    for (const c of cells) {
      const poly = L.polygon(cellToBoundary(c.h3) as L.LatLngTuple[], {
        renderer,
        color: edge,
        weight: 1,
        opacity: 0.9,
        fillColor: colors.flood || "#1aa3ff",
        fillOpacity: cellOpacity(c.share),
      });
      if (res === 9) poly.bindPopup(() => popup(c));
      // A parent cell is a sum of GISTDA's cells: tapping it zooms in towards them (the panel lists the totals).
      else poly.on("click", (e) => map.flyTo(e.latlng, Math.min(map.getZoom() + 2, 13), { duration: 0.4 }));
      group.addLayer(poly);
    }
  }, [cells, res, colors, edge, group, renderer, map]);

  return null;
}

interface Props {
  cells: FloodCell[];
  res: number;
  basemap: Basemap;
  flyTo: FlyTarget | null;
  onView: (v: { bbox: string; res: number }) => void;
  onTilesFailed: () => void;
}

export default function FloodMap({ cells, res, basemap, flyTo, onView, onTilesFailed }: Props) {
  const [tileErrors, setTileErrors] = useState(0);
  useEffect(() => {
    if (tileErrors === 8) onTilesFailed();
  }, [tileErrors, onTilesFailed]);
  const onTileError = { tileerror: () => setTileErrors((n) => n + 1) };

  return (
    <MapContainer center={[14.6, 100.45]} zoom={8} minZoom={5} className="h-full w-full" scrollWheelZoom>
      {basemap === "satellite" ? (
        <>
          <TileLayer key="sat" url={SATELLITE_URL} attribution={`${ESRI_CREDIT} · ${GISTDA_CREDIT}`} maxZoom={18} eventHandlers={onTileError} />
          <TileLayer key="labels" url={LABELS_URL} maxZoom={18} />
        </>
      ) : (
        <TileLayer
          key="osm"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ${GISTDA_CREDIT}`}
          maxZoom={18}
          eventHandlers={onTileError}
        />
      )}
      <InvalidateOnResize />
      <ViewWatcher onView={onView} />
      <FlyTo target={flyTo} />
      <HexLayer cells={cells} res={res} basemap={basemap} />
    </MapContainer>
  );
}
