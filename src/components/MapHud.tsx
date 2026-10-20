import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { copy } from "../copy";
import { BASEMAP_THUMB, type Basemap } from "../lib/basemaps";

/** Whether this browser has closed a map tip (or opened these map options); a convenience only, so any storage
 * failure shows the tip again. */
export function readHintSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function saveHintSeen(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Private mode or blocked storage: the hint comes back next visit.
  }
}

/** How long a map tip stays before it fades, and how long the fade takes. */
const TIP_MS = 6000;
const FADE_MS = 500;

/**
 * A map tip that fades out by itself after a few seconds, then calls onGone (which remembers it). Hovering or
 * focusing it holds it while someone reads; a tap closes it at once. With reduced motion it just goes.
 */
export function FadingTip({ className, onGone, children }: { className: string; onGone: () => void; children: ReactNode }) {
  const [fading, setFading] = useState(false);
  const [held, setHeld] = useState(false);
  const gone = useRef(onGone);
  gone.current = onGone;
  useEffect(() => {
    if (held || fading) return;
    const t = setTimeout(() => setFading(true), TIP_MS);
    return () => clearTimeout(t);
  }, [held, fading]);
  // Not transitionend: with reduced motion there is no transition to end.
  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => gone.current(), FADE_MS);
    return () => clearTimeout(t);
  }, [fading]);
  const hold = () => {
    setHeld(true);
    setFading(false);
  };
  return (
    <button
      type="button"
      onClick={() => gone.current()}
      onMouseEnter={hold}
      onMouseLeave={() => setHeld(false)}
      onFocus={hold}
      onBlur={() => setHeld(false)}
      className={`${className} transition-opacity duration-500 motion-reduce:transition-none ${fading ? "opacity-0" : "opacity-100"}`}
    >
      {children}
      <span className="sr-only">{copy.flood.close}</span>
    </button>
  );
}

export function HudIcon({ d, className = "", weight = 2 }: { d: string; className?: string; weight?: number }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d={d} />
    </svg>
  );
}
export const HUD_ICON = {
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  layers: "m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5",
  close: "M6 6l12 12M18 6 6 18",
  check: "m5 12 5 5 9-10",
};

/**
 * The map's own buttons (DS map controls option B): one 44px column top-left, zoom in / out over a layers button, so
 * the rest of the map stays clear. Open, the map options (`children`) come up as a sheet from the bottom on a phone, a
 * card beside the column on larger screens. Until this browser has opened them once (or closed the hint), a hint
 * bubble beside the layers button says what's in there; `hintKey` remembers that per map.
 */
export function MapHud({
  map,
  zoom,
  open,
  setOpen,
  hint: hintText,
  hintKey,
  children,
}: {
  map: LeafletMap | null;
  zoom: number | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  hint: string;
  hintKey: string;
  children: ReactNode;
}) {
  const layersBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    layersBtn.current?.focus({ preventScroll: true });
  };
  const [hint, setHint] = useState(() => !readHintSeen(hintKey));
  const hideHint = () => {
    setHint(false);
    saveHintSeen(hintKey);
  };
  const openByTap = () => {
    hideHint();
    flushSync(() => setOpen(true));
    closeBtn.current?.focus({ preventScroll: true });
  };

  const atMin = map != null && zoom != null && zoom <= map.getMinZoom();
  const atMax = map != null && zoom != null && zoom >= map.getMaxZoom();
  const zoomBtn = "flex aspect-square w-full items-center justify-center rounded-[8px] text-ink hover:bg-surface-sunken disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <>
      <div className="pointer-events-none absolute top-2.5 left-2.5 z-[500] flex flex-col items-start gap-2">
        <div className="pointer-events-auto flex w-11 flex-col gap-0.5 rounded-md border border-line-strong bg-surface-raised p-0.5 shadow-float">
          <button type="button" aria-label={copy.flood.zoomIn} disabled={!map || atMax} onClick={() => map?.zoomIn()} className={zoomBtn}>
            <HudIcon d={HUD_ICON.plus} />
          </button>
          <button type="button" aria-label={copy.flood.zoomOut} disabled={!map || atMin} onClick={() => map?.zoomOut()} className={zoomBtn}>
            <HudIcon d={HUD_ICON.minus} />
          </button>
        </div>
        <div className="relative">
          <button
            ref={layersBtn}
            type="button"
            aria-label={copy.flood.mapControls}
            aria-expanded={open}
            aria-controls="map-options"
            onClick={() => (open ? close() : openByTap())}
            className={`pointer-events-auto flex size-11 items-center justify-center rounded-md border shadow-float ${
              open ? "border-river bg-river text-on-river" : "border-line-strong bg-surface-raised text-river hover:bg-surface-sunken"
            }`}
          >
            <HudIcon d={HUD_ICON.layers} className="size-[22px]" />
          </button>
          {hint && !open && (
            <FadingTip
              onGone={hideHint}
              className="pointer-events-auto absolute top-1/2 left-full ml-3 w-56 -translate-y-1/2 rounded-md bg-river px-3 py-2 text-left text-on-river shadow-float"
            >
              {/* The arrow: a turned square tucked under the bubble's left edge, pointing at the button. */}
              <span aria-hidden="true" className="absolute top-1/2 -left-1.5 size-3 -translate-y-1/2 rotate-45 bg-river" />
              <span className="relative block text-caption font-semibold">{hintText}</span>
            </FadingTip>
          )}
        </div>
      </div>

      {open && (
        <>
          <div aria-hidden="true" onClick={close} className="absolute inset-0 z-[1000] bg-[rgba(4,12,24,0.3)] sm:hidden" />
          {/* Phone: a sheet along the map's bottom edge. Larger: a card beside the 44px column (10px + 44px + 8px in). */}
          <section
            id="map-options"
            role="dialog"
            aria-label={copy.flood.mapControls}
            onKeyDown={(e) => e.key === "Escape" && close()}
            className="absolute z-[1000] flex flex-col gap-2 overflow-y-auto border-line-strong bg-surface-raised shadow-float max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[85%] max-sm:rounded-t-lg max-sm:border-t max-sm:px-4 max-sm:pt-1.5 max-sm:pb-4 sm:top-2.5 sm:left-[3.875rem] sm:max-h-[calc(100%-1.25rem)] sm:w-72 sm:max-w-[calc(100%-4.5rem)] sm:rounded-lg sm:border sm:p-3 sm:pt-2"
          >
            <span aria-hidden="true" className="mx-auto h-1 w-9 shrink-0 rounded-pill bg-line-strong sm:hidden" />
            <div className="-mr-1.5 flex items-center justify-between gap-2">
              <h2 className="m-0 flex items-center gap-2 text-label font-semibold text-ink">
                <HudIcon d={HUD_ICON.layers} className="text-river" />
                {copy.flood.mapControls}
              </h2>
              <button
                ref={closeBtn}
                type="button"
                aria-label={copy.flood.close}
                onClick={close}
                className="flex size-9 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                <HudIcon d={HUD_ICON.close} />
              </button>
            </div>
            {children}
          </section>
        </>
      )}
    </>
  );
}

/** The basemap picture buttons inside the map options. */
export function BasemapPicker({ value, onChange }: { value: Basemap; onChange: (b: Basemap) => void }) {
  return (
    <>
      <p className="m-0 mt-1 text-caption font-semibold text-ink-muted">{copy.flood.basemap}</p>
      <div role="group" aria-label={copy.flood.basemap} className="grid grid-cols-2 gap-2">
        {(["satellite", "streets"] as const).map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={b === value}
            onClick={() => onChange(b)}
            className={`relative flex flex-col gap-1 rounded-md border p-1 pb-1.5 text-caption font-semibold ${
              b === value ? "border-river text-river shadow-[inset_0_0_0_1px_var(--river)]" : "border-line text-ink hover:border-line-strong"
            }`}
          >
            <img src={BASEMAP_THUMB[b]} alt="" loading="lazy" className="h-14 w-full rounded-[7px] bg-surface-sunken object-cover" />
            {copy.flood[b]}
            {b === value && (
              <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-river text-on-river">
                <HudIcon d={HUD_ICON.check} weight={3.5} className="size-3" />
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
