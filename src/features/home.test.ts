import type { Profile, StationSummary } from "../api/types";
import { riverGroups, staffFill } from "../components/RiverProfile";
import { setupSteps } from "./chat/ProfilePanel";

function st(p: Partial<StationSummary>): StationSummary {
  return {
    id: 1, oldcode: "X", name_th: "x", name_en: null, lat: 14, lon: 100, river: "แม่น้ำเจ้าพระยา", province: null,
    amphoe: null, agency: "RID", is_key_station: true, stem_order: null, role: "main",
    latest: { ts: "2026-10-18T10:00:00+07:00", level_msl: 5, diff_wl_bank: -1, situation_level: null, discharge: null },
    risk: null, ...p,
  } as StationSummary;
}

describe("RiverProfile", () => {
  it("maps 4 m below bank → 0, the bank → 66.7, 2 m over → 100, clamped", () => {
    expect(staffFill(-4)).toBe(0);
    expect(staffFill(0)).toBeCloseTo(66.667, 2);
    expect(staffFill(2)).toBe(100);
    expect(staffFill(-9)).toBe(0);
    expect(staffFill(5)).toBe(100);
  });

  it("orders the main stem upstream first and keeps branches in their own group, north first", () => {
    const groups = riverGroups([
      st({ id: 3, oldcode: "C.35", stem_order: 10, lat: 14.3691, lon: 100.5768 }),
      st({ id: 7, oldcode: "CPY001", agency: "HII", stem_order: 1, lat: 15.6885, lon: 100.1238 }),
      st({ id: 2, oldcode: "C.2", stem_order: 1, lat: 15.6706, lon: 100.1124 }),
      st({ id: 10, oldcode: "CPY011", agency: "HII", stem_order: 11, lat: 14.3691, lon: 100.5769 }),
      st({ id: 8, oldcode: "CPY002", agency: "HII", stem_order: 2, lat: 15.4266, lon: 100.1495 }),
      st({ id: 9, oldcode: "CPY012", agency: "HII", stem_order: 12, lat: 14.3046, lon: 100.5774 }),
      st({ id: 4, oldcode: "C.37", role: "branch", river: "คลองบางบาล", lat: 14.3 }),
      st({ id: 5, oldcode: "C.36", role: "branch", river: "แม่น้ำน้อย", lat: 14.5 }),
      st({ id: 6, oldcode: "C.99", stem_order: 3, latest: null }),
    ]);
    // HII fills the places RID doesn't gauge; where both gauge one place (C.2 / CPY001, C.35 / CPY011) RID stays.
    expect(groups.map((g) => g.stations.map((s) => s.oldcode))).toEqual([
      ["C.2", "CPY002", "C.35", "CPY012"],
      ["C.36", "C.37"],
    ]);
    expect(groups[1].name).toBe("แม่น้ำน้อย และ คลองบางบาล");
  });
});

describe("ProfilePanel meter", () => {
  const base: Profile = {
    places: [], facts: [], consent: { granted: false, ts: null }, pending_consent: false, line_linked: false,
  };
  it("follows place → household → consent → LINE", () => {
    expect(setupSteps(base).map((s) => s.done)).toEqual([false, false, false, false]);
    const withPlace = { ...base, places: [{ id: 1 } as Profile["places"][number]] };
    expect(setupSteps(withPlace).map((s) => s.done)).toEqual([true, false, false, false]);
    const consented: Profile = {
      ...withPlace,
      facts: [{ kind: "household", text: "ยาย", sensitive: true }],
      consent: { granted: true, ts: "2026-10-18T10:00:00+07:00" },
    };
    expect(setupSteps(consented).map((s) => s.done)).toEqual([true, true, true, false]);
  });
});
