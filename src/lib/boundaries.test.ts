import type { FloodArea } from "../api/types";
import { containsPoint, joinAreas, nameKey, provincesInView, type AreaShape } from "./boundaries";

function square(code: string, names: Partial<AreaShape["properties"]>, [w, s, e, n]: number[], hole?: number[]): AreaShape {
  const ring = (a: number[]) => [
    [a[0], a[1]],
    [a[2], a[1]],
    [a[2], a[3]],
    [a[0], a[3]],
    [a[0], a[1]],
  ];
  return {
    type: "Feature",
    properties: {
      code,
      province: "พระนครศรีอยุธยา",
      amphoe: null,
      tambon: null,
      area_km2: 10,
      label: [(s + n) / 2, (w + e) / 2],
      bbox: [w, s, e, n],
      ...names,
    },
    geometry: { type: "Polygon", coordinates: hole ? [ring([w, s, e, n]), ring(hole)] : [ring([w, s, e, n])] },
  };
}

function row(p: Partial<FloodArea>): FloodArea {
  return { province: null, amphoe: null, tambon: null, code: null, cells: 1, area_km2: 1, area_rai: 625, lat: null, lon: null, ...p };
}

it("compares names without prefixes or spaces", () => {
  expect(nameKey("จังหวัดอ่างทอง")).toBe(nameKey("อ่างทอง"));
  expect(nameKey("พระนครศรีอยุธยา", "อำเภอ บางบาล", "ต.บ้านกุ่ม")).toBe("พระนครศรีอยุธยา|บางบาล|บ้านกุ่ม");
});

it("joins GISTDA's totals to tambon shapes by code, else by name", () => {
  const shapes = [
    square("140504", { amphoe: "บางบาล", tambon: "บางหลวงโดด" }, [100.4, 14.4, 100.5, 14.5]),
    square("140501", { amphoe: "บางบาล", tambon: "บ้านกุ่ม" }, [100.5, 14.4, 100.6, 14.5]),
    square("140601", { amphoe: "เสนา", tambon: "บ้านแพน" }, [100.3, 14.3, 100.4, 14.4]),
  ];
  const byCode = row({ code: "140504", area_km2: 3 });
  const byName = row({ province: "พระนครศรีอยุธยา", amphoe: "อำเภอบางบาล", tambon: "ตำบลบ้านกุ่ม", area_km2: 2 });
  const joined = joinAreas(shapes, [byCode, byName], "tambon");
  expect(joined.get("140504")).toBe(byCode);
  expect(joined.get("140501")).toBe(byName);
  expect(joined.has("140601")).toBe(false);
});

it("finds the provinces in view, nearest the centre first", () => {
  const a = square("14", {}, [100, 14, 101, 15]);
  const b = square("15", { province: "อ่างทอง" }, [100.2, 14.5, 100.6, 15]);
  const far = square("50", { province: "เชียงใหม่" }, [98, 18, 99.5, 20]);
  expect(provincesInView([far, a, b], [100.3, 14.6, 100.5, 14.8], 5).map((p) => p.properties.code)).toEqual(["15", "14"]);
  expect(provincesInView([far, a, b], [100.3, 14.6, 100.5, 14.8], 1)).toHaveLength(1);
});

it("knows whether a saved place is inside a tambon, holes included", () => {
  const t = square("140501", {}, [100, 14, 101, 15], [100.4, 14.4, 100.6, 14.6]);
  expect(containsPoint(t, 14.2, 100.2)).toBe(true);
  expect(containsPoint(t, 14.5, 100.5)).toBe(false);
  expect(containsPoint(t, 16, 100.5)).toBe(false);
});
