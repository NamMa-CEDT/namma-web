// Signing out leaves nothing of the person in this browser: no chat transcript, a new anonymous chat id.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@line/liff", () => ({ default: { isLoggedIn: () => false, logout: vi.fn() } }));
const api = vi.hoisted(() => ({
  login: vi.fn(async () => ({ session_token: "s", user: { display_name: "น้ำ", picture_url: null } })),
  logout: vi.fn(async () => undefined),
  deleteMe: vi.fn(async () => undefined),
}));
vi.mock("../api/client", () => ({ api, API_MODE: "mock", onInvalidToken: () => {} }));

import { CHAT_ITEMS_KEY, loadSessionId } from "../lib/chatSession";
import { deleteAccount, getSession, loginDemo, logout } from "./session";
import { SESSION_KEY } from "./token";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

async function signedInWithChat() {
  await loginDemo();
  sessionStorage.setItem(CHAT_ITEMS_KEY, JSON.stringify([{ id: "1", role: "user", text: "บ้านแม่อยู่บางระกำ" }]));
  return loadSessionId();
}

describe("signing out", () => {
  it("forgets the chat transcript and starts a new anonymous chat", async () => {
    const before = await signedInWithChat();

    await logout();

    expect(getSession()).toBeNull();
    expect(sessionStorage.getItem(CHAT_ITEMS_KEY)).toBeNull();
    expect(loadSessionId()).not.toBe(before);
  });

  it("deleting the account does the same", async () => {
    const before = await signedInWithChat();

    await deleteAccount();

    expect(sessionStorage.getItem(CHAT_ITEMS_KEY)).toBeNull();
    expect(loadSessionId()).not.toBe(before);
  });

  it("follows a sign-out in another tab", async () => {
    const before = await signedInWithChat();

    localStorage.removeItem(SESSION_KEY); // what the other tab did
    window.dispatchEvent(new StorageEvent("storage", { key: SESSION_KEY, newValue: null }));

    expect(getSession()).toBeNull();
    expect(sessionStorage.getItem(CHAT_ITEMS_KEY)).toBeNull();
    expect(loadSessionId()).not.toBe(before);
  });
});
