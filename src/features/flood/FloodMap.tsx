import "leaflet/dist/leaflet.css";

import type { MultiPolygon } from "geojson";
import { cellToBoundary, cellToLatLng } from "h3-js";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { InvalidateOnResize } from "../../components/InvalidateOnResize";
import type { AreaShape } from "../../lib/boundaries";
import type { FloodClass } from "../../lib/flood";
import type { WaterPatch } from "../../lib/water";
import { heatPalette } from "./heat";
import { PATTERN_FILL, WATER_EDGE } from "./patterns";

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
  outlineOnly,
}: {
  areas: MapArea[];
  selected: string | null;
  onPick: (code: string, lat: number, lon: number) => void;
  basemap: Basemap;
  /** Close up: the water patches show the flooding; tambons are just dashed borders (still tappable). */
  outlineOnly: boolean;
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
        style: outlineOnly
          ? { color: edge, weight: isSel ? 3 : 2, opacity: 0.85, dashArray: "7 5", fillColor: "#000000", fillOpacity: 0 }
          : {
              color: edge,
              weight: isSel ? 4 : 1.2,
              opacity: isSel ? 1 : 0.75,
              fillColor: PATTERN_FILL[a.cls],
              fillOpacity: FILL_OPACITY[a.cls],
            },
      });
      layer.on("click", (e: L.LeafletMouseEvent) => pick.current(code, e.latlng.lat, e.latlng.lng));
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
  }, [areas, selected, basemap, zoom, group, outlineOnly]);

  return null;
}

// Water sits in its own panes above the tambons: the heat canvas, then the tappable outlines over it.
const HEAT_PANE = "nm-heat";
const WATER_PANE = "nm-water";

/**
 * The close-up heatmap: every GISTDA cell stamped as a soft blob weighted by how much of it is flooded, so where many
 * well-flooded cells sit together the water reads deep blue and a scatter of half-wet cells reads pale. The summed
 * alpha is coloured through heat.ts and cut to the patches' smooth outlines. One canvas, redrawn after each pan or
 * zoom (hidden while Leaflet animates a zoom): thousands of cells stay fast on a phone.
 */
function HeatCanvas({ patches }: { patches: WaterPatch[] }) {
  const map = useMap();
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.className = "leaflet-zoom-hide";
    c.style.position = "absolute";
    c.style.pointerEvents = "none";
    return c;
  }, []);
  const palette = useMemo(() => heatPalette(), []);

  const draw = useCallback(() => {
    const size = map.getSize();
    if (!size.x || !size.y) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size.x * dpr;
    canvas.height = size.y * dpr;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    const ctx = canvas.getContext("2d");
    if (!ctx || !patches.length) {
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);

    // A cell's radius on screen at this zoom, from one cell's centre to a corner.
    const first = patches[0].cells[0].h3;
    const [clat, clon] = cellToLatLng(first);
    const [vlat, vlon] = cellToBoundary(first)[0];
    const cellR = map.latLngToContainerPoint([clat, clon]).distanceTo(map.latLngToContainerPoint([vlat, vlon]));
    const r = Math.max(4, cellR * 2.2);
    const stamp = document.createElement("canvas");
    stamp.width = stamp.height = Math.ceil(r * 2);
    const sctx = stamp.getContext("2d")!;
    const g = sctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, stamp.width, stamp.height);

    // 1. A smooth flooded-share field: Σ(share × blob) / Σ(blob), summed additively on two canvases. A weighted
    //    average, so the colour follows how much of the ground is under water, not how many cells happen to be close.
    const w = canvas.width;
    const h = canvas.height;
    const layer = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d", { willReadFrequently: true })!;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.globalCompositeOperation = "lighter";
      return x;
    };
    const shareSum = layer();
    const weightSum = layer();
    const K = 0.09; // per-blob weight: ~10 overlapping blobs stay under the 8-bit ceiling
    for (const p of patches) {
      for (const c of p.cells) {
        const [lat, lon] = cellToLatLng(c.h3);
        const pt = map.latLngToContainerPoint([lat, lon]);
        if (pt.x < -r || pt.y < -r || pt.x > size.x + r || pt.y > size.y + r) continue;
        shareSum.globalAlpha = K * Math.min(1, c.share);
        shareSum.drawImage(stamp, pt.x - r, pt.y - r);
        weightSum.globalAlpha = K;
        weightSum.drawImage(stamp, pt.x - r, pt.y - r);
      }
    }

    // 2. Colour: share → the heat palette.
    const num = shareSum.getImageData(0, 0, w, h).data;
    const den = weightSum.getImageData(0, 0, w, h).data;
    const img = ctx.createImageData(w, h);
    const px = img.data;
    for (let i = 3; i < px.length; i += 4) {
      if (den[i] < 3) continue;
      const j = Math.min(255, Math.round((num[i] / den[i]) * 255)) * 4;
      px[i - 3] = palette[j];
      px[i - 2] = palette[j + 1];
      px[i - 1] = palette[j + 2];
      px[i] = palette[j + 3];
    }
    ctx.putImageData(img, 0, 0);

    // 3. Cut to the patches' smooth outlines, so the heat ends where the water does.
    const clip = new Path2D();
    for (const p of patches) {
      for (const poly of p.polygons) {
        for (const ring of poly) {
          ring.forEach(([lon, lat], i) => {
            const pt = map.latLngToContainerPoint([lat, lon]);
            if (i === 0) clip.moveTo(pt.x, pt.y);
            else clip.lineTo(pt.x, pt.y);
          });
          clip.closePath();
        }
      }
    }
    ctx.globalCompositeOperation = "destination-in";
    ctx.fill(clip, "evenodd");
    ctx.globalCompositeOperation = "source-over";
  }, [map, canvas, patches, palette]);

  useEffect(() => {
    const pane = map.getPane(HEAT_PANE) ?? map.createPane(HEAT_PANE);
    pane.style.zIndex = "440";
    pane.appendChild(canvas);
    return () => {
      canvas.remove();
    };
  }, [map, canvas]);
  useEffect(draw, [draw]);
  useMapEvents({ moveend: draw, resize: draw });
  return null;
}

/** Close up: GISTDA's cells merged into smooth patches of water (lib/water.ts), each one tappable. */
function WaterLayer({
  patches,
  selected,
  onPick,
}: {
  patches: WaterPatch[];
  selected: string | null;
  onPick: (id: string) => void;
}) {
  const map = useMap();
  const pick = useRef(onPick);
  pick.current = onPick;
  const group = useMemo(() => L.layerGroup(), []);

  useEffect(() => {
    if (!map.getPane(WATER_PANE)) map.createPane(WATER_PANE).style.zIndex = "450";
    group.addTo(map);
    return () => {
      group.remove();
    };
  }, [map, group]);

  useEffect(() => {
    group.clearLayers();
    for (const p of patches) {
      const isSel = p.id === selected;
      const shape: MultiPolygon = { type: "MultiPolygon", coordinates: p.polygons };
      const layer = L.geoJSON(
        shape,
        {
          pane: WATER_PANE,
          // The heat canvas underneath does the colour; this is the shoreline, and the tap target (an invisible fill
          // still takes clicks).
          style: { color: WATER_EDGE, weight: isSel ? 4 : 1.5, opacity: 0.95, lineJoin: "round", fillColor: "#000000", fillOpacity: 0 },
        },
      );
      layer.on("click", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        pick.current(p.id);
      });
      group.addLayer(layer);
    }
  }, [patches, selected, group]);

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
  /** A tap on an area, with where exactly (close up, the panel says how far the water is from that point). */
  onPick: (code: string, lat: number, lon: number) => void;
  /** Close up (zoom 13+): water patches over dashed tambon borders. */
  closeUp: boolean;
  water: WaterPatch[];
  selectedWater: string | null;
  onPickWater: (id: string) => void;
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
  closeUp,
  water,
  selectedWater,
  onPickWater,
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
    <MapContainer
      center={[14.6, 100.45]}
      zoom={8}
      minZoom={5}
      className="h-full w-full"
      scrollWheelZoom={scrollWheelZoom}
      attributionControl={false}
    >
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
      <AreasLayer areas={areas} selected={selected} onPick={onPick} basemap={basemap} outlineOnly={closeUp} />
      <HeatCanvas patches={water} />
      <WaterLayer patches={water} selected={selectedWater} onPick={onPickWater} />
      <Places places={places} />
    </MapContainer>
  );
}
