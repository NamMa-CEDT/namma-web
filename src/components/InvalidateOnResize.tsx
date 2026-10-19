import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** Leaflet sizes itself once; tell it when the container changes (panel open/close, rotate). */
export function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}
