// The signed-in account. Sign in with Google (ID token from Google's button) or LINE (the backend's LINE web login
// in a browser, LIFF's ID token inside the LINE app, see lib/liff.ts). Signing in sends this browser's anonymous chat session, so what the person already told
// NamMa joins their account.
import { useSyncExternalStore } from "react";
import { api, API_MODE } from "../api/client";
import type { LoginResponse, Provider, SessionUser } from "../api/types";
import { loadSessionId } from "../lib/chatSession";
import { initLiff, inLineApp, LIFF_ID, lineIdToken, lineLogout, lineSignedIn } from "../lib/liff";
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
  if (API_MODE === "http") await finishLineWebLogin();
}

// Set by signing out, cleared by signing in: inside the LINE app LIFF signs the person in to LINE again on every
// open, so without it signing out there would last until the next page load.
const LINE_AUTO_OFF_KEY = "namma.line.auto.off";

function setAutoOff(off: boolean) {
  try {
    if (off) localStorage.setItem(LINE_AUTO_OFF_KEY, "1");
    else localStorage.removeItem(LINE_AUTO_OFF_KEY);
  } catch {
    // blocked storage
  }
}

function autoOff(): boolean {
  try {
    return localStorage.getItem(LINE_AUTO_OFF_KEY) === "1";
  } catch {
    return false;
  }
}

/** Opened inside the LINE app (a LIFF link, e.g. from the OA's rich menu) and not signed in to NamMa: sign in with the
 *  LINE login LIFF already has, without a button. Runs after the first render; a failure leaves the button.
 *  True when it signed in. */
export async function autoLineSignIn(): Promise<boolean> {
  if (!canLineLogin || current || autoOff()) return false;
  try {
    if (!(await initLiff()) || !inLineApp() || !lineSignedIn()) return false;
    return (await loginLine()) !== null;
  } catch (e) {
    console.warn("LINE sign-in inside the LINE app failed", e);
    return false;
  }
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
  setAutoOff(false);
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

export type LineIntent = "login" | "link";

/** Inside the LINE app LIFF already has the person's LINE ID token: use it. Elsewhere, the backend's LINE web login
 *  (POST /api/auth/line/start): the browser goes to LINE and LINE sends it back to the backend in this same browser,
 *  which hands the page a one-time claim (finishLineWebLogin). Resolves null when the browser is leaving for LINE. */
async function viaLine<T>(intent: LineIntent, use: (idToken: string) => Promise<T>): Promise<T | null> {
  if ((await initLiff().catch(() => false)) && inLineApp() && lineSignedIn()) {
    const token = lineIdToken();
    if (!token) throw new Error("LINE gave no ID token");
    return use(token);
  }
  const { authorize_url } = await api.lineStart(intent, intent === "login" ? loadSessionId() : undefined);
  window.location.assign(authorize_url);
  return null;
}

/** Sign in with LINE. Resolves null when the browser is leaving for LINE. */
export async function loginLine(): Promise<LoginResponse | null> {
  return viaLine("login", async (token) => signedIn(await api.login(token, loadSessionId(), "line")));
}

/** Add LINE to the signed-in account. Resolves null when the browser is leaving for LINE. */
export async function linkLine(): Promise<SessionUser | null> {
  return viaLine("link", (token) => link("line", token));
}

/** What came of the trip to LINE, for the account page to show once: an error code from the backend's callback
 *  (expired, browser, cancelled, conflict, failed) or that the anonymous chat joined the account. */
export interface LineResult {
  error?: string;
  merged?: boolean;
}
let lineResult: LineResult | null = null;

export function takeLineResult(): LineResult | null {
  const r = lineResult;
  lineResult = null;
  return r;
}

/** Back from LINE web login (/?line_claim=… or /?line_error=…, #/account): exchange the claim for a session and
 *  take both out of the address bar. */
async function finishLineWebLogin(): Promise<void> {
  const q = new URLSearchParams(window.location.search);
  const claim = q.get("line_claim");
  const error = q.get("line_error");
  if (!claim && !error) return;
  window.history.replaceState(null, "", window.location.pathname + (window.location.hash || "#/account"));
  if (error) {
    lineResult = { error };
    return;
  }
  try {
    const res = signedIn(await api.lineClaim(claim!));
    lineResult = { merged: res.merged_chat };
  } catch {
    lineResult = { error: "failed" };
  }
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
  signOutEverywhere();
}

/** Forgets our session and LIFF's cached LINE login, so the next "sign in with LINE" doesn't come back as the
 *  last person who used this browser. */
function signOutEverywhere() {
  setAutoOff(true);
  try {
    lineLogout();
  } catch {
    // LIFF never initialised (no LIFF id, or init failed): nothing cached to forget.
  }
  set(null);
}

/** PDPA erasure of the whole account (DELETE /api/me), then sign out. */
export async function deleteAccount(): Promise<void> {
  await api.deleteMe();
  signOutEverywhere();
}
