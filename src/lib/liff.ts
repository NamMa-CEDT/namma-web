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
