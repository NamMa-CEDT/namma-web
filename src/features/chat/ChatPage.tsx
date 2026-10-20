import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { api } from "../../api/client";
import { useSession } from "../../auth/session";
import { keys, useProfile } from "../../api/queries";
import type { ChatRequest, ChatResponse, QuickReply, Source } from "../../api/types";
import { Composer } from "../../components/Composer";
import { FloodIcon, MapIcon, SidebarIcon } from "../../components/icons";
import { HotlineNotice } from "../../components/HotlineNotice";
import { LineQrDialog } from "../../components/LineQrDialog";
import { copy } from "../../copy";
import { CHAT_ITEMS_KEY, load, loadSessionId, newId, save, saveSessionId, type ChatHandoff } from "../../lib/chatSession";
import { COMMANDS, parseCommand, suggestCommands, type Command } from "../../lib/commands";
import { floodMapLink, stationMapLink } from "../../lib/floodLink";
import { looksLikeEmergency } from "../../lib/danger";
import { getCurrentPosition } from "../../lib/geolocation";
import { LINE_OA_URL } from "../../lib/line";
import { ConsentCard, isConsentAsk } from "./ConsentCard";
import { EmergencyCard, QuickReplies, ReplyText, Sources, TypingBubble } from "./parts";
import { ProfilePanel } from "./ProfilePanel";
import { ShelterCard, hasShelterDetail, type ShelterSource } from "./ShelterCard";
import { StationCard, hasReading } from "./StationCard";

type Item =
  | { id: string; role: "user"; text: string; request: Omit<ChatRequest, "session_id">; failed?: boolean }
  | { id: string; role: "assistant"; response: ChatResponse };

const DESKTOP = "(min-width: 64rem)"; // Tailwind lg: where ProfilePanel is a column, not a drawer

function useDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia?.(DESKTOP);
      mq?.addEventListener("change", onChange);
      return () => mq?.removeEventListener("change", onChange);
    },
    () => window.matchMedia?.(DESKTOP).matches ?? false,
  );
}

/** One 1784 card per emergency exchange, not one per reply. */
function previousWasEmergency(items: Item[], index: number): boolean {
  for (let j = index - 1; j >= 0; j--) {
    const prev = items[j];
    if (prev.role === "assistant") return prev.response.emergency;
  }
  return false;
}

export default function ChatPage() {
  // The browser's anonymous user on the backend (web:<id>): kept across new chats so memory and consent stay,
  // as they do for a signed-in account. ลบข้อมูลทั้งหมด is how to wipe them.
  const [sessionId, setSessionId] = useState(loadSessionId);
  const [items, setItems] = useState<Item[]>(() => load(CHAT_ITEMS_KEY, []));
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Phones: the remembered-info panel is a drawer over the chat.
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  // The panel's ลบข้อมูลทั้งหมด confirm step, open from the button or from /forget.
  const [forgetAsking, setForgetAsking] = useState(false);
  const [lineQr, setLineQr] = useState(false);
  const closeLineQr = useCallback(() => setLineQr(false), []);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useProfile(sessionId);
  const desktop = useDesktop();
  const empty = items.length === 0;
  const hasMemory = !!profile.data && profile.data.places.length + profile.data.facts.length > 0;

  // Signed out (here or in another tab): the transcript and the anonymous chat go with the account.
  const session = useSession();
  const wasSignedIn = useRef(session !== null);
  useEffect(() => {
    if (wasSignedIn.current && !session) {
      setItems([]);
      setSessionId(loadSessionId());
    }
    wasSignedIn.current = session !== null;
  }, [session]);

  // Block bodies: effects must return nothing (newer Chromium's scrollIntoView returns a Promise,
  // which React would then call as a cleanup).
  useEffect(() => {
    saveSessionId(sessionId);
  }, [sessionId]);
  useEffect(() => {
    save(CHAT_ITEMS_KEY, items);
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
    const parsed = parseCommand(message);
    if (!parsed) void send({ message }, message);
    else if ("command" in parsed) run(parsed.command);
    else setNotice(copy.chat.unknownCommand(parsed.unknown));
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

  // Arriving from the landing page: do what it asked, once.
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
    setNotice(null);
    setForgetAsking(false);
  };

  // The remembered-info panel: a drawer on phones, an always-visible column on desktop (focused instead).
  const showMemory = () => {
    if (window.matchMedia(DESKTOP).matches) document.getElementById("profile-panel")?.focus();
    else setDrawer(true);
  };

  const run = (command: Command) => {
    setNotice(null);
    switch (command.name) {
      case "help":
        return setNotice(COMMANDS.map((c) => `/${c.name} · ${copy.chat.commands[c.name]}`).join("\n"));
      case "clear":
        return reset();
      case "location":
        return void sendLocation();
      case "memory":
        return showMemory();
      case "forget":
        if (!hasMemory) return setNotice(copy.chat.nothingToForget);
        showMemory();
        return setForgetAsking(true);
      // Start the sentence for the person to finish, like the panel's "บอกในแชท" and the starter chips.
      case "home":
        return fill(`${copy.profile.start.place} `);
      case "family":
        return fill(`${copy.profile.start.household} `);
      case "house":
        return fill(`${copy.profile.start.house} `);
      case "shelter":
        return fill(`${copy.chat.commandText.shelter} `);
      case "sos":
        return sendText(copy.chat.commandText.sos);
      case "map":
        return navigate("/map");
      case "flood":
        return navigate("/flood");
      case "account":
        return navigate("/account");
      case "line":
        if (!LINE_OA_URL) return setNotice(copy.chat.lineUnavailable);
        return setLineQr(true);
    }
  };
  const suggestions = pending ? [] : suggestCommands(text);

  const last = items[items.length - 1];
  const quickReplies = last?.role === "assistant" && !pending ? last.response.quick_replies : [];
  const consentAsk = isConsentAsk(quickReplies);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {LINE_OA_URL && <LineQrDialog url={LINE_OA_URL} open={lineQr} onClose={closeLineQr} />}
      <ProfilePanel
        chatSession={sessionId}
        onAsk={(start) => fill(`${start} `)}
        drawerOpen={drawer}
        onCloseDrawer={closeDrawer}
        forget={{ asking: forgetAsking, setAsking: setForgetAsking }}
      />

      <section aria-label={copy.chat.title} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-line px-2 lg:hidden">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
            className="inline-flex min-h-12 items-center gap-2 rounded-md px-2 text-label font-semibold text-ink hover:bg-surface-sunken"
          >
            <SidebarIcon className="text-[22px]" />
            {copy.profile.openDrawer}
          </button>
        </div>
        {/* Phones: the turns fill the space left over, so the chat box starts at the bottom of the screen, not under the
            intro; once the chat is longer than the screen it scrolls with it as before. Desktop: a new chat has the
            intro and a large box in the middle, like the home page. */}
        <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${empty ? "lg:justify-center" : ""}`} aria-live="polite">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-4 max-lg:flex-1 sm:px-6">
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
          </div>

          {/* In the scroll, after the last turn. Phones: not pinned, so a long answer gets the whole small screen.
              Desktop: sticky, so the box stays in view as before. */}
          <div className="mx-auto w-full max-w-3xl shrink-0 bg-surface px-4 pb-3 sm:px-6 lg:sticky lg:bottom-0">
            {consentAsk ? (
              // Asking permission to remember health info: the consent card takes the chat box's place until answered.
              <ConsentCard choices={quickReplies} disabled={pending} onPick={pick} />
            ) : (
              <>
                <QuickReplies items={quickReplies} disabled={pending} onPick={pick} />
                {suggestions.length > 0 && (
                  // A short list above the composer: with every command showing it scrolls instead of pushing the chat away.
                  <div
                    className="mb-2 flex max-h-64 flex-col overflow-y-auto rounded-md border border-line bg-surface-raised py-1 shadow-float"
                    role="group"
                    aria-label={copy.chat.commands.label}
                  >
                    {suggestions.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => {
                          setText("");
                          run(c);
                        }}
                        className="flex min-h-11 items-baseline gap-3 px-3 text-left text-label hover:bg-surface-sunken"
                      >
                        <span className="w-20 shrink-0 font-mono font-semibold text-river">/{c.name}</span>
                        <span className="min-w-0 text-ink-muted">{copy.chat.commands[c.name]}</span>
                      </button>
                    ))}
                  </div>
                )}
                {notice && <p className="m-0 whitespace-pre-line pb-1 text-caption text-ink-muted">{notice}</p>}
                <Composer
                  compact={!(empty && desktop)}
                  value={text}
                  onChange={setText}
                  onSend={sendText}
                  onLocation={() => void sendLocation()}
                  disabled={pending}
                  label={copy.chat.inputLabel}
                  placeholder={items.length ? copy.chat.placeholder : copy.home.placeholder}
                  inputRef={input}
                />
              </>
            )}
            <p className="m-0 pt-1.5 text-center text-caption text-ink-muted">
              {copy.legal.aiNote} ·{" "}
              <Link to="/privacy" className="underline">
                {copy.legal.privacyLink}
              </Link>
            </p>
            <div ref={bottom} />
          </div>
        </div>
      </section>
    </div>
  );
}

type StationSource = Extract<Source, { type: "station" }>;

/**
 * One NamMa turn: the reply text (DS nm-msg), a button to the flood map at the place the answer is about, the station
 * cards behind it (the backend sends the worse station first), the shelter card, other sources, then the hotline.
 * GISTDA lines stay in the text, so they aren't repeated as sources.
 */
function Answer({ response: r, firstEmergency }: { response: ChatResponse; firstEmergency: boolean }) {
  const cards = r.sources.filter((s): s is StationSource => s.type === "station" && hasReading(s));
  const shelters = r.sources.filter((s): s is ShelterSource => s.type === "shelter" && hasShelterDetail(s));
  const rest = r.sources.filter(
    (s) => s.type !== "gistda" && !cards.includes(s as StationSource) && !shelters.includes(s as ShelterSource),
  );
  return (
    <div className="flex flex-col items-start gap-3">
      {r.emergency && firstEmergency && (
        <div className="w-full">
          <EmergencyCard />
        </div>
      )}
      <ReplyText text={r.reply} />
      {/* Right under the text that names the place, before the cards about it. */}
      {r.place && (
        <div className="flex flex-wrap gap-2">
          <Link to={floodMapLink(r.place)} className="nm-btn nm-btn--secondary nm-btn--sm">
            <FloodIcon className="shrink-0 text-[20px] text-river" />
            {copy.chat.openFloodMap}
          </Link>
          <Link to={stationMapLink(r.place)} className="nm-btn nm-btn--secondary nm-btn--sm">
            <MapIcon className="shrink-0 text-[20px] text-river" />
            {copy.chat.openStationMap}
          </Link>
        </div>
      )}
      {cards.map((s) => (
        <StationCard key={s.station_id} source={s} />
      ))}
      {shelters.length > 0 && <ShelterCard shelters={shelters} />}
      <Sources sources={rest} />
      {/* Every risk and shelter answer ends with the hotline (DS); rescue replies already led with it. The backend drops
          its text copy of the hotline when it sends these cards. */}
      {(isRiskAnswer(r) || shelters.length > 0) && !r.emergency && (
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
