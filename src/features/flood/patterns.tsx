import type { FloodClass } from "../../lib/flood";

// DS option C fills: stripes = ท่วมมาก, dots = ท่วมบางส่วน, nothing = ไม่พบน้ำ. Patterns, so the three never rely on
// telling shades of blue apart. Close up, the water itself: blue with a wave line, so it reads as water at a glance.
// One colour set in both themes: the satellite imagery under them doesn't change.
const MANY = "nm-flood-many";
const SOME = "nm-flood-some";
const WATER = "nm-flood-water";

/** SVG fill for each class: the map's paths and the legend's swatches use the same patterns. */
export const PATTERN_FILL: Record<FloodClass, string> = { many: `url(#${MANY})`, some: `url(#${SOME})`, none: "#000000" };
export const WATER_FILL = `url(#${WATER})`;
/** Edge of a water patch: light, so it shows on fields and on dark water alike. */
export const WATER_EDGE = "#e6f5ff";

/** The pattern definitions, once per page (an SVG fill can point at a pattern in another inline SVG). */
export function FloodPatterns() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <defs>
        <pattern id={MANY} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill="#1f78d1" />
          <line x1="0" y1="0" x2="0" y2="10" stroke="#ffffff" strokeWidth="3" strokeOpacity="0.45" />
        </pattern>
        <pattern id={SOME} width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#6ab0f0" />
          <circle cx="5" cy="5" r="1.7" fill="#ffffff" fillOpacity="0.8" />
        </pattern>
        <pattern id={WATER} width="22" height="10" patternUnits="userSpaceOnUse">
          <rect width="22" height="10" fill="#2a8ce6" />
          <path d="M0 5 Q 5.5 1 11 5 T 22 5" fill="none" stroke="#cfe8ff" strokeWidth="1.2" strokeOpacity="0.55" />
        </pattern>
      </defs>
    </svg>
  );
}

/** A legend swatch: a class's pattern, the water, or the dashed tambon border. */
export function Swatch({ cls }: { cls: FloodClass | "water" | "border" }) {
  if (cls === "border") {
    return (
      <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" focusable="false" className="shrink-0">
        <line x1="1" y1="8" x2="21" y2="8" stroke="var(--ink)" strokeWidth="2" strokeDasharray="5 3" />
      </svg>
    );
  }
  const fill = cls === "water" ? WATER_FILL : cls === "none" ? "var(--surface-raised)" : PATTERN_FILL[cls];
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" focusable="false" className="shrink-0">
      <rect x="0.5" y="0.5" width="21" height="15" rx={cls === "water" ? 5 : 3} fill={fill} stroke={cls === "water" ? WATER_EDGE : "var(--ink-muted)"} />
    </svg>
  );
}
