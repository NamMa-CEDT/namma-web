// Mock "database", kept in localStorage so every tab shares it. Every request re-reads it,
// so changes from other tabs show up.
import { MOCK_STORE_KEY as STORE_KEY } from "../client";
import type { RiskTier, SessionUser } from "../types";
import { emptyChatState, type ChatSessionState } from "./chatScript";

export interface MockState {
  /** Demo panel: simulated tier per station id. */
  tierOverrides: Record<string, RiskTier>;
  chats: Record<string, ChatSessionState>;
  sessions: Record<string, SessionUser>;
  /** Session token → account id. Optional: stores saved before it existed lack it. */
  accounts?: Record<string, string>;
}

function seed(): MockState {
  return { tierOverrides: {}, chats: {}, sessions: {} };
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
