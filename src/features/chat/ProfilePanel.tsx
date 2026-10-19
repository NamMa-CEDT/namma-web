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

function DeleteButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised hover:text-ink"
    >
      <TrashIcon className="text-[20px]" />
    </button>
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
        <div className="flex items-center gap-1">
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
        {anything && (
          <button
            type="button"
            disabled={del.isPending}
            onClick={() => del.mutate({ facts: "all" })}
            className="min-h-11 self-start text-caption text-ink-muted underline hover:text-ink"
          >
            {copy.profile.deleteAll}
          </button>
        )}
      </div>
    </>
  );
}

const DESKTOP = "(min-width: 64rem)"; // Tailwind lg: the column shows, the drawer must not

/**
 * DS ProfilePanel, option C: what NamMa remembers as four rows that open (ที่ตั้ง, คนในบ้าน, บ้านและทรัพย์สิน, LINE).
 * Desktop: a slim column left of the chat. Phones: the chat has the screen; `drawerOpen` slides the same rows in from
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
      <aside aria-labelledby={`${headingId}-col`} className="hidden w-[18rem] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface-sunken py-4 lg:flex">
        <h2 id={`${headingId}-col`} className="m-0 mb-2 px-4 text-heading font-semibold">
          {copy.profile.title}
        </h2>
        <PanelBody profile={p} chatSession={chatSession} onAsk={ask} />
      </aside>

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
