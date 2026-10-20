// LINE Login through LIFF (LINE Front-end Framework). liff.init() reads the LIFF app id from VITE_LIFF_ID.
// The LINE app gives us the ID token; the backend checks it (POST /api/auth/line). Outside the LINE app,
// liff.login() sends the person to LINE and back to this page.
import liff from "@line/liff";

export const LIFF_ID: string | null = (import.meta.env.VITE_LIFF_ID as string | undefined)?.trim() || null;

let ready: Promise<boolean> | null = null;

/** liff.init() once. False when the build has no LIFF id, so LINE login stays off. */
export function initLiff(): Promise<boolean> {
  if (!LIFF_ID) return Promise.resolve(false);
  ready ??= liff.init({ liffId: LIFF_ID }).then(() => true);
  return ready;
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
