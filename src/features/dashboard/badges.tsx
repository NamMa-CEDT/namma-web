import type { Need, TicketStatus, Urgency, Vulnerable } from "../../api/types";
import { copy } from "../../copy";
import { URGENCY_TIER } from "../../lib/tiers";

/** Urgency as word + shape on the tier colours (DS TicketRow): ด่วนมาก ◆, ด่วน ▲, ปกติ ●. */
export function UrgencyBadge({ urgency, soft = false }: { urgency: Urgency; soft?: boolean }) {
  return (
    <span className={`nm-badge nm-badge--${URGENCY_TIER[urgency]} ${soft ? "nm-badge--soft" : ""} shrink-0`}>
      {copy.urgency[urgency]}
    </span>
  );
}

/** DS nm-status: plain words, not colour. Waiting tickets stand out in river blue. */
export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`nm-status shrink-0 ${status === "open" ? "nm-status--open" : ""} ${
        status === "cancelled" ? "line-through" : ""
      }`}
    >
      {copy.status[status]}
    </span>
  );
}

export function Chips({ items, kind }: { items: (Vulnerable | Need)[]; kind: "vulnerable" | "needs" }) {
  if (!items.length) return <span className="text-caption text-ink-muted">ไม่ระบุ</span>;
  const label = (x: Vulnerable | Need) =>
    kind === "vulnerable" ? copy.vulnerable[x as Vulnerable] : copy.needs[x as Need];
  return (
    <span className="nm-ticket__tags">
      {items.map((x) => (
        <span key={x} className={`nm-tag ${kind === "vulnerable" ? "nm-tag--vulnerable" : ""}`}>
          {label(x)}
        </span>
      ))}
    </span>
  );
}
