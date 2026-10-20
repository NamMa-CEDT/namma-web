import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router";
import { useSession } from "../../auth/session";
import { useDeleteFromProfile, useProfile } from "../../api/queries";
import type { Fact, FactKind, Profile, SavedPlace } from "../../api/types";
import { BellIcon, BuildingsIcon, CaretRightIcon, CloseIcon, HouseIcon, TrashIcon, UsersIcon } from "../../components/icons";
import { TierBadge } from "../../components/TierBadge";
import { copy } from "../../copy";
import { formatBankGap, formatDate, formatDistance } from "../../lib/format";
import { LINE_OA_URL } from "../../lib/line";

type Step = { key: "place" | "household" | "consent" | "line"; done: boolean };

/** What the first conversation collects, in order: ที่ตั้ง → คนในบ้าน → ยินยอม → LINE. Opens the row still to do. */
export function setupSteps(p: Profile): Step[] {
  const decided = p.consent.ts != null;
  return [
    { key: "place", done: p.places.length > 0 },
    { key: "household", done: p.facts.some((f) => f.kind === "household" || f.kind === "needs") || decided },
    { key: "consent", done: decided },
    { key: "line", done: p.line_linked },
  ];
}

type RowKey = "place" | "household" | "house" | "line";
const STEP_ROW: Record<Step["key"], RowKey> = { place: "place", household: "household", consent: "household", line: "line" };
const HOUSEHOLD: FactKind[] = ["household", "needs"];
const HOUSE: FactKind[] = ["house", "assets", "history"];

/** Trash icon that asks first: one tap swaps it for ลบ / ยกเลิก, so a stray tap never deletes. Focus lands on ยกเลิก. */
function DeleteButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  const [asking, setAsking] = useState(false);
  const trash = useRef<HTMLButtonElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);
  useEffect(() => {
    if (asking) cancelBtn.current?.focus();
    else if (wasAsking.current) trash.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  if (asking) {
    return (
      <span role="group" aria-label={copy.profile.confirmLabel(label)} className="inline-flex shrink-0 items-center gap-1" onKeyDown={(e) => e.key === "Escape" && setAsking(false)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setAsking(false);
            onClick();
          }}
          className="nm-btn nm-btn--danger min-h-11 px-3 text-caption"
        >
          {copy.profile.delete}
        </button>
        <button ref={cancelBtn} type="button" onClick={() => setAsking(false)} className="nm-btn nm-btn--secondary min-h-11 px-3 text-caption">
          {copy.profile.cancel}
        </button>
      </span>
    );
  }
  return (
    <button
      ref={trash}
      type="button"
      onClick={() => setAsking(true)}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised hover:text-ink"
    >
      <TrashIcon className="text-[20px]" />
    </button>
  );
}

/** ลบข้อมูลทั้งหมด, with the same ask-first step and a plain warning that it cannot be undone. */
function DeleteAll({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  const [asking, setAsking] = useState(false);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) cancelBtn.current?.focus();
  }, [asking]);

  if (!asking) {
    return (
      <button type="button" disabled={disabled} onClick={() => setAsking(true)} className="min-h-11 self-start text-caption text-ink-muted underline hover:text-ink">
        {copy.profile.deleteAll}
      </button>
    );
  }
  return (
    <div role="group" aria-label={copy.profile.deleteAll} className="flex flex-col gap-2 py-2" onKeyDown={(e) => e.key === "Escape" && setAsking(false)}>
      <p className="m-0 text-caption text-ink">{copy.profile.deleteAllConfirm}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
          className="nm-btn nm-btn--danger min-h-11 px-4 text-caption"
        >
          {copy.profile.deleteAll}
        </button>
        <button ref={cancelBtn} type="button" onClick={() => setAsking(false)} className="nm-btn nm-btn--secondary min-h-11 px-4 text-caption">
          {copy.profile.cancel}
        </button>
      </div>
    </div>
  );
}

/** DS SavedPlace: the tier badge belongs to the station, so the station is named next to it. */
function Place({ place, onDelete, busy }: { place: SavedPlace; onDelete: () => void; busy: boolean }) {
  const n = place.nearest;
  return (
    <div className="nm-place">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="nm-place__label">
            <span className="nm-house" />
            {place.label}
          </div>
          {place.where && <div className="nm-place__where">{place.where}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {n && <TierBadge tier={n.risk_tier ?? "unknown"} soft />}
          <DeleteButton label={copy.profile.deleteLabel(place.label)} onClick={onDelete} disabled={busy} />
        </div>
      </div>
      {n && (
        <div className="nm-place__where num">
          {copy.profile.nearest} {n.name_th} ({n.code}) {copy.profile.away} {formatDistance(n.distance_km)} ·{" "}
          {formatBankGap(n.diff_wl_bank)}
        </div>
      )}
      {place.approx && <div className="nm-place__where">{copy.profile.approx}</div>}
    </div>
  );
}

function Chips({ facts }: { facts: Fact[] }) {
  return (
    <div className="nm-row">
      {facts.map((f) => (
        <span key={`${f.kind}:${f.text}`} className="nm-chip nm-chip--memory">
          {f.text}
        </span>
      ))}
    </div>
  );
}

/** One row (DS option C): icon, label, a one-line summary, and its details when opened. */
function Row({
  id,
  icon: Icon,
  label,
  summary,
  empty,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  summary: ReactNode;
  empty: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line">
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex min-h-15 w-full items-center gap-3 px-4 py-1.5 text-left hover:bg-surface-raised/60"
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-raised text-ink" aria-hidden="true">
            <Icon className="text-[18px]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-caption font-normal text-ink-muted">{label}</span>
            <span className={`flex min-w-0 items-center gap-2 truncate text-label ${empty ? "font-normal text-ink-muted" : "font-semibold text-ink"}`}>
              {summary}
            </span>
          </span>
          <CaretRightIcon className={`shrink-0 text-[16px] text-ink-muted transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
      </h3>
      {open && (
        <div id={id} className="flex flex-col gap-2 px-4 pt-1 pb-4 pl-15 text-body">
          {children}
        </div>
      )}
    </section>
  );
}

function TellButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="nm-btn nm-btn--primary nm-btn--sm self-start">
      {copy.profile.tell}
    </button>
  );
}

/** The four rows and the footer: the same content in the desktop column and the phone drawer. */
function PanelBody({ profile: p, chatSession, onAsk }: { profile: Profile; chatSession: string; onAsk: (start: string) => void }) {
  const del = useDeleteFromProfile(chatSession);
  const session = useSession();
  const ids = useId();
  // Open the row of the next thing still to tell (all told: the places).
  const [open, setOpen] = useState<RowKey | null>(() => STEP_ROW[setupSteps(p).find((s) => !s.done)?.key ?? "place"]);
  const toggle = (k: RowKey) => setOpen((o) => (o === k ? null : k));

  const household = p.facts.filter((f) => HOUSEHOLD.includes(f.kind));
  const house = p.facts.filter((f) => HOUSE.includes(f.kind));
  const anything = p.places.length + p.facts.length > 0;
  const deleteKinds = async (kinds: FactKind[]) => {
    for (const k of kinds) await del.mutateAsync({ facts: k });
  };
  const first = p.places[0];
  const factsLine = (facts: Fact[]) => facts.map((f) => f.text).join(" · ");

  return (
    <>
      <Row
        id={`${ids}-place`}
        icon={HouseIcon}
        label={copy.profile.rows.place}
        empty={!first}
        open={open === "place"}
        onToggle={() => toggle("place")}
        summary={
          first ? (
            <>
              <span className="truncate">
                {first.label}
                {p.places.length > 1 && ` +${p.places.length - 1}`}
              </span>
              {first.nearest && <TierBadge tier={first.nearest.risk_tier ?? "unknown"} soft />}
            </>
          ) : (
            copy.profile.notTold
          )
        }
      >
        {p.places.length ? (
          p.places.map((pl) => <Place key={pl.id} place={pl} busy={del.isPending} onDelete={() => del.mutate({ place: pl.id })} />)
        ) : (
          <>
            <span className="text-ink-muted">{copy.profile.placesEmpty}</span>
            <TellButton onClick={() => onAsk(copy.profile.start.place)} />
          </>
        )}
      </Row>

      <Row
        id={`${ids}-household`}
        icon={UsersIcon}
        label={copy.profile.household}
        empty={!household.length}
        open={open === "household"}
        onToggle={() => toggle("household")}
        summary={household.length ? <span className="truncate">{factsLine(household)}</span> : copy.profile.notTold}
      >
        {household.length ? (
          <>
            <Chips facts={household} />
            {p.consent.granted && p.consent.ts && <span className="nm-memory__note">{copy.profile.consentNote(formatDate(p.consent.ts))}</span>}
            <DeleteButton label={copy.profile.deleteLabel(copy.profile.household)} onClick={() => void deleteKinds(HOUSEHOLD)} disabled={del.isPending} />
          </>
        ) : (
          <>
            <span className="text-ink-muted">{copy.profile.householdEmpty}</span>
            <TellButton onClick={() => onAsk(copy.profile.start.household)} />
          </>
        )}
        {p.pending_consent && <span className="nm-memory__note">{copy.profile.pendingConsent}</span>}
      </Row>

      <Row
        id={`${ids}-house`}
        icon={BuildingsIcon}
        label={copy.profile.house}
        empty={!house.length}
        open={open === "house"}
        onToggle={() => toggle("house")}
        summary={house.length ? <span className="truncate">{factsLine(house)}</span> : copy.profile.notTold}
      >
        {house.length ? (
          <>
            <Chips facts={house} />
            <DeleteButton label={copy.profile.deleteLabel(copy.profile.house)} onClick={() => void deleteKinds(HOUSE)} disabled={del.isPending} />
          </>
        ) : (
          <>
            <span className="text-ink-muted">{copy.profile.houseEmpty}</span>
            <TellButton onClick={() => onAsk(copy.profile.start.house)} />
          </>
        )}
      </Row>

      <Row
        id={`${ids}-line`}
        icon={BellIcon}
        label={copy.profile.line}
        empty={!p.line_linked}
        open={open === "line"}
        onToggle={() => toggle("line")}
        summary={p.line_linked ? copy.profile.lineOn : copy.profile.lineOff}
      >
        {p.line_linked ? (
          <span className="text-ink-muted">{copy.profile.lineLinked}</span>
        ) : (
          <>
            <span className="text-ink-muted">{copy.profile.lineNot}</span>
            {LINE_OA_URL && (
              <a className="nm-btn nm-btn--line nm-btn--sm self-start" href={LINE_OA_URL} target="_blank" rel="noreferrer">
                {copy.line.addFriend}
              </a>
            )}
          </>
        )}
        {!session && (
          <Link to="/account" className="inline-flex min-h-11 items-center font-semibold text-river">
            {copy.profile.signInToKeep}
          </Link>
        )}
      </Row>

      <div className="mt-auto flex flex-col gap-1 border-t border-line px-4 pt-3">
        <span className="text-caption text-ink-muted">{copy.profile.subtitle}</span>
        {del.isError && (
          <p className="nm-field-error m-0" role="alert">
            {copy.profile.deleteFailed}
          </p>
        )}
        {anything && <DeleteAll disabled={del.isPending} onConfirm={() => del.mutate({ facts: "all" })} />}
      </div>
    </>
  );
}

const DESKTOP = "(min-width: 64rem)"; // Tailwind lg: the column shows, the drawer must not

// Desktop column width, dragged by its right edge and remembered per browser.
const WIDTH_KEY = "namma.profile.width";
const MIN_W = 288;
const MAX_W = 520;
const DEFAULT_W = 344;
const clampWidth = (w: number) => Math.round(Math.min(MAX_W, Math.max(MIN_W, w)));

function useColumnWidth() {
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(WIDTH_KEY));
      return saved ? clampWidth(saved) : DEFAULT_W;
    } catch {
      return DEFAULT_W;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      // not remembered: fine
    }
  }, [width]);
  return [width, (w: number) => setWidth(clampWidth(w))] as const;
}

/**
 * The column's right edge: drag to resize (pointer capture, so the drag survives leaving the strip), arrow keys move it
 * 16 px, Home/End jump to the limits, double-click resets. A separator with its value, for screen readers.
 */
function ResizeHandle({ width, onResize, label }: { width: number; onResize: (w: number) => void; label: string }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const keys: Record<string, number> = { ArrowLeft: width - 16, ArrowRight: width + 16, Home: MIN_W, End: MAX_W };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={MIN_W}
      aria-valuemax={MAX_W}
      aria-valuenow={width}
      tabIndex={0}
      title={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: width };
        document.body.style.cursor = "col-resize";
      }}
      onPointerMove={(e) => start.current && onResize(start.current.w + e.clientX - start.current.x)}
      onPointerUp={() => {
        start.current = null;
        document.body.style.cursor = "";
      }}
      onLostPointerCapture={() => {
        start.current = null;
        document.body.style.cursor = "";
      }}
      onDoubleClick={() => onResize(DEFAULT_W)}
      onKeyDown={(e) => {
        if (!(e.key in keys)) return;
        e.preventDefault();
        onResize(keys[e.key]);
      }}
      className="group absolute inset-y-0 -right-1.5 z-10 flex w-3 cursor-col-resize touch-none justify-center focus-visible:outline-none"
    >
      <span className="h-full w-0.5 bg-transparent transition-colors group-hover:bg-river group-focus-visible:bg-river group-active:bg-river" />
    </div>
  );
}

/**
 * DS ProfilePanel, option C: what NamMa remembers as four rows that open (ที่ตั้ง, คนในบ้าน, บ้านและทรัพย์สิน, LINE).
 * Desktop: a slim column left of the chat, resizable by its right edge. Phones: the chat has the screen; `drawerOpen` slides the same rows in from
 * the left as a modal dialog (focus kept inside, Esc or the backdrop closes it), like a chat app's sidebar.
 * Every item can be deleted here (CLAUDE.md §7). Sensitive facts appear only after consent, with its date.
 */
export function ProfilePanel({
  chatSession,
  onAsk,
  drawerOpen,
  onCloseDrawer,
}: {
  chatSession: string;
  /** Start a sentence in the composer (an empty row's "บอกในแชท"). */
  onAsk: (start: string) => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}) {
  const profile = useProfile(chatSession);
  const [width, setWidth] = useColumnWidth();
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (drawerOpen && !d.open) d.showModal();
    if (!drawerOpen && d.open) d.close();
  }, [drawerOpen, profile.data]);

  // Widened to desktop with the drawer open: close it, the column shows the same thing.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const onChange = () => mq.matches && onCloseDrawer();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [onCloseDrawer]);

  const p = profile.data;
  if (!p) return null;
  const ask = (start: string) => {
    onCloseDrawer();
    onAsk(start);
  };

  return (
    <>
      <div className="relative hidden shrink-0 lg:flex" style={{ width }}>
        <aside aria-labelledby={`${headingId}-col`} className="flex w-full flex-col overflow-y-auto border-r border-line bg-surface-sunken py-4">
          <h2 id={`${headingId}-col`} className="m-0 mb-2 px-4 text-heading font-semibold">
            {copy.profile.title}
          </h2>
          <PanelBody profile={p} chatSession={chatSession} onAsk={ask} />
        </aside>
        <ResizeHandle width={width} onResize={setWidth} label={copy.profile.resize} />
      </div>

      <dialog
        ref={dialog}
        aria-labelledby={`${headingId}-drawer`}
        className="nm-drawer lg:hidden"
        onClose={onCloseDrawer}
        // A click on the dialog element itself is a click on the backdrop (the panel is its child).
        onClick={(e) => e.target === e.currentTarget && onCloseDrawer()}
      >
        {drawerOpen && (
          <div className="flex h-full flex-col overflow-y-auto pb-4">
            <div className="flex items-center justify-between gap-2 py-2 pr-2 pl-4">
              <h2 id={`${headingId}-drawer`} className="m-0 text-heading font-semibold">
                {copy.profile.title}
              </h2>
              <button
                type="button"
                onClick={onCloseDrawer}
                aria-label={copy.profile.close}
                title={copy.profile.close}
                className="inline-flex size-11 items-center justify-center rounded-md text-ink hover:bg-surface-raised"
              >
                <CloseIcon className="text-[22px]" />
              </button>
            </div>
            <PanelBody profile={p} chatSession={chatSession} onAsk={ask} />
          </div>
        )}
      </dialog>
    </>
  );
}
