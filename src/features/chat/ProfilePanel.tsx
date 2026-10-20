import { useEffect, useId, useRef, useState, type ComponentType, type FormEvent, type MouseEvent, type ReactNode, type Ref } from "react";
import { Link } from "react-router";
import { useSession } from "../../auth/session";
import { ApiError } from "../../api/client";
import { useDeleteFromProfile, useProfile, useRenameInProfile } from "../../api/queries";
import type { Fact, FactKind, Profile, SavedPlace } from "../../api/types";
import { BellIcon, BuildingsIcon, CaretRightIcon, CloseIcon, HouseIcon, PencilIcon, TrashIcon, UsersIcon } from "../../components/icons";
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

/**
 * The ask-first step, as a bar under what it deletes: the question, then ยกเลิก and ลบ (beside it, or under it when
 * narrow). A stray tap on a trash icon never deletes. Opened from the keyboard, focus lands on ยกเลิก; Esc cancels.
 */
function ConfirmBar({
  question,
  confirm,
  onConfirm,
  onCancel,
  disabled,
  autoFocus,
  className = "border-t border-line pt-3",
}: {
  question: string;
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled: boolean;
  /** Only for keyboard use: a script focus after a tap would draw the focus ring on ยกเลิก. */
  autoFocus: boolean;
  className?: string;
}) {
  const cancelBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocus) cancelBtn.current?.focus();
  }, [autoFocus]);
  return (
    <div
      role="group"
      aria-label={question}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className={`nm-confirm-in flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}
    >
      <p className="m-0 min-w-0 grow basis-40 text-caption text-ink">{question}</p>
      <div className="ml-auto flex shrink-0 gap-1.5">
        <button ref={cancelBtn} type="button" onClick={onCancel} className="nm-btn nm-btn--secondary min-h-9 px-3 py-1 text-caption">
          {copy.profile.cancel}
        </button>
        <button type="button" disabled={disabled} onClick={onConfirm} className="nm-btn nm-btn--danger min-h-9 px-3 py-1 text-caption">
          {confirm}
        </button>
      </div>
    </div>
  );
}

/**
 * The rename step, a bar like ConfirmBar: one box per name (a chip can hold several, "ยาย, ตา"), then ยกเลิก and
 * บันทึก. The first box takes focus with its text selected; Enter saves, Esc cancels. Stays open on an error.
 */
function RenameBar({
  names,
  maxLength,
  onSave,
  onCancel,
  className = "border-t border-line pt-3",
}: {
  names: string[];
  maxLength: number;
  /** Rejects with the ApiError to show; resolves once saved (the parent then closes the bar). */
  onSave: (values: string[]) => Promise<void>;
  onCancel: () => void;
  className?: string;
}) {
  const [values, setValues] = useState(names);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const errorId = useId();
  useEffect(() => {
    first.current?.focus();
    first.current?.select();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = values.map((v) => v.trim().replace(/\s+/g, " "));
    if (clean.some((v) => !v)) {
      setError(copy.profile.nameEmpty);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(clean);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? copy.profile.nameTaken : copy.profile.renameFailed);
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault(); // not the phone drawer's Esc too
        onCancel();
      }}
      className={`nm-confirm-in flex flex-col gap-2 ${className}`}
    >
      {values.map((v, i) => (
        <input
          key={i}
          ref={i === 0 ? first : undefined}
          value={v}
          maxLength={maxLength}
          onChange={(e) => setValues((vs) => vs.map((x, j) => (j === i ? e.target.value : x)))}
          aria-label={names.length > 1 ? `${copy.profile.renameField} (${names[i]})` : copy.profile.renameField}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          // 16 px: smaller text makes iOS zoom the page on focus.
          className="min-h-10 w-full min-w-0 rounded-md border border-line-strong bg-surface-raised px-3 text-[16px] text-ink"
        />
      ))}
      {error && (
        <p id={errorId} role="alert" className="nm-field-error m-0">
          {error}
        </p>
      )}
      <div className="ml-auto flex shrink-0 gap-1.5">
        <button type="button" onClick={onCancel} className="nm-btn nm-btn--secondary min-h-9 px-3 py-1 text-caption">
          {copy.profile.cancel}
        </button>
        <button type="submit" disabled={saving} className="nm-btn nm-btn--primary min-h-9 px-3 py-1 text-caption">
          {copy.profile.save}
        </button>
      </div>
    </form>
  );
}

/**
 * One item's ask-first state. Opened from the keyboard (a key press on a button is a click with detail 0), focus goes
 * to ยกเลิก and, once the bar closes, back to the trash icon; a tap moves focus nowhere, so no focus ring appears.
 */
function useAsk() {
  const [asking, setAsking] = useState(false);
  const [byKeyboard, setByKeyboard] = useState(false);
  const trash = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);
  useEffect(() => {
    if (!asking && wasAsking.current && byKeyboard) trash.current?.focus();
    wasAsking.current = asking;
  }, [asking, byKeyboard]);
  const toggle = (e: MouseEvent) => {
    setByKeyboard(e.detail === 0);
    setAsking(!asking);
  };
  return { asking, byKeyboard, toggle, close: () => setAsking(false), trash };
}

/** 44 px to tap, drawn as a 20 px icon; `className` nudges it so the icon, not the box, lines up with the text. */
function TrashButton({
  label,
  onClick,
  disabled,
  asking,
  className = "",
  ref,
}: {
  label: string;
  onClick: (e: MouseEvent) => void;
  disabled: boolean;
  asking: boolean;
  className?: string;
  ref: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-expanded={asking}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface-raised hover:text-ink disabled:pointer-events-none disabled:opacity-40 ${asking ? "bg-surface-raised text-ink" : "text-ink-muted"} ${className}`}
    >
      <TrashIcon className="text-[20px]" />
    </button>
  );
}

/** Deletes a whole row (คนในบ้าน, บ้านและทรัพย์สิน): the trash icon under its chips turns into the confirm bar. */
function DeleteFacts({ what, onConfirm, disabled }: { what: string; onConfirm: () => void; disabled: boolean }) {
  const { asking, byKeyboard, toggle, close, trash } = useAsk();
  if (!asking) {
    return <TrashButton ref={trash} label={copy.profile.deleteLabel(what)} onClick={toggle} disabled={disabled} asking={false} className="-ml-3 self-start" />;
  }
  return (
    <ConfirmBar
      question={copy.profile.deleteAsk(what)}
      confirm={copy.profile.delete}
      disabled={disabled}
      autoFocus={byKeyboard}
      onCancel={close}
      onConfirm={() => {
        close();
        onConfirm();
      }}
    />
  );
}

/**
 * ลบข้อมูลทั้งหมด, with the same confirm bar and a plain warning that it cannot be undone. The asking state
 * lives in ChatPage, so the /forget command can open this step too.
 */
function DeleteAll({ onConfirm, disabled, asking, setAsking }: { onConfirm: () => void; disabled: boolean } & ForgetAsk) {
  if (!asking) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAsking(true)}
        className="min-h-11 self-start text-caption text-ink-muted underline hover:text-ink disabled:pointer-events-none disabled:opacity-40"
      >
        {copy.profile.deleteAll}
      </button>
    );
  }
  // Also opened by typing /forget, so ยกเลิก takes focus as before.
  return (
    <ConfirmBar
      question={copy.profile.deleteAllConfirm}
      confirm={copy.profile.deleteAll}
      disabled={disabled}
      autoFocus
      className="py-2"
      onCancel={() => setAsking(false)}
      onConfirm={() => {
        setAsking(false);
        onConfirm();
      }}
    />
  );
}

/**
 * DS SavedPlace: the tier badge belongs to the station, so the station is named next to it.
 * The name is a button (pencil after it) that opens the rename bar; the trash icon stays in the corner. Either bar
 * opens across the bottom of the card, one at a time.
 */
function Place({
  place,
  onDelete,
  onRename,
  busy,
}: {
  place: SavedPlace;
  onDelete: () => void;
  onRename: (label: string) => Promise<unknown>;
  busy: boolean;
}) {
  const n = place.nearest;
  const { asking, byKeyboard, toggle, close, trash } = useAsk();
  const [renaming, setRenaming] = useState(false);
  return (
    <div className="nm-place">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => {
              close();
              setRenaming(!renaming);
            }}
            aria-label={copy.profile.renameLabel(place.label)}
            aria-expanded={renaming}
            title={copy.profile.renameLabel(place.label)}
            // items-start + nudges: a long name wraps in the narrow column, and the icons stay on its first line.
            className="nm-place__label group -mx-1 max-w-full items-start rounded-sm px-1 text-left hover:bg-surface-raised/70"
          >
            <span className="nm-house mt-1.5" />
            <span className="min-w-0 break-words">{place.label}</span>
            <PencilIcon className="mt-[5px] shrink-0 text-[15px] opacity-60 group-hover:opacity-100" />
          </button>
          {place.where && <div className="nm-place__where">{place.where}</div>}
        </div>
        {/* Pulled up and out so the badge and icon centre on the name's line, not below it. */}
        <div className="-mt-2.5 -mr-2 flex shrink-0 items-center gap-1">
          {n && <TierBadge tier={n.risk_tier ?? "unknown"} soft />}
          <TrashButton
            ref={trash}
            label={copy.profile.deleteLabel(place.label)}
            onClick={(e) => {
              setRenaming(false);
              toggle(e);
            }}
            disabled={busy}
            asking={asking}
          />
        </div>
      </div>
      {n && (
        <div className="nm-place__where num">
          {copy.profile.nearest} {n.name_th} ({n.code}) {copy.profile.away} {formatDistance(n.distance_km)} ·{" "}
          {formatBankGap(n.diff_wl_bank)}
        </div>
      )}
      {place.approx && <div className="nm-place__where">{copy.profile.approx}</div>}
      {renaming && (
        <RenameBar
          names={[place.label]}
          maxLength={40}
          onCancel={() => setRenaming(false)}
          onSave={async ([label]) => {
            if (label !== place.label) await onRename(label);
            setRenaming(false);
          }}
        />
      )}
      {asking && (
        <ConfirmBar
          question={copy.profile.deleteAsk(place.label)}
          confirm={copy.profile.delete}
          disabled={busy}
          autoFocus={byKeyboard}
          onCancel={close}
          onConfirm={() => {
            close();
            onDelete();
          }}
        />
      )}
    </div>
  );
}

const factKey = (f: Fact) => `${f.kind}:${f.text}`;

/**
 * The facts as chips. A chip that holds names the person gave (Fact.names: ยาย, a pet, a past flood) is a button with
 * a pencil; it opens the rename bar under the chips. Checklist facts (มีรถยนต์) have nothing to rename.
 */
function Chips({ facts, onRename }: { facts: Fact[]; onRename: (fact: Fact, names: string[]) => Promise<void> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const current = facts.find((f) => factKey(f) === editing);
  return (
    <>
      <div className="nm-row">
        {facts.map((f) =>
          f.list ? (
            <button
              key={factKey(f)}
              type="button"
              onClick={() => setEditing(editing === factKey(f) ? null : factKey(f))}
              aria-label={copy.profile.renameLabel(f.text)}
              aria-expanded={editing === factKey(f)}
              title={copy.profile.renameLabel(f.text)}
              className="nm-chip nm-chip--memory group cursor-pointer hover:ring-1 hover:ring-home/40"
            >
              {f.text}
              <PencilIcon className="shrink-0 text-[15px] opacity-60 group-hover:opacity-100" />
            </button>
          ) : (
            <span key={factKey(f)} className="nm-chip nm-chip--memory">
              {f.text}
            </span>
          ),
        )}
      </div>
      {current && (
        <RenameBar
          key={factKey(current)}
          names={current.names}
          maxLength={60}
          onCancel={() => setEditing(null)}
          onSave={async (names) => {
            await onRename(current, names);
            setEditing(null);
          }}
        />
      )}
    </>
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
type ForgetAsk = { asking: boolean; setAsking: (asking: boolean) => void };

function PanelBody({
  profile: p,
  chatSession,
  onAsk,
  forget,
}: {
  profile: Profile;
  chatSession: string;
  onAsk: (start: string) => void;
  forget: ForgetAsk;
}) {
  const del = useDeleteFromProfile(chatSession);
  const rename = useRenameInProfile(chatSession);
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
  // One PATCH per changed name (a chip like "ยาย, ตา" can change both).
  const renameNames = async (fact: Fact, names: string[]) => {
    for (const [i, to] of names.entries()) {
      if (fact.list && to !== fact.names[i]) await rename.mutateAsync({ list: fact.list, from: fact.names[i], to });
    }
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
          p.places.map((pl) => (
            <Place
              key={pl.id}
              place={pl}
              busy={del.isPending}
              onDelete={() => del.mutate({ place: pl.id })}
              onRename={(label) => rename.mutateAsync({ place: pl.id, label })}
            />
          ))
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
            <Chips facts={household} onRename={renameNames} />
            {p.consent.granted && p.consent.ts && <span className="nm-memory__note">{copy.profile.consentNote(formatDate(p.consent.ts))}</span>}
            <DeleteFacts what={copy.profile.household} onConfirm={() => void deleteKinds(HOUSEHOLD)} disabled={del.isPending} />
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
            <Chips facts={house} onRename={renameNames} />
            <DeleteFacts what={copy.profile.house} onConfirm={() => void deleteKinds(HOUSE)} disabled={del.isPending} />
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
        {anything && <DeleteAll disabled={del.isPending} onConfirm={() => del.mutate({ facts: "all" })} {...forget} />}
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
  forget,
}: {
  chatSession: string;
  /** Start a sentence in the composer (an empty row's "บอกในแชท"). */
  onAsk: (start: string) => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  /** The ลบข้อมูลทั้งหมด confirm step, open or not. */
  forget: ForgetAsk;
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
        <aside id="profile-panel" tabIndex={-1} aria-labelledby={`${headingId}-col`} className="flex w-full flex-col overflow-y-auto border-r border-line bg-surface-sunken py-4">
          <h2 id={`${headingId}-col`} className="m-0 mb-2 px-4 text-heading font-semibold">
            {copy.profile.title}
          </h2>
          <PanelBody profile={p} chatSession={chatSession} onAsk={ask} forget={forget} />
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
            <PanelBody profile={p} chatSession={chatSession} onAsk={ask} forget={forget} />
          </div>
        )}
      </dialog>
    </>
  );
}
