import { floodMapLink, readFloodFocus, stationMapLink } from "./floodLink";

it("round-trips a chat place through the /flood URL", () => {
  const place = { label: "บ้านแม่ อ.บางบาล จ.พระนครศรีอยุธยา", lat: 14.369, lon: 100.474, approx: true };
  const link = floodMapLink(place);
  expect(link.startsWith("/flood?")).toBe(true);
  expect(readFloodFocus(new URLSearchParams(link.split("?")[1]))).toEqual(place);
});

it("leaves approx out for a GPS share", () => {
  const link = floodMapLink({ label: "บ้าน", lat: 14.41, lon: 100.46, approx: false });
  expect(link).not.toContain("approx");
  expect(readFloodFocus(new URLSearchParams(link.split("?")[1]))?.approx).toBe(false);
});

it("ignores a missing or broken point", () => {
  expect(readFloodFocus(new URLSearchParams("province=อยุธยา"))).toBeNull();
  expect(readFloodFocus(new URLSearchParams("lat=abc&lon=100"))).toBeNull();
  expect(readFloodFocus(new URLSearchParams("lat=14&lon=999"))).toBeNull();
});

it("links the station map with the same point", () => {
  const place = { lat: 14.12345, lon: 100.54321, label: "บ้านแม่", approx: true };
  const link = stationMapLink(place);
  expect(link.startsWith("/map?")).toBe(true);
  expect(readFloodFocus(new URLSearchParams(link.split("?")[1]))).toEqual(place);
});
