import { areaName, floodClass, formatKm2, formatRai, historyClass, placeName, shareWords, worstYear } from "./flood";

it("shades an area by how much of it is under water", () => {
  expect([0, 0.001, 0.049, 0.05, 0.24, 0.25, 0.9].map(floodClass)).toEqual(["none", "few", "few", "some", "some", "many", "many"]);
});

it("says the share the way people say it", () => {
  expect(shareWords(0.5, "ตำบล")).toBe("ราวครึ่งตำบล");
  expect(shareWords(0.34, "ตำบล")).toBe("ราว 1 ใน 3 ของตำบล");
  expect(shareWords(0.95, "ตำบล")).toBe("เกือบทั้งตำบล");
  expect(shareWords(0.01, "จังหวัด")).toBe("ส่วนน้อยของจังหวัด");
  expect(shareWords(0, "ตำบล")).toBe("");
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
  expect(placeName(a)).toBe("ต.บ้านกุ่ม อ.บางบาล จ.พระนครศรีอยุธยา");
  expect(placeName({ province: "อ่างทอง", amphoe: null, tambon: null })).toBe("จ.อ่างทอง");
});

test("history layer: a year by its flooded share, all years by how often (tambons) or the worst year (provinces)", () => {
  const h = { code: "140501", province: "พระนครศรีอยุธยา", amphoe: "บางบาล", tambon: "บางบาล",
    years: [2011, 2012, 2013, 2017, 2024], rai_by_year: { "2011": 3000, "2012": 100, "2013": 50, "2017": 900, "2024": 10 } };
  // 6.11 km² = ~3,819 rai: 2011 flooded ~79% of it, 2012 ~3%.
  expect(historyClass(h, 6.11, 2011, "tambon")).toBe("many");
  expect(historyClass(h, 6.11, 2012, "tambon")).toBe("few");
  expect(historyClass(h, 6.11, 2017, "tambon")).toBe("some");                              // 900 rai: ~24%
  expect(historyClass(h, 6.11, 2015, "tambon")).toBe("none");
  expect(historyClass(h, 6.11, null, "tambon")).toBe("many");                              // 5 years
  expect(historyClass({ ...h, years: [2011] }, 6.11, null, "tambon")).toBe("few");
  expect(historyClass(undefined, 6.11, null, "tambon")).toBe("none");
  expect(worstYear(h)).toEqual({ year: 2011, rai: 3000 });
  expect(historyClass(h, 2500, null, "province")).toBe("few");                            // worst year: 3,000 rai of 2,500 km²
});
