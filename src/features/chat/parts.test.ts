import { replyParts } from "./parts";

describe("replyParts", () => {
  it("turns bullet runs into lists, with the line before each list as its label", () => {
    expect(
      replyParts(["ตอนโทร แจ้งว่า:", "• ตำแหน่ง: บ้าน", "• ผู้ที่ต้องช่วย: ยาย", "ระหว่างรอ:", "• ขึ้นที่สูง", "โทร 1784 ซ้ำได้"]),
    ).toEqual([
      { kind: "label", text: "ตอนโทร แจ้งว่า:" },
      { kind: "list", items: ["ตำแหน่ง: บ้าน", "ผู้ที่ต้องช่วย: ยาย"] },
      { kind: "label", text: "ระหว่างรอ:" },
      { kind: "list", items: ["ขึ้นที่สูง"] },
      { kind: "line", text: "โทร 1784 ซ้ำได้" },
    ]);
  });

  it("leaves a bullet that is not at the start of a line as text", () => {
    expect(replyParts(['• "มีสุนัข" • "มีรถยนต์"', "ข้อมูลสุขภาพจะขออนุญาตก่อน"])).toEqual([
      { kind: "list", items: ['"มีสุนัข" • "มีรถยนต์"'] },
      { kind: "line", text: "ข้อมูลสุขภาพจะขออนุญาตก่อน" },
    ]);
  });
});
