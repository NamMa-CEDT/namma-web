// Session stub. Day 5: initSession() runs liff.init() and exchanges liff.getIDToken()
// through api.login(); the rest of the app only uses this module's surface.
import { useSyncExternalStore } from "react";
import { api, API_MODE } from "../api/client";
import type { Role } from "../api/types";
import { readStoredSession, setToken, writeStoredSession, type StoredSession } from "./token";

let current: StoredSession | null = null;
const listeners = new Set<() => void>();

function set(s: StoredSession | null) {
  current = s;
  setToken(s?.token ?? null);
  writeStoredSession(s);
  listeners.forEach((fn) => fn());
}

/** Must finish before the router mounts (LIFF restores the URL during init). */
export async function initSession(): Promise<void> {
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

/** Demo login as a demo user or responder (see canDemoLogin). */
export async function loginDemo(role: Role): Promise<void> {
  const res = await api.login(`demo:${role}`);
  set({ token: res.session_token, ...res.user });
}

export function logout(): void {
  set(null);
}
