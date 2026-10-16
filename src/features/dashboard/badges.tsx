import type { Need, TicketStatus, Urgency, Vulnerable } from "../../api/types";
import { copy } from "../../copy";

// Urgency reuses the status scale (critical = tier danger, high = tier warning) with label text.
const URGENCY_STYLE: Record<Urgency, { background: string; color: string } | null> = {
  critical: { background: "#d03b3b", color: "#ffffff" },
  high: { background: "#ec835a", color: "#0f172a" },
  normal: null,
};

export const URGENCY_PIN: Record<Urgency, string> = { critical: "#d03b3b", high: "#ec835a", normal: "#64748b" };

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const style = URGENCY_STYLE[urgency];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        style ? "" : "bg-slate-100 text-slate-700"
      }`}
      style={style ?? undefined}
    >
      {copy.urgency[urgency]}
    </span>
  );
}

const STATUS_STYLE: Record<TicketStatus, string> = {
  open: "bg-sky-100 text-sky-900",
  acknowledged: "bg-indigo-100 text-indigo-900",
  in_progress: "bg-violet-100 text-violet-900",
  resolved: "bg-slate-100 text-slate-600",
  cancelled: "bg-slate-100 text-slate-500 line-through",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {copy.status[status]}
    </span>
  );
}

export function Chips({ items, kind }: { items: (Vulnerable | Need)[]; kind: "vulnerable" | "needs" }) {
  if (!items.length) return <span className="text-xs text-slate-400">ไม่ระบุ</span>;
  const label = (x: Vulnerable | Need) =>
    kind === "vulnerable" ? copy.vulnerable[x as Vulnerable] : copy.needs[x as Need];
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((x) => (
        <span
          key={x}
          className={`rounded-md px-1.5 py-0.5 text-xs ${
            kind === "vulnerable" ? "bg-rose-50 text-rose-900 ring-1 ring-rose-200" : "bg-slate-100 text-slate-700"
          }`}
        >
          {label(x)}
        </span>
      ))}
    </span>
  );
}
