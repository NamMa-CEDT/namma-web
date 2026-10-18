// The anonymous web chat: one session id per browser tab (sessionStorage), sent with every chat turn and
// as X-Chat-Session when reading the profile, so the ProfilePanel shows what this chat saved.

const SESSION_KEY = "namma.chat.session";

// crypto.randomUUID needs a secure context; plain-http LAN testing on a phone doesn't have one.
export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto && window.isSecureContext
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore: history just won't survive a reload
  }
}

export function loadSessionId(): string {
  return load(SESSION_KEY, "") || newId();
}

export function saveSessionId(id: string): void {
  save(SESSION_KEY, id);
}

/** What another page asks the chat to do on arrival (react-router location state). */
export type ChatHandoff = { send?: string; fill?: string; location?: boolean };
