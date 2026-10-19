import { divIcon, type DivIcon } from "leaflet";
import type { TierKey } from "./tiers";

/** Pin size grows with tier: a second channel next to the shape and the word in the tooltip. */
export const PIN_SIZE: Record<TierKey, number> = { danger: 24, warning: 22, watch: 18, normal: 14, unknown: 12 };

/** Smallest tap area around a pin, so a 14px dot is still easy to hit with a finger. */
const HIT_SIZE = 32;

const cache = new Map<string, DivIcon>();

/** A Leaflet marker drawn as the tier's own shape (nm-pin--{tier} in index.css), centred in a larger tap area. */
export function pinIcon(tier: TierKey | "here", size: number, selected = false): DivIcon {
  const key = `${tier}:${size}:${selected}`;
  let icon = cache.get(key);
  if (!icon) {
    const hit = Math.max(size, HIT_SIZE);
    icon = divIcon({
      className: "nm-pin-hit",
      html: `<span class="nm-pin nm-pin--${tier}${selected ? " nm-pin--selected" : ""}" style="width:${size}px;height:${size}px"></span>`,
      iconSize: [hit, hit],
      iconAnchor: [hit / 2, hit / 2],
      tooltipAnchor: [0, 0],
    });
    cache.set(key, icon);
  }
  return icon;
}
