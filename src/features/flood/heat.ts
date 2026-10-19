// Close-up flood heatmap colours: pale where a little of the ground is under water, deep blue where all of it is.
// One hue (blue = water seen, never a risk tier), getting darker and more opaque, so it reads without colour vision
// and stays visible on satellite imagery at both ends. The canvas, the legend and the card swatch share these stops.

/** [intensity 0–1, r, g, b, alpha]. */
const STOPS: [number, number, number, number, number][] = [
  [0, 190, 228, 255, 0.4],
  [0.35, 106, 176, 240, 0.62],
  [0.7, 31, 120, 209, 0.82],
  [1, 11, 61, 145, 0.92],
];

function at(t: number): [number, number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, ...b] = STOPS[i];
    if (x <= t1) {
      const [t0, ...a] = STOPS[i - 1];
      const k = (x - t0) / (t1 - t0);
      return a.map((v, j) => v + (b[j] - v) * k) as [number, number, number, number];
    }
  }
  const [, ...last] = STOPS[STOPS.length - 1];
  return last as [number, number, number, number];
}

/** CSS colour for an intensity (card swatch). */
export function heatColor(t: number): string {
  const [r, g, b, a] = at(t);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)})`;
}

/** CSS gradient for the legend bar. */
export const HEAT_GRADIENT = `linear-gradient(to right, ${STOPS.map(([t]) => `${heatColor(t)} ${t * 100}%`).join(", ")})`;

/** 256 RGBA entries: accumulated alpha (0–255) on the canvas → colour. */
export function heatPalette(): Uint8ClampedArray {
  const out = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const [r, g, b, a] = at(i / 255);
    out.set([r, g, b, a * 255], i * 4);
  }
  return out;
}
