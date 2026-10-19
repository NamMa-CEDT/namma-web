import { Link } from "react-router";
import type { QuickReply, Source } from "../../api/types";
import { HotlineNotice } from "../../components/HotlineNotice";
import { LocateIcon, PinIcon } from "../../components/icons";
import { copy, type Starter } from "../../copy";
import { looksLikeEmergency } from "../../lib/danger";
import { formatDistance, formatTime } from "../../lib/format";

/** Rescue reply: the hotline comes first, before any questions (DS HotlineNotice, CLAUDE.md §6). */
export function EmergencyCard() {
  return (
    <div role="alert" className="grid gap-2">
      <p className="m-0 text-heading font-semibold text-tier-danger-ink">{copy.chat.emergencyTitle}</p>
      <HotlineNotice rescue />
    </div>
  );
}

/** Every risk answer names its source: place first, code second, distance and reading time. */
export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <ul className="m-0 grid w-full max-w-[40rem] list-none gap-1.5 p-0" aria-label={copy.chat.sourcesLabel}>
      {sources.map((s, i) => (
        <li key={i}>
          <SourceItem source={s} />
        </li>
      ))}
    </ul>
  );
}

function SourceItem({ source }: { source: Source }) {
  if (source.type === "station") {
    const bits = [formatDistance(source.distance_km), source.observed_at && formatTime(source.observed_at)].filter(Boolean);
    return (
      <Link
        to={`/map?station=${source.station_id}`}
        className="inline-flex min-h-11 items-center gap-2 text-caption text-ink-muted no-underline"
      >
        <span>{copy.station.sourceLead}</span>
        <span className="font-semibold text-river underline underline-offset-3">
          สถานี{source.name_th} {source.code && <span className="nm-code">({source.code})</span>}
        </span>
        {bits.length > 0 && <span className="num">· {bits.join(" · ")}</span>}
      </Link>
    );
  }
  if (source.type === "shelter") {
    // Chosen for this household (accepts patients/pets): household ground, no waves.
    return (
      <span className="inline-flex items-center gap-2 rounded-sm bg-home-soft px-3 py-1.5 text-caption text-ink">
        <PinIcon className="shrink-0 text-[18px] text-home" />
        <b className="font-semibold text-home">{source.name}</b>
        {source.distance_km != null && <span className="num">· {formatDistance(source.distance_km)}</span>}
      </span>
    );
  }
  return (
    <span className="text-caption text-ink-muted">
      {copy.station.sourceLead} GISTDA (สทอภ.) · {source.summary}
    </span>
  );
}

/** DS QuickReply chips: they mirror LINE quick replies. The one emergency reply is `--urgent`. */
export function QuickReplies({
  items,
  disabled,
  onPick,
}: {
  items: QuickReply[];
  disabled: boolean;
  onPick: (q: QuickReply) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="ตัวเลือกตอบกลับ">
      {items.map((q) => (
        <button
          key={`${q.type}:${q.label}`}
          type="button"
          disabled={disabled}
          onClick={() => onPick(q)}
          className={`nm-chip shrink-0 ${looksLikeEmergency(q.label) ? "nm-chip--urgent" : ""}`}
        >
          {q.type === "location" && <LocateIcon className="text-[20px]" />}
          {q.label}
        </button>
      ))}
    </div>
  );
}

export function TypingBubble() {
  return (
    <div role="status" className="flex w-fit gap-1.5 py-3">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="size-2 animate-bounce rounded-full bg-ink-muted motion-reduce:animate-none"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
      <span className="sr-only">{copy.chat.typing}</span>
    </div>
  );
}

/** DS starter chips under an empty composer. The danger starter is `--urgent` and sends at once (hotline reply). */
export function StarterChips({ onPick, center = false }: { onPick: (s: Starter) => void; center?: boolean }) {
  return (
    <div className={`nm-row ${center ? "justify-center" : ""}`}>
      {copy.chat.starters.map((s) => (
        <button key={s.label} type="button" onClick={() => onPick(s)} className={`nm-chip ${s.urgent ? "nm-chip--urgent" : ""}`}>
          {s.label}
        </button>
      ))}
    </div>
  );
}
