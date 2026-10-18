// The NamMa mark: a house resting on a water wave (บ้านบนคลื่น). Same geometry as public/brand/*.svg.
// Colours come from the design-system tokens, so it follows the light and dark themes.
const HOUSE = "M 34 10.2 L 55 25.4 V 27.2 H 49.3 V 40.8 C 46.5 41.8 43 42.2 39.9 41.7 C 33 40.7 27 32.6 19.8 32.9 L 19.1 32.95 V 27.2 H 13 V 25.4 Z";
const WAVE = "M 4 43.7 C 8 38.7 13 35.2 19.8 34.9 C 27 34.6 33 42.7 39.9 43.7 C 46 44.6 53 41.7 60 38.7 C 58 47.2 50 53.8 39.9 53.8 C 31 53.8 25 47.7 18 45 C 13 43.2 8 43.2 4 43.7 Z";

export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className="shrink-0"
    >
      <path d={HOUSE} fill="var(--ink)" stroke="var(--ink)" strokeWidth={1.6} strokeLinejoin="round" />
      <path d={WAVE} fill="var(--water)" />
    </svg>
  );
}
