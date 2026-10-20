// LIFF (LINE Front-end Framework), for inside the LINE app only: there LIFF has the person's LINE ID token and the
// backend checks it (POST /api/auth/line). In a browser, LINE login is the backend's LINE web login (auth/session.ts):
// liff.login() lost the login on phones. liff.init() reads the LIFF app id from VITE_LIFF_ID.
import liff from "@line/liff";

export const LIFF_ID: string | null = (import.meta.env.VITE_LIFF_ID as string | undefined)?.trim() || null;

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

/** Inside the LINE app's LIFF browser (a liff.line.me link), where LIFF signs the person in by itself. */
export function inLineApp(): boolean {
  return liff.isInClient();
}

/** True once LIFF knows the person is signed in to LINE (always, inside the LINE app). */
export function lineSignedIn(): boolean {
  return liff.isLoggedIn();
}

/** The LINE ID token, or null when the LIFF app has no `openid` scope. Fresh on every open inside the LINE app. */
export function lineIdToken(): string | null {
  return liff.getIDToken();
}

/** Forgets LIFF's LINE login (its tokens in storage). */
export function lineLogout(): void {
  if (liff.isLoggedIn()) liff.logout();
}
