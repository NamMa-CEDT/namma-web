import { copy } from "../copy";
import { lineMessageUrl, lineOaId } from "./line";

describe("LINE links", () => {
  it("reads the OA id from an add-friend link, with the @ written either way", () => {
    expect(lineOaId("https://line.me/R/ti/p/@namma")).toBe("@namma");
    expect(lineOaId("https://line.me/R/ti/p/%40namma?from=web")).toBe("@namma");
    expect(lineOaId("https://line.me/R/oaMessage/%40namma/?hi")).toBe("@namma");
    expect(lineOaId("https://example.com/no-id")).toBeNull();
    expect(lineOaId(null)).toBeNull();
  });

  it("opens the OA chat with a station's alert message typed in", () => {
    const text = copy.station.lineAlert.message("C.35", 2609);
    expect(text).toBe("แจ้งเตือนสถานี C.35 #2609");
    const url = lineMessageUrl(text, "https://line.me/R/ti/p/@namma");
    expect(url).toBe(`https://line.me/R/oaMessage/%40namma/?${encodeURIComponent(text)}`);
    expect(decodeURIComponent(new URL(url!).search.slice(1))).toBe(text);
    expect(copy.station.lineAlert.message(null, 7)).toBe("แจ้งเตือนสถานี #7");
  });

  it("gives no link until the OA exists", () => {
    expect(lineMessageUrl("แจ้งเตือนสถานี #7", null)).toBeNull();
  });
});
