import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { api } from "../../api/client";
import { keys } from "../../api/queries";
import type { ChatRequest, ChatResponse, QuickReply, Source } from "../../api/types";
import { Composer } from "../../components/Composer";
import { HotlineNotice } from "../../components/HotlineNotice";
import { copy, type Starter } from "../../copy";
import { load, loadSessionId, newId, save, saveSessionId, type ChatHandoff } from "../../lib/chatSession";
import { looksLikeEmergency } from "../../lib/danger";
import { getCurrentPosition } from "../../lib/geolocation";
import { EmergencyCard, QuickReplies, Sources, StarterChips, TypingBubble } from "./parts";
import { ProfilePanel } from "./ProfilePanel";
import { StationCard, hasReading } from "./StationCard";

type Item =
  | { id: string; role: "user"; text: string; request: Omit<ChatRequest, "session_id">; failed?: boolean }
  | { id: string; role: "assistant"; response: ChatResponse };

const ITEMS_KEY = "namma.chat.items";

/** One 1784 card per emergency exchange, not one per reply. */
function previousWasEmergency(items: Item[], index: number): boolean {
  for (let j = index - 1; j >= 0; j--) {
    const prev = items[j];
    if (prev.role === "assistant") return prev.response.emergency;
  }
  return false;
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState(loadSessionId);
  const [items, setItems] = useState<Item[]>(() => load(ITEMS_KEY, []));
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  // Block bodies: effects must return nothing (newer Chromium's scrollIntoView returns a Promise,
  // which React would then call as a cleanup).
  useEffect(() => {
    saveSessionId(sessionId);
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
      // A turn can save a place, a fact or a consent: the ProfilePanel shows it straight away.
      void qc.invalidateQueries({ queryKey: keys.profile(sessionId) });
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
      const position = await getCurrentPosition();
      void send({ location: position }, copy.chat.sentLocation);
    } catch {
      setNotice(copy.chat.locationFailed);
    }
  };

  /** Starter chips: `fill` begins the sentence for the person to finish; `send` sends at once. */
  const fill = (start: string) => {
    setText(start);
    requestAnimationFrame(() => {
      const el = input.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };
  const startWith = (st: Starter) => (st.send ? sendText(st.send) : fill(`${st.fill ?? st.label} `));

  // Arriving from the landing page or the header's rescue button: do what it asked, once.
  // The ref guards against React StrictMode running the effect twice for the same navigation.
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const handoff = location.state as ChatHandoff | null;
    if (!handoff || handled.current === location.key) return;
    handled.current = location.key;
    navigate(location.pathname + location.search, { replace: true, state: null });
    if (handoff.send) sendText(handoff.send);
    else if (handoff.location) void sendLocation();
    else if (handoff.fill) fill(handoff.fill);
  }, [location.state]);

  const pick = (q: QuickReply) => {
    if (q.type === "message") sendText(q.text);
    else if (q.type === "postback") void send({ postback: q.data }, q.display_text ?? q.label);
    else void sendLocation();
  };

  const reset = () => {
    setItems([]);
    setSessionId(newId());
    setNotice(null);
  };

  const last = items[items.length - 1];
  const quickReplies = last?.role === "assistant" && !pending ? last.response.quick_replies : [];

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <ProfilePanel chatSession={sessionId} />

      <section aria-label={copy.chat.title} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
          <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pt-6 pb-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="nm-msg">{copy.chat.intro}</div>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  className="min-h-11 shrink-0 text-label font-semibold text-river underline-offset-3 hover:underline"
                >
                  {copy.chat.newChat}
                </button>
              )}
            </div>
            {items.length === 0 && <StarterChips onPick={startWith} />}

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
                <Answer key={item.id} response={item.response} firstEmergency={!previousWasEmergency(items, i)} />
              ),
            )}
            {pending && <TypingBubble />}
            <div ref={bottom} />
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 pb-3 sm:px-6">
          <QuickReplies items={quickReplies} disabled={pending} onPick={pick} />
          {notice && <p className="m-0 pb-1 text-caption text-ink-muted">{notice}</p>}
          <Composer
            compact
            value={text}
            onChange={setText}
            onSend={sendText}
            onLocation={() => void sendLocation()}
            disabled={pending}
            label={copy.chat.inputLabel}
            placeholder={items.length ? copy.chat.placeholder : copy.home.placeholder}
            inputRef={input}
          />
        </div>
      </section>
    </div>
  );
}

type StationSource = Extract<Source, { type: "station" }>;

/** One NamMa turn: plain text (DS nm-msg), the station cards behind it, other sources, then the hotline. */
function Answer({ response: r, firstEmergency }: { response: ChatResponse; firstEmergency: boolean }) {
  const cards = r.sources.filter((s): s is StationSource => s.type === "station" && hasReading(s));
  const rest = r.sources.filter((s) => !(s.type === "station" && hasReading(s)));
  return (
    <div className="flex flex-col items-start gap-3">
      {r.emergency && firstEmergency && (
        <div className="w-full">
          <EmergencyCard />
        </div>
      )}
      <div className="nm-msg whitespace-pre-line">{r.reply}</div>
      {r.ticket_id != null && (
        <p className="m-0 rounded-sm bg-surface-sunken px-3 py-1.5 text-caption">{copy.chat.ticketCreated(r.ticket_id)}</p>
      )}
      {cards.map((s) => (
        <StationCard key={s.station_id} source={s} />
      ))}
      <Sources sources={rest} />
      {/* Every risk answer ends with the hotline (DS); rescue replies already led with it. */}
      {isRiskAnswer(r) && !r.emergency && (
        <div className="w-full max-w-[40rem]">
          <HotlineNotice />
        </div>
      )}
    </div>
  );
}

/** A reply that talks about river risk (it cites a station). */
function isRiskAnswer(r: ChatResponse): boolean {
  return r.sources.some((s) => s.type === "station");
}
