// Mock "database", kept in localStorage so a chat tab and a dashboard tab share it
// (rehearses demo step 4). Every request re-reads it, so changes from other tabs show up.
import { MOCK_STORE_KEY as STORE_KEY } from "../client";
import type { RescueTicket, RiskTier, SessionUser } from "../types";
import { emptyChatState, type ChatSessionState } from "./chatScript";
import ticketsFx from "./fixtures/tickets.json";
import { toBangkokIso } from "./geo";

export interface MockState {
  tickets: RescueTicket[];
  nextTicketId: number;
  /** Demo panel: simulated tier per station id. */
  tierOverrides: Record<string, RiskTier>;
  chats: Record<string, ChatSessionState>;
  sessions: Record<string, SessionUser>;
}

type FixtureTicket = Omit<RescueTicket, "id" | "created_at" | "updated_at" | "assignee" | "notes"> & {
  minutes_ago: number;
  assignee?: string | null;
};

function seed(now = Date.now()): MockState {
  const fixtures = ticketsFx.tickets as FixtureTicket[];
  const tickets = fixtures.map(({ minutes_ago, ...t }, i): RescueTicket => {
    const created = now - minutes_ago * 60_000;
    return {
      ...t,
      id: 1041 + i,
      assignee: t.assignee ?? null,
      notes: null,
      created_at: toBangkokIso(created),
      updated_at: toBangkokIso(t.status === "open" ? created : created + 5 * 60_000),
    };
  });
  return { tickets, nextTicketId: 1041 + tickets.length, tierOverrides: {}, chats: {}, sessions: {} };
}

let memory: MockState | null = null;

export function loadState(): MockState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as MockState;
  } catch {
    // fall through to memory
  }
  memory ??= seed();
  return memory;
}

export function saveState(s: MockState): void {
  memory = s;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    // storage blocked: keep in memory only
  }
}

/** Load, mutate, save. Returns the saved state. */
export function updateState(fn: (s: MockState) => void): MockState {
  const s = loadState();
  fn(s);
  saveState(s);
  return s;
}

export function resetState(): void {
  memory = null;
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
  saveState(seed());
}

export function chatState(s: MockState, sessionId: string): ChatSessionState {
  s.chats[sessionId] ??= emptyChatState();
  return s.chats[sessionId];
}
