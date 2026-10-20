import QRCode from "qrcode";
import { useEffect, useId, useRef, useState } from "react";
import { copy } from "../copy";
import { lineOaId } from "../lib/line";
import { CloseIcon } from "./icons";

export type LineQrText = Pick<typeof copy.lineQr, "title" | "scan" | "qrAlt" | "add">;

/**
 * Popup for a NamMa LINE OA link: a QR to scan with a phone (the usual way from a desktop) and a button that opens it
 * (the usual way on the phone itself). By default the add-friend link; `text` words it for another link, such as a
 * station's alert message. The QR is drawn here from the link, never fetched.
 */
export function LineQrDialog({
  url,
  open,
  onClose,
  text = copy.lineQr,
}: {
  url: string;
  open: boolean;
  onClose: () => void;
  text?: LineQrText;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [qr, setQr] = useState<string | null>(null);
  const handle = lineOaId(url);

  useEffect(() => {
    let live = true;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then((svg) => live && setQr(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, [url]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="nm-qr-dialog"
      onClose={onClose}
      // A click on the dialog element itself is a click on the backdrop (the card is its child).
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex flex-col items-center gap-4 p-5 text-center">
        <div className="flex w-full items-start justify-between gap-2">
          <h2 id={titleId} className="m-0 text-left text-heading font-semibold">
            {text.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.lineQr.close}
            title={copy.lineQr.close}
            className="-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-surface-sunken"
          >
            <CloseIcon className="text-[22px]" />
          </button>
        </div>
        {/* Dark on white in both themes: phone cameras read a light-on-dark QR badly. */}
        <div className="rounded-md bg-white p-2">
          {qr ? (
            <img src={qr} alt={text.qrAlt} width={208} height={208} className="block size-52" />
          ) : (
            <div className="size-52" aria-hidden="true" />
          )}
        </div>
        <p className="m-0 text-body text-ink-muted">{text.scan}</p>
        {handle && <p className="m-0 font-mono text-label font-semibold">{handle}</p>}
        <a className="nm-btn nm-btn--line nm-btn--block no-underline" href={url} target="_blank" rel="noreferrer">
          {text.add}
        </a>
      </div>
    </dialog>
  );
}
