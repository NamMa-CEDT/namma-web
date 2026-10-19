import type { FloodClass } from "../../lib/flood";

// DS option C fills: stripes = ท่วมมาก, dots = ท่วมบางส่วน, nothing = ไม่พบน้ำ. Patterns, so the three never rely on
// telling shades of blue apart. One colour pair in both themes: the satellite imagery under them doesn't change.
const MANY = "nm-flood-many";
const SOME = "nm-flood-some";

/** SVG fill for each class: the map's paths and the legend's swatches use the same patterns. */
export const PATTERN_FILL: Record<FloodClass, string> = { many: `url(#${MANY})`, some: `url(#${SOME})`, none: "#000000" };

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
      </defs>
    </svg>
  );
}

/** A legend swatch: the class's pattern in a small box. */
export function Swatch({ cls }: { cls: FloodClass }) {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" focusable="false" className="shrink-0">
      <rect
        x="0.5"
        y="0.5"
        width="21"
        height="15"
        rx="3"
        fill={cls === "none" ? "var(--surface-raised)" : PATTERN_FILL[cls]}
        stroke="var(--ink-muted)"
      />
    </svg>
  );
}
