import type { Reading } from "../api/types";
import { withGaps } from "./map/LevelChart";

const r = (ts: string, level: number): Reading => ({ ts, level_msl: level, diff_wl_bank: null, discharge: null });

it("breaks the level line across missing readings", () => {
  const pts = withGaps([
    r("2026-10-16T00:00:00+07:00", 4),
    r("2026-10-16T01:00:00+07:00", 4.1),
    r("2026-10-16T02:00:00+07:00", 4.2),
    r("2026-10-16T09:00:00+07:00", 4.6),
  ]);
  expect(pts.map((p) => p.level)).toEqual([4, 4.1, 4.2, null, 4.6]);
});
