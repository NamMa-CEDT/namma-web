// The anonymous web chat: one session id per browser (localStorage), sent with every chat turn and as
// X-Chat-Session when reading the profile, so the ProfilePanel shows what this chat saved. Signing in folds
// that chat into the account (chat_session on POST /api/auth/*). The chat transcript stays per tab.

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
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) return JSON.parse(stored) as string;
  } catch {
    // fall through
  }
  const fallback = load(SESSION_KEY, "");
  if (fallback) return fallback;
  // Keep the new id: pages call this on every render, and a fresh id each time is a fresh profile query each time.
  const id = newId();
  saveSessionId(id);
  return id;
}

export function saveSessionId(id: string): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(id));
  } catch {
    save(SESSION_KEY, id);
  }
}

/** What another page asks the chat to do on arrival (react-router location state). */
export type ChatHandoff = { send?: string; fill?: string; location?: boolean };
