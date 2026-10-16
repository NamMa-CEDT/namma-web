import type { Reading, TicketSummary } from "../api/types";
import { sortTickets } from "./dashboard/DashboardPage";
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

it("sorts tickets by urgency, then longest waiting", () => {
  const t = (id: number, urgency: TicketSummary["urgency"], created_at: string) =>
    ({ id, urgency, created_at }) as TicketSummary;
  const sorted = sortTickets([
    t(1, "normal", "2026-10-16T08:00:00+07:00"),
    t(2, "critical", "2026-10-16T10:00:00+07:00"),
    t(3, "critical", "2026-10-16T09:00:00+07:00"),
    t(4, "high", "2026-10-16T07:00:00+07:00"),
  ]);
  expect(sorted.map((x) => x.id)).toEqual([3, 2, 4, 1]);
});
