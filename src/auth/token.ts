// Session token storage, shared by the API client and the session module (no import cycle).
const KEY = "namma.session";

export interface StoredSession {
  token: string;
  display_name: string;
  picture_url: string | null;
  identities?: { line: boolean; google: string | null };
}

export function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function writeStoredSession(s: StoredSession | null): void {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the session lasts until reload.
  }
}

let memoryToken: string | null = null;

export function getToken(): string | null {
  return memoryToken ?? readStoredSession()?.token ?? null;
}

export function setToken(token: string | null): void {
  memoryToken = token;
}
