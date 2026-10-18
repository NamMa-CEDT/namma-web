// Google Sign-In (Google Identity Services): renders Google's own button and hands back an ID token,
// which the backend verifies (POST /api/auth/google). No redirect, no client secret in the browser.
export const GOOGLE_CLIENT_ID: string | null = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || null;

type Gis = {
  accounts: {
    id: {
      initialize(o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: "popup" }): void;
      renderButton(el: HTMLElement, o: Record<string, string | number>): void;
    };
  };
};

let loading: Promise<Gis> | null = null;

function loadGis(): Promise<Gis> {
  loading ??= new Promise<Gis>((resolve, reject) => {
    const w = window as unknown as { google?: Gis };
    if (w.google?.accounts?.id) return resolve(w.google);
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google ? resolve(w.google) : reject(new Error("Google Sign-In did not load")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Google Sign-In did not load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Draw Google's sign-in button in `el`; `onToken` gets the ID token after the person picks an account. */
export async function renderGoogleButton(el: HTMLElement, onToken: (idToken: string) => void, width = 320): Promise<void> {
  if (!GOOGLE_CLIENT_ID) throw new Error("VITE_GOOGLE_CLIENT_ID is not set");
  const g = await loadGis();
  g.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => onToken(r.credential), ux_mode: "popup" });
  g.accounts.id.renderButton(el, { theme: "outline", size: "large", text: "signin_with", shape: "rectangular", locale: "th", width });
}
