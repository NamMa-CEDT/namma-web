import type { Profile, River, StationSummary } from "../api/types";
import { fromApi, staffFill } from "../components/RiverProfile";
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

  const river = (p: Partial<River>): River => ({
    key: "แม่น้ำยม", name_th: "แม่น้ำยม", basins: [], provinces: [], worst_tier: null, reason: "largest",
    distance_km: null, stations: [st({ id: 1 }), st({ id: 2, latest: null }), st({ id: 3 })], ...p,
  });

  it("keeps the server's order, drops stations without a reading and rivers left empty", () => {
    const out = fromApi([river({}), river({ key: "คลองใหญ่@7", name_th: "คลองใหญ่", stations: [st({ latest: null })] })]);
    expect(out.map((r) => [r.key, r.name, r.stations.map((s) => s.id)])).toEqual([["แม่น้ำยม", "แม่น้ำยม", [1, 3]]]);
  });

  it("says why a river is shown", () => {
    const [atRisk, near, plain] = fromApi([
      river({ reason: "at_risk", worst_tier: "danger" }),
      river({ key: "b", reason: "near_you", distance_km: 1.5 }),
      river({ key: "c", reason: "largest" }),
    ]);
    expect(atRisk.note).toBe("มีสถานีล้นตลิ่ง");
    expect(near.note).toBe("ใกล้ที่ที่คุณบันทึกไว้ 1.5 กม.");
    expect(plain.note).toBeNull();
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
