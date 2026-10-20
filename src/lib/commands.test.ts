import { describe, expect, it } from "vitest";
import { COMMANDS, parseCommand, suggestCommands } from "./commands";

describe("parseCommand", () => {
  it("reads a known command, its alias, any case and surrounding spaces", () => {
    expect(parseCommand("/clear")).toEqual({ command: expect.objectContaining({ name: "clear" }) });
    expect(parseCommand("  /NEW ")).toEqual({ command: expect.objectContaining({ name: "clear" }) });
    expect(parseCommand("/location")).toEqual({ command: expect.objectContaining({ name: "location" }) });
  });

  it("treats a bare slash as /help", () => {
    expect(parseCommand("/")).toEqual({ command: expect.objectContaining({ name: "help" }) });
  });

  it("reports a mistyped command instead of sending it", () => {
    expect(parseCommand("/clera")).toEqual({ unknown: "clera" });
  });

  it("leaves ordinary messages alone", () => {
    expect(parseCommand("บ้านอยู่บางบาล")).toBeNull();
    expect(parseCommand("น้ำสูง 1/2 เมตร")).toBeNull();
    expect(parseCommand("/ clear")).toBeNull();
    expect(parseCommand("/clear ทั้งหมด")).toBeNull();
  });
});

describe("suggestCommands", () => {
  it("lists every command for a bare slash and narrows as the person types", () => {
    expect(suggestCommands("/")).toHaveLength(COMMANDS.length);
    expect(suggestCommands("/l").map((c) => c.name)).toEqual(["location", "line", "account"]);
    expect(suggestCommands("/ne").map((c) => c.name)).toEqual(["clear"]);
    expect(suggestCommands("/ho").map((c) => c.name)).toEqual(["home", "family", "house"]);
  });

  it("suggests nothing once it is not a command being typed", () => {
    expect(suggestCommands("")).toEqual([]);
    expect(suggestCommands("/clear ")).toEqual([]);
    expect(suggestCommands("บ้าน /")).toEqual([]);
  });
});
