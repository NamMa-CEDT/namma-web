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
import { Chips, StatusBadge, UrgencyBadge } from "./badges";

const TicketMap = lazy(() => import("./TicketMap"));

const NEXT: Record<TicketStatus, TicketStatus[]> = {
  open: ["acknowledged", "in_progress"],
  acknowledged: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["open"],
  cancelled: ["open"],
};

const ACTION_LABEL: Partial<Record<TicketStatus, string>> = {
  acknowledged: "รับเรื่อง",
  in_progress: "เริ่มช่วยเหลือ",
  resolved: "ช่วยเหลือแล้ว",
  open: "เปิดเรื่องใหม่",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 py-3">
      <h3 className="mb-1.5 text-xs font-semibold text-slate-500">{title}</h3>
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
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>
              <span className="font-semibold">{s.oldcode}</span> {s.name_th}
              <span className="block text-xs text-slate-500">
                ห่าง {formatDistance(s.distance_km)} · {formatBankGap(s.latest?.diff_wl_bank)}
              </span>
            </span>
            <TierBadge tier={stationTier(s)} size="sm" />
          </div>
        ) : (
          <Loading />
        )}
      </Section>
      <Section title={needsCare ? copy.dashboard.sheltersPatients : copy.dashboard.shelters}>
        <ul className="space-y-1 text-sm">
          {(shelters.data ?? []).slice(0, 3).map((sh) => (
            <li key={sh.id} className="flex justify-between gap-2">
              <span className="min-w-0">{sh.name}</span>
              <span className="num shrink-0 text-xs text-slate-500">{formatDistance(sh.distance_km)}</span>
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
    <article className="flex h-full flex-col bg-white">
      <header className="flex items-start gap-2 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">#{t.id}</h2>
            <UrgencyBadge urgency={t.urgency} />
            <StatusBadge status={t.status} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDateTime(t.created_at)} ({formatAge(t.created_at)}) · ผ่าน {copy.dashboard.channel[t.channel]}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.map.close}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <Section title={copy.dashboard.message}>
          <blockquote className="rounded-lg bg-slate-50 p-3 text-base leading-relaxed">{t.raw_text}</blockquote>
        </Section>

        <Section title="ตำแหน่ง">
          <p className="flex items-center gap-1.5 text-sm">
            <PinIcon className="shrink-0 text-slate-500" />
            {t.place_label ?? copy.dashboard.noLocation}
          </p>
          {t.lat != null && t.lon != null && (
            <>
              <div className="mt-2 h-40 overflow-hidden rounded-lg border border-slate-200">
                <Suspense fallback={<Loading />}>
                  <TicketMap tickets={[t]} selectedId={t.id} interactive={false} />
                </Suspense>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lon}`}
                target="_blank"
                rel="noreferrer"
                className="num mt-1 inline-block text-xs text-brand-700 underline"
              >
                {t.lat.toFixed(5)}, {t.lon.toFixed(5)} · เปิดใน Google Maps
              </a>
            </>
          )}
        </Section>

        <Section title="ผู้ประสบภัย">
          <p className="mb-2 flex items-center gap-1.5 text-sm">
            <UsersIcon className="text-slate-500" />
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
              <a href={`tel:${t.contact_phone}`} className="flex items-center gap-1.5 text-sm text-brand-700 underline">
                <PhoneIcon />
                {t.contact_phone}
              </a>
            )}
            {t.assignee && <p className="mt-1 text-sm">ผู้รับผิดชอบ: {t.assignee}</p>}
            {t.notes && <p className="mt-1 text-xs whitespace-pre-line text-slate-600">{t.notes}</p>}
          </Section>
        )}

        <NearbyInfo t={t} />
      </div>

      <footer className="pb-safe border-t border-slate-200 bg-slate-50 px-4 py-3">
        {message && (
          <p role="alert" className="mb-2 text-sm text-red-700">
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
              className="flex-1 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {ACTION_LABEL[s]}
            </button>
          ))}
          {t.status !== "cancelled" && t.status !== "resolved" && (
            <button
              type="button"
              disabled={patch.isPending}
              onClick={() => setStatus("cancelled")}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              ยกเลิก
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}
