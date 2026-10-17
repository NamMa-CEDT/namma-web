import { copy, DDPM } from "../copy";
import { LineIcon } from "./icons";

/**
 * Design system HotlineNotice: ปภ. 1784, LINE @1784DDPM and the full unofficial note.
 * Ends every risk answer and alert. The rescue version adds 1669 and goes FIRST in a rescue reply.
 * Fixed text: never shorten the note or hide it behind a tap.
 */
export function HotlineNotice({ rescue = false }: { rescue?: boolean }) {
  return (
    <aside className="nm-hotline" aria-label="สายด่วน">
      <span>
        {copy.hotline.ddpm}{" "}
        <a className="nm-hotline__num" href={DDPM.telHref}>
          {DDPM.hotline}
        </a>
      </span>
      {rescue && (
        <span>
          {copy.hotline.medical}{" "}
          <a className="nm-hotline__num" href={`tel:${copy.hotline.medicalNumber}`}>
            {copy.hotline.medicalNumber}
          </a>
        </span>
      )}
      <a
        href={DDPM.lineHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink underline underline-offset-3"
      >
        <LineIcon className="text-[18px]" />
        {copy.hotline.line} {DDPM.lineId}
      </a>
      <span className="nm-hotline__note">{copy.hotline.note}</span>
    </aside>
  );
}
