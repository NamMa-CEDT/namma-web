// LINE Login through LIFF (LINE Front-end Framework). liff.init() reads the LIFF app id from VITE_LIFF_ID.
// The LINE app gives us the ID token; the backend checks it (POST /api/auth/line). Outside the LINE app,
// liff.login() sends the person to LINE and back to this page.
import liff from "@line/liff";

export const LIFF_ID: string | null = (import.meta.env.VITE_LIFF_ID as string | undefined)?.trim() || null;

// Read before liff.init(), which takes LINE's `code` out of the address bar once it has used it.
const RETURNED_FROM_LINE = /[?&](code|liffClientId)=/.test(window.location.search);

let ready: Promise<boolean> | null = null;

/** liff.init() until it succeeds. False when the build has no LIFF id, so LINE login stays off. A failure is
 *  logged and tried again on the next call instead of failing every LINE button press until a reload. */
export function initLiff(): Promise<boolean> {
  if (!LIFF_ID) return Promise.resolve(false);
  ready ??= liff
    .init({ liffId: LIFF_ID })
    .then(() => true)
    .catch((e: unknown) => {
      console.warn("liff.init failed", e);
      ready = null;
      throw e;
    });
  return ready;
}

/** Inside the LINE app's LIFF browser (opened through liff.line.me), where LIFF signs the person in by itself. */
export function inLineApp(): boolean {
  return liff.isInClient();
}

/** A phone or tablet. iPadOS reports itself as a Mac, so a Mac with a touch screen counts too. */
export function onPhone(): boolean {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Opens this site inside the LINE app, already signed in to LINE. On phones, liff.login() hands the login to the
 *  LINE app and back to the browser, and that handoff fails in the LINE app ("unknown error"); this is the way
 *  LINE expects phone users to sign in. The session then lives in LINE's browser, not the one the person was in.
 *  Must be the href of a link the person taps: phones open the LINE app only for a tapped link. Set from script,
 *  or with no LINE app, liff.line.me just sends the browser back to this site (the endpoint URL). */
export const LIFF_APP_URL = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : null;

/** This page load is LINE sending the browser back after its login page. */
export function returnedFromLine(): boolean {
  return RETURNED_FROM_LINE;
}

/** Where LINE sends the browser back to: this page without its #/route or query. LINE adds `?code=…` to it, and
 *  LIFF reads the code from the query only, so a `#/account` in it lost the code and with it the login. */
export function lineReturnUrl(): string {
  return window.location.origin + window.location.pathname;
}

/** True once LIFF knows the person is signed in to LINE (already in the LINE app, or after liff.login). */
export function lineSignedIn(): boolean {
  return liff.isLoggedIn();
}

/** The LINE ID token, or null when the LIFF app has no `openid` scope. LIFF caches it in localStorage and never
 *  renews it: isLoggedIn() stays true long after the token's `exp` (about an hour), see lineIdTokenFresh(). */
export function lineIdToken(): string | null {
  return liff.getIDToken();
}

/** False when the cached ID token is expired or expires within a minute, so LINE would reject it. */
export function lineIdTokenFresh(): boolean {
  const exp = liff.getDecodedIDToken()?.exp;
  return typeof exp === "number" && exp * 1000 > Date.now() + 60_000;
}

/** Forgets LIFF's cached LINE login (tokens in localStorage). The next sign-in goes to LINE again. */
export function lineLogout(): void {
  if (liff.isLoggedIn()) liff.logout();
}

/** Sends the browser to LINE's login page; it comes back to `redirectUri`. */
export function startLineLogin(redirectUri: string): void {
  liff.login({ redirectUri });
}
