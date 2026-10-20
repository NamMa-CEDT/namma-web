// The signed-in account. Sign in with Google (ID token from Google's button) or LINE (LIFF gives an ID token,
// see lib/liff.ts). Signing in sends this browser's anonymous chat session, so what the person already told
// NamMa joins their account.
import { useSyncExternalStore } from "react";
import { api, API_MODE } from "../api/client";
import type { LoginResponse, Provider, SessionUser } from "../api/types";
import { loadSessionId } from "../lib/chatSession";
import { initLiff, LIFF_ID, lineIdToken, lineSignedIn, startLineLogin } from "../lib/liff";
import { readStoredSession, setToken, writeStoredSession, type StoredSession } from "./token";

let current: StoredSession | null = null;
const listeners = new Set<() => void>();

function set(s: StoredSession | null) {
  current = s;
  setToken(s?.token ?? null);
  writeStoredSession(s);
  listeners.forEach((fn) => fn());
}

/** Must finish before the router mounts (LIFF restores the URL during init). A LIFF failure must not stop the app. */
export async function initSession(): Promise<void> {
  await initLiff().catch(() => false);
  current = readStoredSession();
  setToken(current?.token ?? null);
}

export function getSession(): StoredSession | null {
  return current;
}

export function useSession(): StoredSession | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

// Mock mode always; against the real backend only with VITE_DEMO_LOGIN=1 (the backend must also run
// DEMO_MODE=1). Remove both before the app is public: demo login has no password.
export const canDemoLogin = API_MODE === "mock" || import.meta.env.VITE_DEMO_LOGIN === "1";

function signedIn(res: LoginResponse): LoginResponse {
  set({ token: res.session_token, ...res.user });
  return res;
}

/** Demo LINE login (see canDemoLogin). `name` gives a tester their own account. */
export async function loginDemo(name?: string): Promise<LoginResponse> {
  return signedIn(await api.login(name ? `demo:user:${name}` : "demo:user", loadSessionId()));
}

/** Sign in with a Google ID token (Google's button). Creates the account on first sign-in. */
export async function loginGoogle(idToken: string): Promise<LoginResponse> {
  return signedIn(await api.login(idToken, loadSessionId(), "google"));
}

/** LINE Login works only against the real backend and only when the build has a LIFF id (VITE_LIFF_ID). */
export const canLineLogin = API_MODE === "http" && LIFF_ID !== null;

// Set before the trip to LINE's login page, so the account page can finish the job when the person comes back.
const LINE_PENDING_KEY = "namma.line.pending";
export type LinePending = "login" | "link";

/** What the account page should finish after a LINE round trip, once. */
export function takeLinePending(): LinePending | null {
  try {
    const v = sessionStorage.getItem(LINE_PENDING_KEY);
    sessionStorage.removeItem(LINE_PENDING_KEY);
    return v === "login" || v === "link" ? v : null;
  } catch {
    return null;
  }
}

/** The LINE ID token, or null after sending the browser to LINE (the page is leaving). */
async function lineToken(intent: LinePending): Promise<string | null> {
  await initLiff();
  if (!lineSignedIn()) {
    try {
      sessionStorage.setItem(LINE_PENDING_KEY, intent);
    } catch {
      // Blocked storage: the person presses the button again after coming back.
    }
    startLineLogin(window.location.href);
    return null;
  }
  const token = lineIdToken();
  if (!token) throw new Error("LINE gave no ID token");
  return token;
}

/** Sign in with LINE. Resolves null when the browser is leaving for LINE. */
export async function loginLine(): Promise<LoginResponse | null> {
  const token = await lineToken("login");
  if (!token) return null;
  return signedIn(await api.login(token, loadSessionId(), "line"));
}

/** Add LINE to the signed-in account. Resolves null when the browser is leaving for LINE. */
export async function linkLine(): Promise<SessionUser | null> {
  const token = await lineToken("link");
  if (!token) return null;
  return link("line", token);
}

/** Add a second way to sign in to the signed-in account. */
export async function link(provider: Provider, idToken: string): Promise<SessionUser> {
  const user = await api.link(provider, idToken);
  if (current) set({ ...current, ...user });
  return user;
}

export async function unlink(provider: Provider): Promise<SessionUser> {
  const user = await api.unlink(provider);
  if (current) set({ ...current, ...user });
  return user;
}

/** Ends the session on the server too; signs out locally even if the server can't be reached. */
export async function logout(): Promise<void> {
  try {
    if (current) await api.logout();
  } catch {
    // expired or offline: forgetting the token is what matters
  }
  set(null);
}

/** PDPA erasure of the whole account (DELETE /api/me), then sign out. */
export async function deleteAccount(): Promise<void> {
  await api.deleteMe();
  set(null);
}
