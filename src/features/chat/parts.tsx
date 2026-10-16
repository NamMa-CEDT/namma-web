import { Link } from "react-router";
import type { QuickReply, Source } from "../../api/types";
import { LineIcon, LocateIcon, MapIcon, PhoneIcon, PinIcon } from "../../components/icons";
import { copy, DDPM } from "../../copy";
import { formatDistance, formatTime } from "../../lib/format";

export function EmergencyCard() {
  return (
    <div role="alert" className="rounded-2xl border-2 border-emergency bg-red-50 p-4">
      <p className="font-semibold text-red-900">{copy.chat.emergencyTitle}</p>
      <p className="mt-0.5 text-sm text-red-900">{copy.chat.emergencyBody}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={DDPM.telHref}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emergency px-4 py-3 text-base font-semibold text-white shadow"
        >
          <PhoneIcon />
          {copy.chat.emergencyCall}
        </a>
        <a
          href={DDPM.lineHref}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-900"
        >
          <LineIcon className="text-[#06c755]" />
          {copy.chat.emergencyLine}
        </a>
      </div>
    </div>
  );
}

export function SourceChip({ source }: { source: Source }) {
  const base = "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs";
  if (source.type === "station") {
    const bits = [formatDistance(source.distance_km), source.observed_at && formatTime(source.observed_at)].filter(Boolean);
    return (
      <Link
        to={`/map?station=${source.station_id}`}
        className={`${base} border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100`}
      >
        <MapIcon className="shrink-0" />
        <span className="truncate">
          สถานี <b>{source.code}</b> {source.name_th}
          {bits.length > 0 && ` · ${bits.join(" · ")}`}
        </span>
      </Link>
    );
  }
  if (source.type === "shelter") {
    return (
      <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-900`}>
        <PinIcon className="shrink-0" />
        <span className="truncate">
          {source.name}
          {source.distance_km != null && ` · ${formatDistance(source.distance_km)}`}
        </span>
      </span>
    );
  }
  return (
    <span className={`${base} border-slate-200 bg-slate-50 text-slate-700`}>
      <span className="truncate">GISTDA · {source.summary}</span>
    </span>
  );
}

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
    <div className="flex gap-2 overflow-x-auto px-4 pb-2" aria-label="ตัวเลือกตอบกลับ">
      {items.map((q) => (
        <button
          key={`${q.type}:${q.label}`}
          type="button"
          disabled={disabled}
          onClick={() => onPick(q)}
          className="flex shrink-0 items-center gap-1 rounded-full border border-brand-600 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
        >
          {q.type === "location" && <LocateIcon />}
          {q.label}
        </button>
      ))}
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
      <span className="flex gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm">
        {[0, 150, 300].map((d) => (
          <span key={d} className="size-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
        ))}
      </span>
      <span className="sr-only">{copy.chat.typing}</span>
    </div>
  );
}
