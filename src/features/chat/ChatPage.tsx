import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { ChatRequest, ChatResponse, QuickReply } from "../../api/types";
import { LocateIcon, SendIcon } from "../../components/icons";
import { copy } from "../../copy";
import { looksLikeEmergency } from "../../lib/danger";
import { getCurrentPosition } from "../../lib/geolocation";
import { EmergencyCard, QuickReplies, SourceChip, TypingBubble } from "./parts";

type Item =
  | { id: string; role: "user"; text: string; request: Omit<ChatRequest, "session_id">; failed?: boolean }
  | { id: string; role: "assistant"; response: ChatResponse };

const SESSION_KEY = "namma.chat.session";
const ITEMS_KEY = "namma.chat.items";

// crypto.randomUUID needs a secure context; plain-http LAN testing on a phone doesn't have one.
function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto && window.isSecureContext
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** One 1784 card per emergency exchange, not one per reply. */
function previousWasEmergency(items: Item[], index: number): boolean {
  for (let j = index - 1; j >= 0; j--) {
    const prev = items[j];
    if (prev.role === "assistant") return prev.response.emergency;
  }
  return false;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore: history just won't survive a reload
  }
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState(() => load(SESSION_KEY, "") || newId());
  const [items, setItems] = useState<Item[]>(() => load(ITEMS_KEY, []));
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Block bodies: effects must return nothing (newer Chromium's scrollIntoView returns a Promise,
  // which React would then call as a cleanup).
  useEffect(() => {
    save(SESSION_KEY, sessionId);
  }, [sessionId]);
  useEffect(() => {
    save(ITEMS_KEY, items);
  }, [items]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, pending]);

  const send = async (request: Omit<ChatRequest, "session_id">, display: string, retryOf?: string) => {
    setNotice(null);
    const id = retryOf ?? newId();
    setItems((prev) =>
      retryOf
        ? prev.map((x) => (x.id === retryOf && x.role === "user" ? { ...x, failed: false } : x))
        : [...prev, { id, role: "user", text: display, request }],
    );
    setPending(true);
    try {
      const response = await api.chat({ session_id: sessionId, ...request });
      setItems((prev) => [...prev, { id: newId(), role: "assistant", response }]);
    } catch {
      setItems((prev) => prev.map((x) => (x.id === id && x.role === "user" ? { ...x, failed: true } : x)));
    } finally {
      setPending(false);
    }
  };

  const sendText = (value: string) => {
    const message = value.trim();
    if (!message || pending) return;
    setText("");
    void send({ message }, message);
  };

  const sendLocation = async () => {
    setNotice(copy.chat.locating);
    try {
      const location = await getCurrentPosition();
      void send({ location }, copy.chat.sentLocation);
    } catch {
      setNotice(copy.chat.locationFailed);
    }
  };

  const pick = (q: QuickReply) => {
    if (q.type === "message") sendText(q.text);
    else if (q.type === "postback") void send({ postback: q.data }, q.display_text ?? q.label);
    else void sendLocation();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendText(text);
  };

  const reset = () => {
    setItems([]);
    setSessionId(newId());
    setNotice(null);
  };

  const last = items[items.length - 1];
  const quickReplies = last?.role === "assistant" && !pending ? last.response.quick_replies : [];

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h1 className="text-base font-semibold text-slate-800">{copy.chat.title}</h1>
        {items.length > 0 && (
          <button type="button" onClick={reset} className="text-sm text-brand-700 hover:underline">
            {copy.chat.newChat}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[15px] leading-relaxed shadow-sm">
          {copy.chat.intro}
        </div>
        {items.length === 0 && (
          <div className="flex flex-col items-start gap-2">
            {copy.chat.starters.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => sendText(s)}
                className="rounded-2xl border border-brand-600 bg-white px-3 py-2 text-left text-sm text-brand-700 hover:bg-brand-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {items.map((item, i) =>
          item.role === "user" ? (
            <div key={item.id} className="flex flex-col items-end gap-1">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-700 px-4 py-2.5 text-[15px] whitespace-pre-line text-white">
                {item.text}
              </div>
              {item.failed && (
                <div className="flex items-center gap-2 text-xs text-red-700">
                  {copy.chat.failed}
                  <button
                    type="button"
                    onClick={() => void send(item.request, item.text, item.id)}
                    className="font-semibold underline"
                  >
                    {copy.chat.retry}
                  </button>
                </div>
              )}
              {item.failed && looksLikeEmergency(item.text) && (
                <div className="w-full">
                  <EmergencyCard />
                </div>
              )}
            </div>
          ) : (
            <div key={item.id} className="flex flex-col items-start gap-2">
              {item.response.emergency && !previousWasEmergency(items, i) && (
                <div className="w-full">
                  <EmergencyCard />
                </div>
              )}
              <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line shadow-sm">
                {item.response.reply}
              </div>
              {item.response.ticket_id != null && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                  {copy.chat.ticketCreated(item.response.ticket_id)}
                </span>
              )}
              {item.response.sources.length > 0 && (
                <div className="flex max-w-full flex-wrap gap-1.5">
                  {item.response.sources.map((s, i) => (
                    <SourceChip key={i} source={s} />
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {pending && <TypingBubble />}
        <div ref={bottom} />
      </div>

      <QuickReplies items={quickReplies} disabled={pending} onPick={pick} />
      {notice && <p className="px-4 pb-1 text-xs text-slate-600">{notice}</p>}

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-slate-200 bg-white px-3 py-2">
        <button
          type="button"
          onClick={() => void sendLocation()}
          disabled={pending}
          aria-label={copy.chat.shareLocation}
          title={copy.chat.shareLocation}
          className="rounded-full p-2.5 text-xl text-brand-700 hover:bg-brand-50 disabled:opacity-50"
        >
          <LocateIcon />
        </button>
        <label className="sr-only" htmlFor="chat-input">
          {copy.chat.placeholder}
        </label>
        <input
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={copy.chat.placeholder}
          autoComplete="off"
          enterKeyHint="send"
          className="min-w-0 flex-1 rounded-full border border-slate-300 bg-slate-50 px-4 py-2.5 text-[16px] outline-none focus:border-brand-600 focus:bg-white"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          aria-label={copy.chat.send}
          className="rounded-full bg-brand-700 p-2.5 text-xl text-white hover:bg-brand-800 disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
