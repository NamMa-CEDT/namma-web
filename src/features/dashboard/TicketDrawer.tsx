import { lazy, Suspense, useState } from "react";
import { ApiError } from "../../api/client";
import { useNearest, usePatchTicket, useShelters, useTicket } from "../../api/queries";
import type { RescueTicket, TicketStatus } from "../../api/types";
import { CloseIcon, PhoneIcon, PinIcon, UsersIcon } from "../../components/icons";
import { ErrorState, Loading } from "../../components/States";
import { TierBadge } from "../../components/TierBadge";
import { copy } from "../../copy";
import { formatAge, formatBankGap, formatDateTime, formatDistance } from "../../lib/format";
import { stationTier } from "../../lib/tiers";
import { StationName } from "../map/StationSheet";
import { Chips, StatusBadge, UrgencyBadge } from "./badges";

const TicketMap = lazy(() => import("./TicketMap"));

const NEXT: Record<TicketStatus, TicketStatus[]> = {
  open: ["acknowledged", "in_progress"],
  acknowledged: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["open"],
  cancelled: ["open"],
};

// Button labels say what happens (DS Button): Thai verb phrases.
const ACTION_LABEL: Partial<Record<TicketStatus, string>> = {
  acknowledged: "รับเรื่อง",
  in_progress: "ออกเดินทาง",
  resolved: "ช่วยเหลือแล้ว",
  open: "เปิดเรื่องอีกครั้ง",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-line py-3">
      <h3 className="m-0 text-caption font-semibold text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

function NearbyInfo({ t }: { t: RescueTicket }) {
  const point = t.lat != null && t.lon != null ? { lat: t.lat, lon: t.lon } : null;
  const needsCare = t.vulnerable.some((v) => v === "bedridden" || v === "patient");
  const near = useNearest(point, 1);
  const shelters = useShelters(point, needsCare);
  if (!point) return null;
  const s = near.data?.[0];
  return (
    <>
      <Section title={copy.dashboard.nearestStation}>
        {s ? (
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-body font-semibold">
                <StationName name={s.name_th} code={s.oldcode} />
              </span>
              <span className="num block text-caption text-ink-muted">
                ห่าง {formatDistance(s.distance_km)} · {formatBankGap(s.latest?.diff_wl_bank)}
              </span>
            </span>
            <TierBadge tier={stationTier(s)} soft />
          </div>
        ) : (
          <Loading />
        )}
      </Section>
      <Section title={needsCare ? copy.dashboard.sheltersPatients : copy.dashboard.shelters}>
        <ul className="m-0 grid list-none gap-1 p-0">
          {(shelters.data ?? []).slice(0, 3).map((sh) => (
            <li key={sh.id} className="flex justify-between gap-3 rounded-sm bg-home-soft px-3 py-2 text-body">
              <span className="min-w-0 font-semibold text-home">{sh.name}</span>
              <span className="num shrink-0 text-caption text-ink-muted">{formatDistance(sh.distance_km)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

export function TicketDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const ticket = useTicket(id);
  const patch = usePatchTicket();
  const [message, setMessage] = useState<string | null>(null);

  if (ticket.isPending) return <Loading className="h-full" />;
  if (ticket.isError) return <ErrorState className="h-full" error={ticket.error} onRetry={() => ticket.refetch()} />;
  const t = ticket.data;

  const setStatus = (status: TicketStatus) => {
    setMessage(null);
    patch.mutate(
      { id: t.id, patch: { status, updated_at: t.updated_at } },
      {
        onError: (e) =>
          setMessage(e instanceof ApiError && e.status === 409 ? copy.dashboard.conflict : copy.dashboard.saveFailed),
      },
    );
  };

  return (
    <article className="flex h-full flex-col bg-surface-raised">
      <header className="flex items-start gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 font-mono text-heading font-medium">#{t.id}</h2>
            <UrgencyBadge urgency={t.urgency} />
            <StatusBadge status={t.status} />
          </div>
          <p className="num m-0 mt-0.5 text-caption text-ink-muted">
            {formatDateTime(t.created_at)} ({formatAge(t.created_at)}) · ผ่าน {copy.dashboard.channel[t.channel]}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.map.close}
          className="grid size-11 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken"
        >
          <CloseIcon className="text-[22px]" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <Section title={copy.dashboard.message}>
          <blockquote className="m-0 rounded-sm bg-surface-sunken p-3 text-body-lg">“{t.raw_text}”</blockquote>
        </Section>

        <Section title={copy.dashboard.location}>
          <p className="m-0 flex items-center gap-2 text-body">
            <PinIcon className="shrink-0 text-[20px] text-ink-muted" />
            {t.place_label ?? copy.dashboard.noLocation}
          </p>
          {t.lat != null && t.lon != null && (
            <>
              <div className="h-40 overflow-hidden rounded-sm border border-line">
                <Suspense fallback={<Loading />}>
                  <TicketMap tickets={[t]} selectedId={t.id} interactive={false} />
                </Suspense>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lon}`}
                target="_blank"
                rel="noreferrer"
                className="num inline-flex min-h-11 items-center text-caption text-river underline"
              >
                {t.lat.toFixed(5)}, {t.lon.toFixed(5)} · {copy.dashboard.openInMaps}
              </a>
            </>
          )}
        </Section>

        <Section title={copy.dashboard.people_}>
          <p className="m-0 flex items-center gap-2 text-body">
            <UsersIcon className="text-[20px] text-ink-muted" />
            {copy.dashboard.people(t.people_count)}
          </p>
          <Chips items={t.vulnerable} kind="vulnerable" />
        </Section>

        <Section title={copy.dashboard.needs}>
          <Chips items={t.needs} kind="needs" />
        </Section>

        {(t.contact_phone || t.assignee || t.notes) && (
          <Section title={copy.dashboard.contact}>
            {t.contact_phone && (
              <a href={`tel:${t.contact_phone}`} className="num inline-flex min-h-11 items-center gap-2 text-body font-semibold text-river underline">
                <PhoneIcon className="text-[20px]" />
                {t.contact_phone}
              </a>
            )}
            {t.assignee && (
              <p className="m-0 text-body">
                {copy.dashboard.assignee}: {t.assignee}
              </p>
            )}
            {t.notes && <p className="m-0 text-caption whitespace-pre-line text-ink-muted">{t.notes}</p>}
          </Section>
        )}

        <NearbyInfo t={t} />
      </div>

      <footer className="pb-safe border-t border-line bg-surface-sunken px-4 py-3">
        {message && (
          <p role="alert" className="nm-field-error m-0 mb-2">
            {message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {NEXT[t.status].map((s) => (
            <button
              key={s}
              type="button"
              disabled={patch.isPending}
              onClick={() => setStatus(s)}
              // DS: the danger button is only for responder actions on an urgent ticket.
              className={`nm-btn flex-1 ${t.urgency === "critical" && s !== "open" ? "nm-btn--danger" : "nm-btn--primary"}`}
            >
              {ACTION_LABEL[s]}
            </button>
          ))}
          {t.status !== "cancelled" && t.status !== "resolved" && (
            <button
              type="button"
              disabled={patch.isPending}
              onClick={() => setStatus("cancelled")}
              className="nm-btn nm-btn--secondary"
            >
              {copy.dashboard.cancel}
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}
