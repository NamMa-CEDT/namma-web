import { areaName, cellOpacity, cellPlace, formatKm2, formatRai, resForZoom, viewBox } from "./flood";

it("asks for coarser cells when zoomed out", () => {
  expect([5, 7, 8, 9, 10, 11, 12, 13, 16].map(resForZoom)).toEqual([5, 5, 6, 6, 7, 8, 8, 9, 9]);
});

it("widens the view box outwards to a grid, so small pans reuse the same request", () => {
  expect(viewBox(100.4312, 14.3301, 100.5277, 14.4199, 9)).toBe("100.43,14.33,100.53,14.42");
  expect(viewBox(100.4312, 14.3301, 100.5277, 14.4199, 9)).toBe(viewBox(100.4388, 14.3345, 100.521, 14.415, 9));
  expect(viewBox(99.1, 13.2, 101.7, 15.9, 5)).toBe("99,13,102,16");
  expect(viewBox(-200, -89, 200, 89, 5)).toBe("-180,-85,180,85");
});

it("shows a sliver of flooding but makes a full cell stronger", () => {
  expect(cellOpacity(0)).toBeCloseTo(0.35);
  expect(cellOpacity(0.25)).toBeCloseTo(0.6);
  expect(cellOpacity(1)).toBeCloseTo(0.85);
  expect(cellOpacity(7)).toBeCloseTo(0.85);
});

it("states area in rai and km²", () => {
  expect(formatRai(75875.4)).toBe("75,875 ไร่");
  expect(formatKm2(0.4213)).toBe("0.42 ตร.กม.");
  expect(formatKm2(121.44)).toBe("121.4 ตร.กม.");
});

it("names areas the Thai way, Bangkok included", () => {
  const a = { province: "พระนครศรีอยุธยา", amphoe: "บางบาล", tambon: "บ้านกุ่ม", code: "140501" };
  expect(areaName(a, "province")).toBe("จ.พระนครศรีอยุธยา");
  expect(areaName(a, "amphoe")).toBe("อ.บางบาล");
  expect(areaName(a, "tambon")).toBe("ต.บ้านกุ่ม");
  const bkk = { province: "กรุงเทพมหานคร", amphoe: "ดุสิต", tambon: "สามเสนใน", code: null };
  expect([areaName(bkk, "province"), areaName(bkk, "amphoe"), areaName(bkk, "tambon")]).toEqual([
    "กรุงเทพมหานคร",
    "เขตดุสิต",
    "แขวงสามเสนใน",
  ]);
  expect(areaName({ province: null, amphoe: null, tambon: null, code: "14" }, "province")).toBe("รหัสพื้นที่ 14");
  expect(areaName({ ...a, tambon: null, code: null }, "tambon")).toBe("ไม่ระบุตำบล");
  expect(cellPlace(a)).toBe("ต.บ้านกุ่ม อ.บางบาล จ.พระนครศรีอยุธยา");
  expect(cellPlace({ province: "อ่างทอง", amphoe: null, tambon: null })).toBe("จ.อ่างทอง");
});
