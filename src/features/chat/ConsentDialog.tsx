import { useEffect, useId, useRef } from "react";
import { Link } from "react-router";
import type { QuickReply } from "../../api/types";
import { copy } from "../../copy";
import { ReplyText } from "./parts";

/** A reply asking permission to remember health info offers `consent:` postbacks. */
export function isConsentAsk(items: QuickReply[]): boolean {
  return items.some((q) => q.type === "postback" && q.data.startsWith("consent:"));
}

/**
 * Permission to remember health info (PDPA), asked as a modal over the chat: the composer stays out of reach until
 * the person answers. Escape and the backdrop don't close it; ไม่ยินยอม is the way out. Both answers look the same,
 * so neither is nudged.
 */
export function ConsentDialog({
  question,
  choices,
  disabled,
  onPick,
}: {
  question: string;
  choices: QuickReply[];
  disabled: boolean;
  onPick: (q: QuickReply) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = choices.length > 0;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={dialog} aria-labelledby={titleId} className="nm-qr-dialog" onCancel={(e) => e.preventDefault()}>
      <div className="flex flex-col gap-4 p-5">
        <h2 id={titleId} className="m-0 text-heading font-semibold">
          {copy.legal.consentTitle}
        </h2>
        <ReplyText text={question} />
        {/* Fixed, whatever the reply says: what is kept, why, what declining means, how to take it back. */}
        <dl className="m-0 flex flex-col gap-2 rounded-md bg-surface-sunken p-3 text-label">
          {copy.legal.consentExplain.map(({ h, b }) => (
            <div key={h}>
              <dt className="font-semibold">{h}</dt>
              <dd className="m-0 text-ink-muted">{b}</dd>
            </div>
          ))}
        </dl>
        <Link to="/pdpa" className="text-label text-ink-muted underline">
          {copy.legal.pdpaLink}
        </Link>
        <div className="flex flex-col gap-2">
          {choices.map((q) => (
            <button
              key={`${q.type}:${q.label}`}
              type="button"
              disabled={disabled}
              onClick={() => onPick(q)}
              className="nm-btn nm-btn--secondary nm-btn--block"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
