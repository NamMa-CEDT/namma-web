// The signed-in account. Sign in with Google (ID token from Google's button) or LINE (LIFF gives an ID token,
// see lib/liff.ts). Signing in sends this browser's anonymous chat session, so what the person already told
// NamMa joins their account.
import { useSyncExternalStore } from "react";
import { api, ApiError, API_MODE } from "../api/client";
import type { LoginResponse, Provider, SessionUser } from "../api/types";
import { loadSessionId } from "../lib/chatSession";
import {
  initLiff,
  inLineApp,
  LIFF_APP_URL,
  LIFF_ID,
  lineIdToken,
  lineIdTokenFresh,
  lineLogout,
  lineReturnUrl,
  lineSignedIn,
  onPhone,
  returnedFromLine,
  startLineLogin,
} from "../lib/liff";
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
  // LINE sends the browser back to the bare page (see lineReturnUrl): the account page finishes the sign-in.
  const back = returnedFromLine() || peekFlag(LINE_PENDING_KEY) || peekFlag(LINE_APP_TRIP_KEY, LINE_APP_BOUNCE_MS);
  if (LIFF_ID && back && !window.location.hash.startsWith("#/account")) {
    window.history.replaceState(null, "", "#/account");
  }
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

/** Opened inside the LINE app (the phone sign-in, see LIFF_APP_URL) and not signed in to NamMa: sign in with the
 *  LINE login LIFF already has, without a button. Runs after the first render; a failure leaves the button.
 *  True when it signed in. */
export async function autoLineSignIn(): Promise<boolean> {
  if (!canLineLogin || current || autoOff()) return false;
  try {
    if (!(await initLiff()) || !inLineApp() || !lineSignedIn()) return false;
    return (await loginLine(true)) !== null;
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

// Set before the trip to LINE's login page, so the account page can finish the job when the person comes back.
const LINE_PENDING_KEY = "namma.line.pending";
export type LinePending = "login" | "link";

// Set while coming back from a trip to LINE that renewed a token the backend rejected, so a second rejection
// shows an error instead of going round again.
const LINE_RETRIED_KEY = "namma.line.retried";

// In localStorage, not sessionStorage: on a phone the LINE app often sends the browser back in a new tab.
// Stale after 15 minutes, so a trip abandoned yesterday finishes nothing today.
const FLAG_TTL_MS = 15 * 60_000;

function peekFlag(key: string, ttl = FLAG_TTL_MS): string | null {
  try {
    const { v, at } = JSON.parse(localStorage.getItem(key) ?? "null") ?? {};
    return typeof v === "string" && typeof at === "number" && Date.now() - at < ttl ? v : null;
  } catch {
    return null;
  }
}

function takeFlag(key: string, ttl = FLAG_TTL_MS): string | null {
  const v = peekFlag(key, ttl);
  try {
    localStorage.removeItem(key);
  } catch {
    // blocked storage: nothing was stored
  }
  return v;
}

function putFlag(key: string, v: string): void {
  try {
    localStorage.setItem(key, JSON.stringify({ v, at: Date.now() }));
  } catch {
    // Blocked storage: the person presses the button again after coming back.
  }
}

/** What the account page should finish after a LINE round trip, once. */
export function takeLinePending(): LinePending | null {
  const v = takeFlag(LINE_PENDING_KEY);
  return v === "login" || v === "link" ? v : null;
}

function toLine(intent: LinePending, retried = false): null {
  putFlag(LINE_PENDING_KEY, intent);
  if (retried) putFlag(LINE_RETRIED_KEY, "1");
  startLineLogin(lineReturnUrl());
  return null;
}

// Set when the person taps the link to the LINE app. Seen again in a browser within a minute: the phone didn't open
// the LINE app (none installed, or iOS set to open liff.line.me in Safari) and liff.line.me sent the browser back.
const LINE_APP_TRIP_KEY = "namma.line.app";
const LINE_APP_BOUNCE_MS = 60_000;

/** Sign in on a phone browser through the LINE app (a link to LIFF_APP_URL), where the app signs in by itself
 *  (autoLineSignIn). Not for linking: the LINE app's browser doesn't have this browser's session. */
export function lineViaApp(): boolean {
  return canLineLogin && LIFF_APP_URL !== null && onPhone() && !inLineApp();
}

/** Call from the link's click; the link itself does the navigation. */
export function markLineAppTrip(): void {
  putFlag(LINE_APP_TRIP_KEY, "1");
}

let bounce: boolean | null = null;

/** liff.line.me just sent this browser back instead of opening the LINE app. Read once per page load (the same
 *  answer for every caller, so StrictMode's double render doesn't lose it). */
export function takeLineAppBounce(): boolean {
  bounce ??= takeFlag(LINE_APP_TRIP_KEY, LINE_APP_BOUNCE_MS) === "1" && !inLineApp();
  return bounce;
}

/** LINE sent the browser back, but LIFF isn't signed in: LINE's login was finished in another browser (the LINE
 *  app opened the link elsewhere) or LINE refused the code. Shown, so the person isn't left wondering. */
export class LineReturnError extends Error {
  constructor() {
    super("LINE sent the browser back without a login");
    this.name = "LineReturnError";
  }
}

/** The LINE ID token, or null after sending the browser to LINE (the page is leaving). LIFF keeps the last
 *  ID token after it expires, so an old one sends the person through LINE again for a new one. `resume` (back from
 *  LINE, nothing pressed) never leaves the page: null when LINE didn't finish (cancelled, or an error page). */
async function lineToken(intent: LinePending, resume: boolean): Promise<string | null> {
  await initLiff();
  if (lineSignedIn() && lineIdToken() && !lineIdTokenFresh()) lineLogout();
  if (!lineSignedIn()) {
    if (!resume) return toLine(intent);
    if (returnedFromLine()) throw new LineReturnError();
    return null;
  }
  const token = lineIdToken();
  if (!token) throw new Error("LINE gave no ID token");
  return token;
}

/** Runs `use` with a LINE ID token. When the backend rejects the token (expired by its clock, or from another
 *  LINE account cached in this browser), forgets it and goes to LINE once for a new one, only from a button press. */
async function withLineToken<T>(intent: LinePending, resume: boolean, use: (token: string) => Promise<T>): Promise<T | null> {
  const retried = takeFlag(LINE_RETRIED_KEY) === "1";
  const token = await lineToken(intent, resume);
  if (!token) return null;
  try {
    return await use(token);
  } catch (e) {
    if (resume || retried || !(e instanceof ApiError && e.status === 401 && e.code === "invalid_token")) throw e;
    lineLogout();
    return toLine(intent, true);
  }
}

/** Sign in with LINE. Resolves null when the browser is leaving for LINE, or, with `resume` (finishing after the
 *  trip to LINE), when LINE didn't sign the person in. */
export async function loginLine(resume = false): Promise<LoginResponse | null> {
  return withLineToken("login", resume, async (token) => signedIn(await api.login(token, loadSessionId(), "line")));
}

/** Add LINE to the signed-in account. Resolves null as loginLine does. */
export async function linkLine(resume = false): Promise<SessionUser | null> {
  return withLineToken("link", resume, (token) => link("line", token));
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
