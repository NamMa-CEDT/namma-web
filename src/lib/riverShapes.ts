// Shapes for the Home page's two "see the water" charts (River Now redesign, boards E and F).
// Both only redraw each station's diff_wl_bank against its own bank; neither is a real depth or channel shape.

const r2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** River line (E): the drawn range is 2 m over the bank to 5 m under it; readings past either end sit on the edge. */
export const LINE_ABOVE_M = 2;
export const LINE_BELOW_M = 5;
const LINE_TOP = 8;

export interface LinePoint {
  /** 0–100, across the chart (percent of its width). */
  x: number;
  /** px from the top of the chart. */
  y: number;
}

export interface WaterLine {
  /** px from the top: where the bank line sits. */
  bank: number;
  /** SVG path in a `0 0 100 height` box: the water, from the bottom up to the surface through each station. */
  water: string;
  /** The parts of the water above the bank, drawn on top in the danger colour; "" when none. */
  over: string;
  points: LinePoint[];
}

/**
 * One river's water surface, upstream on the left. `pad` keeps the first and last station off the edges (percent).
 * The surface runs flat from each end station to the chart edge.
 */
export function waterLine(diffs: number[], height: number, pad = 7): WaterLine {
  const k = (height - LINE_TOP) / (LINE_ABOVE_M + LINE_BELOW_M);
  const bank = LINE_TOP + LINE_ABOVE_M * k;
  const n = diffs.length;
  const raw = diffs.map((d, i): [number, number] => [
    n === 1 ? 50 : pad + (i * (100 - 2 * pad)) / (n - 1),
    bank - clamp(d, -LINE_BELOW_M, LINE_ABOVE_M) * k,
  ]);
  const points = raw.map(([x, y]) => ({ x: r2(x), y: r2(y) }));
  if (!n) return { bank, water: "", over: "", points };

  const pts: [number, number][] = [[0, raw[0][1]], ...raw, [100, raw[n - 1][1]]];
  const fmt = (p: [number, number]) => `${r2(p[0])},${r2(p[1])}`;
  const water = `M0,${height} L${pts.map(fmt).join(" L")} L100,${height} Z`;

  // Cut the surface where it crosses the bank; each run above the bank becomes one closed shape.
  const polys: [number, number][][] = [];
  let cur: [number, number][] | null = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const above = p[1] < bank;
    if (i === 0) {
      if (above) cur = [[p[0], bank]];
    } else if (above !== pts[i - 1][1] < bank) {
      const q = pts[i - 1];
      const x = q[0] + ((bank - q[1]) / (p[1] - q[1])) * (p[0] - q[0]);
      if (above) cur = [[x, bank]];
      else if (cur) {
        cur.push([x, bank]);
        polys.push(cur);
        cur = null;
      }
    }
    if (above && cur) cur.push(p);
  }
  if (cur) {
    cur.push([100, bank]);
    polys.push(cur);
  }
  const over = polys.map((pl) => `M${pl.map(fmt).join(" L")} Z`).join(" ");
  return { bank, water, over, points };
}

/** Cross-section (F): the bank top sits at 40% of the height; 5 m under the bank is an empty channel. */
export const SECTION_DEPTH_M = 5;

export interface Section {
  /** The land (both banks and the bed), as SVG polygon points. */
  land: string;
  /** Top of the water, px from the top (clamped to the box). */
  waterTop: number;
  /** Height of the water spilling sideways over both banks; 0 while it stays in the channel. */
  overHeight: number;
  /** Where the bank top is, px from the top. */
  ground: number;
}

export function crossSection(diff: number, width: number, height: number): Section {
  const ground = Math.round(height * 0.4);
  const bed = height - 4;
  const k = (bed - ground) / SECTION_DEPTH_M;
  const waterTop = r2(Math.max(2, ground - diff * k));
  const land = [
    [0, ground],
    [width * 0.2, ground],
    [width * 0.36, bed],
    [width * 0.64, bed],
    [width * 0.8, ground],
    [width, ground],
    [width, height],
    [0, height],
  ]
    .map(([x, y]) => `${r2(x)},${r2(y)}`)
    .join(" ");
  return { land, waterTop, overHeight: waterTop < ground ? r2(ground - waterTop) : 0, ground };
}
