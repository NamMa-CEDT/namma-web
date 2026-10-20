import { useEffect, useId } from "react";
import { Link } from "react-router";
import type { QuickReply } from "../../api/types";
import { copy } from "../../copy";

/** A reply asking permission to remember health info offers `consent:` postbacks. */
export function isConsentAsk(items: QuickReply[]): boolean {
  return items.some((q) => q.type === "postback" && q.data.startsWith("consent:"));
}

/**
 * Permission to remember health info (PDPA), asked in place of the composer like a permission prompt: the chat box is
 * out of reach until the person answers, while the reply that asks stays readable above. The question itself is in
 * that reply, so this card only explains it. The answers are numbered rows (keys 1, 2 pick them) that look the same,
 * so neither is nudged.
 */
export function ConsentCard({
  choices,
  disabled,
  onPick,
}: {
  choices: QuickReply[];
  disabled: boolean;
  onPick: (q: QuickReply) => void;
}) {
  const titleId = useId();
  // No focus on load: a ring on ยินยอม would read as the default answer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
      const q = choices[Number(e.key) - 1];
      if (!q) return;
      e.preventDefault();
      onPick(q);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choices, disabled, onPick]);

  return (
    <section
      aria-labelledby={titleId}
      className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto rounded-lg border-2 border-river bg-surface-raised p-4 shadow-float sm:p-5"
    >
      <h2 id={titleId} className="m-0 text-body font-semibold">
        {copy.legal.consentTitle}
      </h2>
      <ul className="m-0 grid list-none gap-x-6 gap-y-1.5 p-0 text-label sm:grid-cols-2">
        {copy.legal.consentExplain.map(({ h, b }) => (
          <li key={h}>
            <span className="font-semibold">{h}</span> <span className="text-ink-muted">{b}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1.5" role="group" aria-labelledby={titleId}>
        {choices.map((q, i) => (
          <button
            key={`${q.type}:${q.label}`}
            type="button"
            disabled={disabled}
            onClick={() => onPick(q)}
            className="flex min-h-12 w-full items-center gap-3 rounded-md border border-line px-3 text-left text-body font-semibold hover:bg-surface-sunken focus-visible:border-river disabled:cursor-not-allowed disabled:text-ink-muted"
          >
            <span aria-hidden="true" className="w-4 shrink-0 font-mono text-label text-ink-muted">
              {i + 1}
            </span>
            {q.label}
          </button>
        ))}
      </div>
      <Link to="/pdpa" className="self-start text-caption text-ink-muted underline">
        {copy.legal.pdpaLink}
      </Link>
    </section>
  );
}
