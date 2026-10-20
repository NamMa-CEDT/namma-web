import { useEffect, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useProfile, useRivers } from "../../api/queries";
import { Composer } from "../../components/Composer";
import { HotlineNotice } from "../../components/HotlineNotice";
import { RiverProfile } from "../../components/RiverProfile";
import { RiverSearch } from "../../components/RiverSearch";
import { ErrorState, Loading } from "../../components/States";
import { copy } from "../../copy";
import { loadSessionId, type ChatHandoff } from "../../lib/chatSession";
import { LINE_OA_URL } from "../../lib/line";
import { FloodExplorer, type FloodScope } from "../flood/FloodExplorer";

const TABS = ["flood", "river"] as const;
type Tab = (typeof TABS)[number];

/**
 * DS new-user page: the question, the composer above the bank line; below it, what the water is
 * doing now in two tabs (DS option G): น้ำท่วม, GISTDA's satellite flood map first, then แม่น้ำ, the live
 * RiverProfile (staff gauges, river line, cross-sections). Then the three setup steps. Sending opens the chat.
 */
/** The chosen river alone when there is one (and it's in the results); otherwise the results as they are. */
function shownRivers<T extends { key: string }>(list: T[], picked: string | null): T[] {
  const only = picked ? list.filter((r) => r.key === picked) : [];
  return only.length ? only : list;
}

export default function HomePage() {
  const [text, setText] = useState("");
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("flood");
  const [floodScope, setFloodScope] = useState<FloodScope>({ period: "3days", province: null, amphoe: null });
  const [riverInput, setRiverInput] = useState("");
  const [riverQuery, setRiverQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null); // a suggestion chosen: the chart shows only that river
  useEffect(() => {
    const t = setTimeout(() => setRiverQuery(riverInput), 250); // one request per pause, not per keystroke
    return () => clearTimeout(t);
  }, [riverInput]);
  // The first saved place picks the river "near you"; without one the list is only the rivers at risk.
  const place = useProfile(loadSessionId()).data?.places[0];
  const rivers = useRivers(place ? { lat: place.lat, lon: place.lon } : null, riverQuery);
  const go = (handoff: ChatHandoff) => navigate("/chat", { state: handoff });
  // ARIA tabs: arrows move between the two tabs and open the one they land on.
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + 1) % TABS.length];
    setTab(next);
    document.getElementById(`now-tab-${next}`)?.focus();
  };

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="nm-above">
        <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 pt-10 pb-10 sm:pt-16 sm:pb-14">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="m-0 text-[32px] leading-[46px] font-semibold sm:text-[44px] sm:leading-[62px]">{copy.home.title}</h1>
            <p className="mx-auto my-0 max-w-[34em] text-body text-ink-muted sm:text-body-lg">{copy.home.subtitle}</p>
          </div>
          <Composer
            value={text}
            onChange={setText}
            onSend={(t) => go({ send: t })}
            onLocation={() => go({ location: true })}
            label={copy.home.composerLabel}
            placeholder={copy.home.placeholder}
          />
        </div>
      </div>

      <div className="nm-below">
        <section aria-labelledby="now-h" className="mx-auto flex max-w-[1344px] flex-col gap-4 px-4 pt-10 sm:px-6">
          <h2 id="now-h" className="sr-only">
            {copy.home.nowTitle}
          </h2>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-line">
            <div role="tablist" aria-label={copy.home.tabsLabel} className="-mb-px flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`now-tab-${t}`}
                  aria-selected={t === tab}
                  aria-controls={`now-panel-${t}`}
                  tabIndex={t === tab ? 0 : -1}
                  onClick={() => setTab(t)}
                  onKeyDown={onTabKey}
                  className={`min-h-12 border-b-[3px] px-4 text-body-lg ${
                    t === tab ? "border-river font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {copy.home.tabs[t]}
                </button>
              ))}
            </div>
            <Link to={tab === "flood" ? "/flood" : "/map"} className="inline-flex min-h-11 items-center font-semibold text-river">
              {tab === "flood" ? copy.home.seeFlood : copy.home.seeMap}
            </Link>
          </div>

          {/* Only the open tab is mounted: the flood map (Leaflet) loads when it is shown. */}
          <div role="tabpanel" id={`now-panel-${tab}`} aria-labelledby={`now-tab-${tab}`}>
            {tab === "flood" ? (
              <FloodExplorer embedded scope={floodScope} onScope={(c) => setFloodScope((s) => ({ ...s, ...c }))} />
            ) : (
              <div className="flex flex-col gap-3">
                <RiverSearch
                  value={riverInput}
                  onChange={(v) => {
                    setPicked(null);
                    setRiverInput(v);
                  }}
                  onPick={(r) => {
                    setPicked(r.key);
                    setRiverInput(r.name_th);
                    setRiverQuery(r.name_th);
                  }}
                  showLabel
                  className="max-w-xl"
                />
                <p className="m-0 text-body text-ink-muted">{copy.home.riverSubtitle}</p>
                <div className="rounded-md border border-line bg-surface p-4 sm:p-6">
                  {rivers.isPending ? (
                    <Loading />
                  ) : rivers.isError ? (
                    <ErrorState error={rivers.error} onRetry={() => rivers.refetch()} />
                  ) : riverQuery.trim() && !rivers.data.length ? (
                    <p className="m-0 text-body text-ink-muted">{copy.river.search.none(riverQuery.trim())}</p>
                  ) : (
                    <RiverProfile rivers={shownRivers(rivers.data, picked)} />
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="how-h" className="mx-auto flex max-w-[1344px] flex-col gap-5 px-4 py-12 sm:px-6">
          <h2 id="how-h" className="m-0 text-title font-semibold">
            {copy.home.stepsTitle}
          </h2>
          <ol className="nm-steps">
            {copy.home.steps.map((s) => (
              <li key={s.title}>
                <span className="nm-steps__title">{s.title}</span>
                <span className="nm-steps__text">{s.text}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="max-w-[40rem] flex-1">
              <HotlineNotice />
            </div>
            {LINE_OA_URL && (
              <a className="nm-btn nm-btn--line" href={LINE_OA_URL} target="_blank" rel="noreferrer">
                {copy.line.addFriend}
              </a>
            )}
            <Link to="/about" className="inline-flex min-h-11 items-center font-semibold text-river">
              {copy.about.nav}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
