import { divIcon, type DivIcon } from "leaflet";
import type { TierKey } from "./tiers";

/** Pin size grows with tier: a second channel next to the shape and the word in the tooltip. */
export const PIN_SIZE: Record<TierKey, number> = { danger: 24, warning: 22, watch: 18, normal: 14, unknown: 12 };

const cache = new Map<string, DivIcon>();

/** A Leaflet marker drawn as the tier's own shape (nm-pin--{tier} in index.css). */
export function pinIcon(tier: TierKey | "here", size: number, selected = false): DivIcon {
  const key = `${tier}:${size}:${selected}`;
  let icon = cache.get(key);
  if (!icon) {
    icon = divIcon({
      className: "",
      html: `<span class="nm-pin nm-pin--${tier}${selected ? " nm-pin--selected" : ""}"></span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      tooltipAnchor: [0, 0],
    });
    cache.set(key, icon);
  }
  return icon;
}
