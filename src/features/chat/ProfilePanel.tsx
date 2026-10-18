import { useState } from "react";
import { useDeleteFromProfile, useProfile } from "../../api/queries";
import type { Fact, FactKind, Profile, SavedPlace } from "../../api/types";
import { TrashIcon } from "../../components/icons";
import { TierBadge } from "../../components/TierBadge";
import { copy } from "../../copy";
import { formatBankGap, formatDate, formatDistance } from "../../lib/format";
import { LINE_OA_URL } from "../../lib/line";

type Step = { key: "place" | "household" | "consent" | "line"; done: boolean };

/** DS ProfilePanel meter: ที่ตั้ง → คนในบ้าน → ยินยอม → LINE, the order the first conversation collects them. */
export function setupSteps(p: Profile): Step[] {
  const decided = p.consent.ts != null;
  return [
    { key: "place", done: p.places.length > 0 },
    { key: "household", done: p.facts.some((f) => f.kind === "household" || f.kind === "needs") || decided },
    { key: "consent", done: decided },
    { key: "line", done: p.line_linked },
  ];
}

function Meter({ profile }: { profile: Profile }) {
  const steps = setupSteps(profile);
  const now = steps.findIndex((s) => !s.done);
  return (
    <ol className="nm-meter" aria-label={copy.profile.title}>
      {steps.map((s, i) => (
        <li key={s.key} className={s.done ? "is-done" : i === now ? "is-now" : undefined} aria-current={i === now ? "step" : undefined}>
          {copy.profile.steps[s.key]}
          {s.done && <span className="nm-sr"> {copy.profile.done}</span>}
        </li>
      ))}
    </ol>
  );
}

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

function Section({
  title,
  onDelete,
  deleteLabel,
  busy,
  children,
}: {
  title: string;
  onDelete?: () => void;
  deleteLabel?: string;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="nm-memory__section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="nm-memory__label">{title}</h3>
        {onDelete && <DeleteButton label={deleteLabel ?? copy.profile.delete} onClick={onDelete} disabled={busy} />}
      </div>
      {children}
    </section>
  );
}

const HOUSEHOLD: FactKind[] = ["household", "needs"];
const HOUSE: FactKind[] = ["house", "assets", "history"];

/**
 * DS ProfilePanel: what NamMa remembers, beside the chat while the first conversation collects it.
 * Desktop: a full-height column on surface-sunken. Phones: the meter plus a "ข้อมูลที่จำไว้" toggle.
 * Every item can be deleted here (CLAUDE.md §7). Sensitive facts appear only after consent, with its date.
 */
export function ProfilePanel({ chatSession }: { chatSession: string }) {
  const profile = useProfile(chatSession);
  const del = useDeleteFromProfile(chatSession);
  const [open, setOpen] = useState(false);
  const p = profile.data;
  if (!p) return null;

  const household = p.facts.filter((f) => HOUSEHOLD.includes(f.kind));
  const house = p.facts.filter((f) => HOUSE.includes(f.kind));
  const anything = p.places.length + p.facts.length > 0;
  const deleteKinds = async (kinds: FactKind[]) => {
    for (const k of kinds) await del.mutateAsync({ facts: k });
  };

  return (
    <aside
      aria-labelledby="profile-h"
      className={`nm-memory border-line bg-surface-sunken p-4 max-lg:max-h-[60%] max-lg:gap-3 max-lg:border-b lg:order-last lg:w-[22rem] lg:shrink-0 lg:border-l lg:px-7 lg:py-8 ${open ? "overflow-y-auto" : "lg:overflow-y-auto"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="nm-memory__title" id="profile-h">
            {copy.profile.title}
          </h2>
          <p className="nm-memory__sub max-lg:hidden">{copy.profile.subtitle}</p>
        </div>
        <button
          type="button"
          className="min-h-11 text-label font-semibold text-river lg:hidden"
          aria-expanded={open}
          aria-controls="profile-body"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? copy.profile.close : copy.profile.open}
        </button>
      </div>

      <Meter profile={p} />

      <div id="profile-body" className={`nm-memory ${open ? "" : "max-lg:hidden"}`}>
        <Section title={copy.profile.places} busy={del.isPending}>
          {p.places.length ? (
            p.places.map((pl) => (
              <Place key={pl.id} place={pl} busy={del.isPending} onDelete={() => del.mutate({ place: pl.id })} />
            ))
          ) : (
            <span className="nm-memory__empty">{copy.profile.placesEmpty}</span>
          )}
        </Section>

        <Section
          title={copy.profile.household}
          busy={del.isPending}
          onDelete={household.length ? () => void deleteKinds(HOUSEHOLD) : undefined}
          deleteLabel={copy.profile.deleteLabel(copy.profile.household)}
        >
          {household.length ? <Chips facts={household} /> : <span className="nm-memory__empty">{copy.profile.householdEmpty}</span>}
          {household.length > 0 && p.consent.granted && p.consent.ts && (
            <span className="nm-memory__note">{copy.profile.consentNote(formatDate(p.consent.ts))}</span>
          )}
          {p.pending_consent && <span className="nm-memory__note">{copy.profile.pendingConsent}</span>}
        </Section>

        <Section
          title={copy.profile.house}
          busy={del.isPending}
          onDelete={house.length ? () => void deleteKinds(HOUSE) : undefined}
          deleteLabel={copy.profile.deleteLabel(copy.profile.house)}
        >
          {house.length ? <Chips facts={house} /> : <span className="nm-memory__empty">{copy.profile.houseEmpty}</span>}
        </Section>

        <Section title={copy.profile.line} busy={del.isPending}>
          {p.line_linked ? (
            <span className="nm-memory__note">{copy.profile.lineLinked}</span>
          ) : (
            <>
              <span className="nm-memory__empty">{copy.profile.lineNot}</span>
              {LINE_OA_URL && (
                <a className="nm-btn nm-btn--line self-start" href={LINE_OA_URL} target="_blank" rel="noreferrer">
                  {copy.line.addFriend}
                </a>
              )}
            </>
          )}
        </Section>

        {del.isError && (
          <p className="nm-field-error m-0" role="alert">
            {copy.profile.deleteFailed}
          </p>
        )}
        {anything && (
          <button
            type="button"
            className="nm-btn nm-btn--secondary self-start"
            disabled={del.isPending}
            onClick={() => del.mutate({ facts: "all" })}
          >
            {copy.profile.deleteAll}
          </button>
        )}
      </div>
    </aside>
  );
}
