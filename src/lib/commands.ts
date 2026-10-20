// Slash commands in the web chat. Handled here in the browser and never sent to the backend.

export type CommandName =
  | "help"
  | "clear"
  | "location"
  | "memory"
  | "forget"
  | "home"
  | "family"
  | "house"
  | "shelter"
  | "sos"
  | "map"
  | "flood"
  | "line"
  | "account";

export type Command = { name: CommandName; aliases: string[] };

// Menu order: the chat itself, what NamMa remembers, things to ask, then other pages.
export const COMMANDS: Command[] = [
  { name: "help", aliases: [] },
  { name: "clear", aliases: ["new"] },
  { name: "location", aliases: [] },
  { name: "memory", aliases: ["profile"] },
  { name: "forget", aliases: [] },
  { name: "home", aliases: ["place"] },
  { name: "family", aliases: ["household"] },
  { name: "house", aliases: [] },
  { name: "shelter", aliases: [] },
  { name: "sos", aliases: [] },
  { name: "map", aliases: ["stations"] },
  { name: "flood", aliases: [] },
  { name: "line", aliases: [] },
  { name: "account", aliases: ["login"] },
];

/**
 * What the composer holds, read as a command. A message that starts with "/" and a word is a command attempt,
 * so "/clear" runs and "/clera" is reported as unknown instead of going to NamMa. A bare "/" is /help. Anything
 * else ("1/2", "/clear ทั้งหมด") is an ordinary message: null.
 */
export function parseCommand(text: string): { command: Command } | { unknown: string } | null {
  const m = /^\/([a-z]*)$/i.exec(text.trim());
  if (!m) return null;
  const word = m[1].toLowerCase() || "help";
  const command = COMMANDS.find((c) => c.name === word || c.aliases.includes(word));
  return command ? { command } : { unknown: word };
}

/** Commands to suggest while the person is typing one ("/" or "/cl"); empty once it is not a command. */
export function suggestCommands(text: string): Command[] {
  const m = /^\/([a-z]*)$/i.exec(text);
  if (!m) return [];
  const typed = m[1].toLowerCase();
  return COMMANDS.filter((c) => c.name.startsWith(typed) || c.aliases.some((a) => a.startsWith(typed)));
}
