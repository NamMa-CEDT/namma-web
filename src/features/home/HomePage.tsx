import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useStations } from "../../api/queries";
import { Composer } from "../../components/Composer";
import { HotlineNotice } from "../../components/HotlineNotice";
import { RiverProfile } from "../../components/RiverProfile";
import { ErrorState, Loading } from "../../components/States";
import { copy, type Starter } from "../../copy";
import type { ChatHandoff } from "../../lib/chatSession";
import { LINE_OA_URL } from "../../lib/line";
import { StarterChips } from "../chat/parts";

/**
 * DS new-user page: the question, the composer and starter chips above the bank line; below it, what the
 * river and NamMa know (the live RiverProfile) and the three setup steps. Sending opens the chat.
 */
export default function HomePage() {
  const [text, setText] = useState("");
  const navigate = useNavigate();
  const stations = useStations();
  const go = (handoff: ChatHandoff) => navigate("/chat", { state: handoff });
  const pick = (s: Starter) => go(s.send ? { send: s.send } : { fill: `${s.fill ?? s.label} ` });

  return (
    <div className="h-full overflow-y-auto">
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
          <StarterChips onPick={pick} center />
        </div>
      </div>

      <div className="nm-below">
        <section aria-labelledby="river-h" className="mx-auto flex max-w-[1344px] flex-col gap-4 px-4 pt-10 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <h2 id="river-h" className="m-0 text-title font-semibold">
                {copy.home.riverTitle}
              </h2>
              <p className="m-0 text-body text-ink-muted">{copy.home.riverSubtitle}</p>
            </div>
            <Link to="/map" className="inline-flex min-h-11 items-center font-semibold text-river">
              {copy.home.seeMap}
            </Link>
          </div>
          <p className="m-0 text-caption text-ink-muted sm:hidden">{copy.home.scrollHint}</p>
          <div className="rounded-md border border-line bg-surface p-4 sm:p-6">
            {stations.isPending ? (
              <Loading />
            ) : stations.isError ? (
              <ErrorState error={stations.error} onRetry={() => stations.refetch()} />
            ) : (
              <RiverProfile stations={stations.data} />
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
          </div>
        </section>
      </div>
    </div>
  );
}
