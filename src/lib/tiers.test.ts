import { copy } from "../copy";
import { stationTier, tierInfo, TIER_ORDER } from "./tiers";

it("treats a station without a risk row as unknown, not normal", () => {
  expect(stationTier({ risk: null })).toBe("unknown");
});

it("orders tiers by severity", () => {
  expect(TIER_ORDER.map((t) => tierInfo(t).rank)).toEqual([3, 2, 1, 0, -1]);
});

it("never calls anything safe (CLAUDE.md §2 rule 3)", () => {
  const all = JSON.stringify(copy);
  expect(all).not.toContain("ปลอดภัย");
});
