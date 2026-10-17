import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { ChatRequest, ChatResponse, QuickReply } from "../../api/types";
import { LocateIcon, SendIcon } from "../../components/icons";
import { copy } from "../../copy";
import { looksLikeEmergency } from "../../lib/danger";
import { getCurrentPosition } from "../../lib/geolocation";
import { HotlineNotice } from "../../components/HotlineNotice";
import { EmergencyCard, QuickReplies, Sources, TypingBubble } from "./parts";

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
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
        <h1 className="m-0 text-heading font-semibold">{copy.chat.title}</h1>
        {items.length > 0 && (
          <button type="button" onClick={reset} className="min-h-11 text-label font-semibold text-river underline-offset-3 hover:underline">
            {copy.chat.newChat}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3" aria-live="polite">
        <div className="nm-bubble nm-bubble--bot">{copy.chat.intro}</div>
        {items.length === 0 && (
          <div className="flex flex-col items-start gap-2">
            {copy.chat.starters.map((s) => (
              <button key={s} type="button" onClick={() => sendText(s)} className="nm-chip rounded-md">
                {s}
              </button>
            ))}
          </div>
        )}

        {items.map((item, i) =>
          item.role === "user" ? (
            <div key={item.id} className="flex flex-col items-end gap-1">
              <div className="nm-bubble nm-bubble--user whitespace-pre-line">{item.text}</div>
              {item.failed && (
                <p className="nm-field-error m-0 flex items-center gap-2">
                  {copy.chat.failed}
                  <button
                    type="button"
                    onClick={() => void send(item.request, item.text, item.id)}
                    className="min-h-11 font-semibold text-river underline"
                  >
                    {copy.chat.retry}
                  </button>
                </p>
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
              <div className="nm-bubble nm-bubble--bot whitespace-pre-line">{item.response.reply}</div>
              {item.response.ticket_id != null && (
                <p className="m-0 rounded-sm bg-surface-sunken px-3 py-1.5 text-caption">
                  {copy.chat.ticketCreated(item.response.ticket_id)}
                </p>
              )}
              <Sources sources={item.response.sources} />
              {/* Every risk answer ends with the hotline (DS); rescue replies already led with it. */}
              {isRiskAnswer(item.response) && !item.response.emergency && (
                <div className="w-full max-w-[34rem]">
                  <HotlineNotice />
                </div>
              )}
            </div>
          ),
        )}
        {pending && <TypingBubble />}
        <div ref={bottom} />
      </div>

      <QuickReplies items={quickReplies} disabled={pending} onPick={pick} />
      {notice && <p className="m-0 px-4 pb-1 text-caption text-ink-muted">{notice}</p>}

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line bg-surface-raised px-3 py-2">
        <button
          type="button"
          onClick={() => void sendLocation()}
          disabled={pending}
          aria-label={copy.chat.shareLocation}
          title={copy.chat.shareLocation}
          className="nm-btn nm-btn--secondary size-[52px] shrink-0 p-0 text-river"
        >
          <LocateIcon className="text-[22px]" />
        </button>
        <label className="sr-only" htmlFor="chat-input">
          {copy.chat.inputLabel}
        </label>
        <input
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={copy.chat.placeholder}
          autoComplete="off"
          enterKeyHint="send"
          className="nm-input min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          aria-label={copy.chat.send}
          className="nm-btn nm-btn--primary size-[52px] shrink-0 p-0"
        >
          <SendIcon className="text-[22px]" />
        </button>
      </form>
    </div>
  );
}

/** A reply that talks about river risk (it cites a station). */
function isRiskAnswer(r: ChatResponse): boolean {
  return r.sources.some((s) => s.type === "station");
}
