import {
  formatAge,
  formatBankGap,
  formatDateTime,
  formatPlace,
  formatDistance,
  formatHoursToBank,
  formatTime,
  formatTrend,
  isStale,
  trendDirection,
} from "./format";

describe("formatBankGap", () => {
  it("applies the sign: + above bank, - below", () => {
    expect(formatBankGap(0.34)).toBe("ล้นตลิ่ง 0.34 ม.");
    expect(formatBankGap(-0.2)).toBe("ต่ำกว่าตลิ่ง 0.20 ม.");
    expect(formatBankGap(0.001)).toBe("ถึงระดับตลิ่ง");
  });
  it("never invents a value", () => {
    expect(formatBankGap(null)).toBe("ไม่ทราบ");
    expect(formatBankGap(undefined)).toBe("ไม่ทราบ");
  });
});

describe("formatTrend", () => {
  it("reads direction with a dead band", () => {
    expect(formatTrend(2.34)).toBe("สูงขึ้น 2.3 ซม./ชม.");
    expect(formatTrend(-0.67)).toBe("ลดลง 0.7 ซม./ชม.");
    expect(formatTrend(0.2)).toBe("ทรงตัว");
    expect(formatTrend(null)).toBe("ไม่ทราบ");
    expect(trendDirection(undefined)).toBe("unknown");
  });
});

describe("formatHoursToBank", () => {
  it("is null when not applicable", () => {
    expect(formatHoursToBank(null)).toBeNull();
    expect(formatHoursToBank(-1)).toBeNull();
  });
  it("rounds and caps", () => {
    expect(formatHoursToBank(0.4)).toBe("ไม่ถึง 1 ชม.");
    expect(formatHoursToBank(4.4)).toBe("ประมาณ 4 ชม.");
    expect(formatHoursToBank(160)).toBe("มากกว่า 3 วัน");
  });
});

describe("time", () => {
  it("shows Bangkok time whatever the offset in the string", () => {
    expect(formatTime("2026-10-16T13:00:00+07:00")).toBe("13:00 น.");
    expect(formatTime("2026-10-16T06:00:00Z")).toBe("13:00 น.");
  });
  it("gives every reading a date with a Buddhist-era year", () => {
    expect(formatDateTime("2026-10-16T11:00:00Z")).toBe("18:00 น. 16 ต.ค. 69");
  });
  it("formats ages", () => {
    const now = Date.parse("2026-10-16T14:00:00+07:00");
    expect(formatAge("2026-10-16T13:55:00+07:00", now)).toBe("5 นาทีที่แล้ว");
    expect(formatAge("2026-10-16T11:00:00+07:00", now)).toBe("3 ชม.ที่แล้ว");
  });
  it("uses per-agency staleness (HII 10-min, RID hourly)", () => {
    const now = Date.parse("2026-10-16T14:00:00+07:00");
    expect(isStale("2026-10-16T13:20:00+07:00", "HII", now)).toBe(true);
    expect(isStale("2026-10-16T13:20:00+07:00", "RID", now)).toBe(false);
    expect(isStale(null, "RID", now)).toBe(true);
  });
});

describe("formatDistance", () => {
  it("switches units", () => {
    expect(formatDistance(0.43)).toBe("450 ม.");
    expect(formatDistance(6.31)).toBe("6.3 กม.");
    expect(formatDistance(23.4)).toBe("23 กม.");
    expect(formatDistance(null)).toBeNull();
  });
});

describe("formatPlace", () => {
  it("writes places the Thai way", () => {
    expect(formatPlace("บางบาล", "พระนครศรีอยุธยา")).toBe("อ.บางบาล จ.พระนครศรีอยุธยา");
    expect(formatPlace("บางพลัด", "กรุงเทพมหานคร")).toBe("เขตบางพลัด กรุงเทพมหานคร");
    expect(formatPlace(null, "ชัยนาท")).toBe("จ.ชัยนาท");
  });
});
