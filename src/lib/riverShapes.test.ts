import { crossSection, waterLine } from "./riverShapes";

describe("waterLine (river line chart)", () => {
  // 150 px tall: 8 px top margin, then 7 m over 142 px, so the bank sits 2 m down.
  const bank = 8 + (2 * 142) / 7;

  it("spreads stations evenly, upstream first, and draws only the part over the bank in the danger shape", () => {
    const l = waterLine([-1, 1, -1], 150, 10);
    expect(l.bank).toBeCloseTo(bank, 5);
    expect(l.points.map((p) => p.x)).toEqual([10, 50, 90]);
    expect(l.points.map((p) => p.y)).toEqual([68.86, 28.29, 68.86]);
    expect(l.water.startsWith("M0,150 L0,68.86 L10,68.86 L50,28.29")).toBe(true);
    expect(l.water.endsWith("L100,68.86 L100,150 Z")).toBe(true);
    expect(l.over).toBe("M30,48.57 L50,28.29 L70,48.57 Z");
  });

  it("has nothing over the bank when every station is below it", () => {
    expect(waterLine([-0.5, -3, -0.01], 150).over).toBe("");
  });

  it("closes an over-bank run that reaches the downstream edge", () => {
    expect(waterLine([-1, 1], 150, 10).over).toBe("M50,48.57 L90,28.29 L100,28.29 L100,48.57 Z");
  });

  it("puts readings past the drawn range on its edge", () => {
    expect(waterLine([9, -9], 150).points.map((p) => p.y)).toEqual([8, 150]);
  });

  it("centres a lone station and copes with none", () => {
    expect(waterLine([0], 150).points).toEqual([{ x: 50, y: 48.57 }]);
    expect(waterLine([], 150)).toMatchObject({ water: "", over: "", points: [] });
  });
});

describe("crossSection", () => {
  it("fills the channel to the reading, 5 m under the bank being empty", () => {
    // 60 tall: bank top at 24, bed at 56, so 6.4 px per metre.
    const s = crossSection(-1, 100, 60);
    expect(s.ground).toBe(24);
    expect(s.waterTop).toBeCloseTo(30.4);
    expect(s.overHeight).toBe(0);
    expect(s.land).toBe("0,24 20,24 36,56 64,56 80,24 100,24 100,60 0,60");
  });

  it("spills sideways over both banks when the water is over the bank", () => {
    const s = crossSection(1.5, 100, 60);
    expect(s.waterTop).toBeCloseTo(14.4);
    expect(s.overHeight).toBeCloseTo(9.6);
  });

  it("never draws water above the box", () => {
    expect(crossSection(20, 100, 60).waterTop).toBe(2);
  });
});
