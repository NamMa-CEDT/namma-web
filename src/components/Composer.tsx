import { useEffect, useId, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { copy } from "../copy";
import { useSpeech } from "../lib/speech";
import { ArrowUpIcon, MicIcon, PinIcon } from "./icons";

/**
 * DS Composer: the one place a person types to NamMa on the web. Large on the landing page; `compact`
 * (one line) under an ongoing chat; on a phone the field takes the first line and the buttons a second (index.css).
 * Sits on `surface` above the bank line, never in a card.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onLocation,
  disabled = false,
  compact = false,
  label,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string) => void;
  onLocation?: () => void;
  disabled?: boolean;
  compact?: boolean;
  label: string;
  /** A list of examples rotates every few seconds while the box is empty. */
  placeholder: string | readonly string[];
  inputRef?: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
}) {
  const id = useId();
  const examples = typeof placeholder === "string" ? [placeholder] : placeholder;
  const [n, setN] = useState(0);
  useEffect(() => {
    if (examples.length < 2 || value) return;
    const t = setInterval(() => setN((i) => i + 1), 3500);
    return () => clearInterval(t);
  }, [examples.length, value]);
  const shown = examples[n % examples.length] ?? "";
  const rotating = examples.length > 1;
  const speech = useSpeech((heard) => onChange(value ? `${value} ${heard}` : heard));
  const canSend = !disabled && value.trim().length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canSend) onSend(value.trim());
  };

  // Enter sends, Shift+Enter breaks the line. Not while a Thai IME is still composing.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend(value.trim());
    }
  };

  const location = onLocation && (
    <button type="button" className="nm-icon-btn" onClick={onLocation} disabled={disabled} aria-label={compact ? copy.composer.location : undefined}>
      <PinIcon className="text-[20px]" />
      {!compact && copy.composer.location}
    </button>
  );
  const voice = speech.supported && (
    <button
      type="button"
      className="nm-icon-btn"
      onClick={speech.toggle}
      aria-label={copy.composer.voice}
      aria-pressed={speech.listening}
      style={speech.listening ? { background: "var(--river-soft)", borderColor: "var(--river)" } : undefined}
    >
      <MicIcon className="text-[20px]" />
    </button>
  );
  const send = (
    <button type="submit" className="nm-icon-btn nm-icon-btn--send" disabled={!canSend} aria-label={copy.composer.send}>
      <ArrowUpIcon className="text-[20px]" weight="bold" />
    </button>
  );

  return (
    <form className={`nm-composer ${compact ? "nm-composer--compact" : ""}`} onSubmit={submit}>
      <label className="nm-sr" htmlFor={id}>
        {label}
      </label>
      <div className="nm-composer__field">
        {compact ? (
          // One line under an ongoing chat (DS nm-composer--compact): an input, so a long placeholder never wraps.
          <input
            ref={inputRef as RefObject<HTMLInputElement | null>}
            id={id}
            type="text"
            className="nm-composer__input truncate"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={speech.listening ? copy.composer.listening : rotating ? undefined : shown}
            autoComplete="off"
            enterKeyHint="send"
          />
        ) : (
          <textarea
            ref={inputRef as RefObject<HTMLTextAreaElement | null>}
            id={id}
            className="nm-composer__input"
            rows={3}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={speech.listening ? copy.composer.listening : rotating ? undefined : shown}
            autoComplete="off"
            enterKeyHint="send"
          />
        )}
        {/* The browser can't animate a placeholder, so rotating examples are drawn over the empty box. */}
        {rotating && !value && !speech.listening && (
          <span key={n % examples.length} className="nm-composer__hint" aria-hidden="true">
            {shown}
          </span>
        )}
      </div>
      {compact ? (
        <>
          {location}
          {voice}
          {send}
        </>
      ) : (
        <div className="nm-composer__bar">
          {location}
          {voice}
          <span className="nm-composer__spacer" />
          {send}
        </div>
      )}
      {speech.failed && (
        <p className="m-0 w-full text-caption text-ink-muted" role="status">
          {copy.composer.voiceFailed}
        </p>
      )}
    </form>
  );
}
