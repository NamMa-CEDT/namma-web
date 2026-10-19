import { cellToLatLng, gridDisk, latLngToCell } from "h3-js";
import type { FloodCell } from "../api/types";
import { distanceToWaterKm, smoothRing, viewBox, waterPatches } from "./water";

const BANG_BAN = latLngToCell(14.41, 100.46, 9);
const FAR = latLngToCell(14.6, 100.6, 9);

function cell(h3: string, p: Partial<FloodCell> = {}): FloodCell {
  return { h3, cells: 1, area_km2: 0.05, share: 0.4, province: "พระนครศรีอยุธยา", amphoe: "บางบาล", tambon: "บางหลวงโดด", observed_at: null, ...p };
}

it("merges touching cells into one patch and keeps apart the ones that don't touch", () => {
  const near = gridDisk(BANG_BAN, 1).map((h) => cell(h, { buildings: 2, population: 5 }));
  const patches = waterPatches([...near, cell(FAR, { area_km2: 0.01, tambon: "อื่น" })]);
  expect(patches).toHaveLength(2);
  const [big, small] = patches;
  expect(big.cells).toHaveLength(7);
  expect(big.polygons).toHaveLength(1);                         // one outline for seven hexagons
  expect(big.area_km2).toBeCloseTo(0.35);
  expect(big.area_rai).toBeCloseTo(218.75);
  expect([big.buildings, big.population, big.tambon]).toEqual([14, 35, "บางหลวงโดด"]);
  expect(small.buildings).toBeNull();                             // not sent: unknown, not 0
});

it("rounds a ring's corners and keeps it closed", () => {
  const square = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
  const once = smoothRing(square, 1);
  expect(once).toHaveLength(9);
  expect(once[0]).toEqual(once[once.length - 1]);
  expect(once[0]).toEqual([0.25, 0]);
});

it("measures the distance from a place to the water", () => {
  const cells = [cell(BANG_BAN)];
  const [lat, lon] = cellToLatLng(BANG_BAN);
  expect(distanceToWaterKm(cells, lat, lon)).toBe(0);
  expect(distanceToWaterKm(cells, lat + 0.02, lon)).toBeGreaterThan(1.8);
  expect(distanceToWaterKm([], lat, lon)).toBeNull();
});

it("snaps the view box outwards so small pans reuse the request", () => {
  expect(viewBox([100.4312, 14.3301, 100.5277, 14.4199])).toBe("100.43,14.33,100.53,14.42");
  expect(viewBox([100.4312, 14.3301, 100.5277, 14.4199])).toBe(viewBox([100.4388, 14.3345, 100.521, 14.415]));
});
