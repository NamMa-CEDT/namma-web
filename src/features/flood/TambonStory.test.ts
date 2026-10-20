import { recordSeries } from "./TambonStory";

const row = (day: string, period: "3days" | "7days" | "30days", area_rai: number) =>
  ({ day, period, cells: 1, area_km2: area_rai / 625, area_rai });

it("charts the 7-day layer, a day without a row as no water", () => {
  const record = [row("2026-10-20", "7days", 100), row("2026-10-20", "30days", 900), row("2026-10-22", "7days", 40)];
  expect(recordSeries({ record })).toEqual([
    { day: "2026-10-20", rai: 100 },
    { day: "2026-10-21", rai: 0 },
    { day: "2026-10-22", rai: 40 },
  ]);
});

it("falls back to the 30-day layer, and has nothing to chart without a record", () => {
  expect(recordSeries({ record: [row("2026-10-20", "30days", 5)] })).toEqual([{ day: "2026-10-20", rai: 5 }]);
  expect(recordSeries({ record: [] })).toEqual([]);
});
