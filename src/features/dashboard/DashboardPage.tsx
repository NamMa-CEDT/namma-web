import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError } from "../../api/client";
import { useTickets } from "../../api/queries";
import type { TicketStatus, TicketSummary } from "../../api/types";
import { canDemoLogin, loginDemo, logout, useSession } from "../../auth/session";
import { UsersIcon, ShieldIcon } from "../../components/icons";
import { useNow } from "../../components/Stale";
import { EmptyState, ErrorState, Loading } from "../../components/States";
import { copy } from "../../copy";
import { formatAge } from "../../lib/format";
import { URGENCY_RANK } from "../../lib/tiers";
import { Chips, StatusBadge, UrgencyBadge } from "./badges";
import { TicketDrawer } from "./TicketDrawer";

const TicketMap = lazy(() => import("./TicketMap"));

type FilterKey = keyof typeof copy.dashboard.filters;
const FILTERS: Record<FilterKey, TicketStatus[]> = {
  active: ["open", "acknowledged", "in_progress"],
  open: ["open"],
  in_progress: ["acknowledged", "in_progress"],
  closed: ["resolved", "cancelled"],
};

/** Most urgent first; within the same urgency, the one waiting longest first. */
export function sortTickets(list: TicketSummary[]): TicketSummary[] {
  return [...list].sort(
    (a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || Date.parse(a.created_at) - Date.parse(b.created_at),
  );
}

/** Leaflet can't live in a display:none box, so the overview map mounts only on large screens. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Ids that appeared since the last poll (not on first load or after a filter change). */
function useNewIds(list: TicketSummary[] | undefined, filter: FilterKey): Set<number> {
  const seen = useRef<{ filter: FilterKey; ids: Set<number> } | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!list) return;
    const ids = new Set(list.map((t) => t.id));
    if (seen.current && seen.current.filter === filter) {
      const added = [...ids].filter((id) => !seen.current!.ids.has(id));
      if (added.length) setFresh((prev) => new Set([...prev, ...added]));
    }
    seen.current = { filter, ids };
  }, [list, filter]);
  return fresh;
}

function LoginGate({ forbidden }: { forbidden: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <ShieldIcon className="mx-auto text-3xl text-brand-700" />
        <h1 className="mt-2 text-lg font-semibold">{copy.dashboard.loginTitle}</h1>
        <p className="mt-1 text-sm text-slate-600">{forbidden ? copy.dashboard.forbidden : copy.dashboard.loginBody}</p>
        {canDemoLogin ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await loginDemo("responder");
              } finally {
                setBusy(false);
              }
            }}
            className="mt-4 w-full rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {copy.dashboard.loginDemo}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled
              className="mt-4 w-full rounded-lg bg-[#06c755] px-4 py-2.5 font-semibold text-white opacity-60"
            >
              {copy.dashboard.loginLine}
            </button>
            <p className="mt-2 text-xs text-slate-500">{copy.dashboard.loginNotReady}</p>
          </>
        )}
      </div>
    </div>
  );
}

function TicketRow({
  t,
  selected,
  isNew,
  now,
  onSelect,
}: {
  t: TicketSummary;
  selected: boolean;
  isNew: boolean;
  now: number;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected || undefined}
        className={`w-full border-b border-slate-100 px-4 py-3 text-left ${
          selected ? "bg-brand-50" : "hover:bg-slate-50"
        } ${isNew ? "flash-new" : ""}`}
      >
        <div className="flex items-center gap-2">
          <UrgencyBadge urgency={t.urgency} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.place_label ?? copy.dashboard.noLocation}</span>
          <span className="shrink-0 text-xs text-slate-500">{formatAge(t.created_at, now)}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">#{t.id}</span>
          <StatusBadge status={t.status} />
          <span className="flex items-center gap-1 text-xs text-slate-600">
            <UsersIcon />
            {copy.dashboard.people(t.people_count)}
          </span>
          {isNew && <span className="rounded bg-amber-300 px-1.5 text-xs font-semibold text-amber-950">ใหม่</span>}
        </div>
        {t.vulnerable.length > 0 && (
          <div className="mt-1.5">
            <Chips items={t.vulnerable} kind="vulnerable" />
          </div>
        )}
      </button>
    </li>
  );
}

function Dashboard() {
  const [filter, setFilter] = useState<FilterKey>("active");
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("ticket") ? Number(params.get("ticket")) : null;
  const tickets = useTickets(FILTERS[filter]);
  const fresh = useNewIds(tickets.data, filter);
  const now = useNow(30_000);
  const [toast, setToast] = useState<number | null>(null);
  const sorted = useMemo(() => sortTickets(tickets.data ?? []), [tickets.data]);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const select = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id == null) next.delete("ticket");
    else next.set("ticket", String(id));
    setParams(next);
  };

  // Toast + tab title for the newest arrival.
  const newest = [...fresh].sort((a, b) => b - a)[0];
  useEffect(() => {
    if (newest == null) return;
    setToast(newest);
    const prevTitle = document.title;
    document.title = `(${fresh.size}) ${copy.dashboard.newTicket}`;
    const timer = setTimeout(() => setToast(null), 10_000);
    return () => {
      clearTimeout(timer);
      document.title = prevTitle;
    };
  }, [newest, fresh.size]);

  const authStatus = tickets.error instanceof ApiError ? tickets.error.status : null;
  useEffect(() => {
    if (authStatus === 401) logout(); // session expired: back to the login gate
  }, [authStatus]);
  if (authStatus === 401 || authStatus === 403) return <LoginGate forbidden={authStatus === 403} />;

  return (
    <div className="flex h-full">
      <section className="flex w-full min-w-0 flex-col border-r border-slate-200 bg-white lg:w-[440px] lg:flex-none">
        <header className="border-b border-slate-200 px-4 pt-3">
          <h1 className="text-lg font-semibold">{copy.dashboard.title}</h1>
          <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">{copy.dashboard.banner}</p>
          <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto" role="tablist">
            {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${
                  filter === k ? "border-brand-700 text-brand-800" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {copy.dashboard.filters[k]}
              </button>
            ))}
          </div>
        </header>
        <div className={`min-h-0 flex-1 overflow-y-auto transition-opacity ${tickets.isPlaceholderData ? "opacity-60" : ""}`}>
          {tickets.isPending ? (
            <Loading />
          ) : tickets.isError ? (
            <ErrorState error={tickets.error} onRetry={() => tickets.refetch()} />
          ) : sorted.length === 0 ? (
            <EmptyState>{copy.dashboard.empty}</EmptyState>
          ) : (
            <ul>
              {sorted.map((t) => (
                <TicketRow
                  key={t.id}
                  t={t}
                  now={now}
                  selected={t.id === selectedId}
                  isNew={fresh.has(t.id)}
                  onSelect={() => select(t.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {isDesktop && (
        <section className="relative min-w-0 flex-1">
          <Suspense fallback={<Loading className="h-full" />}>
            <TicketMap tickets={sorted} selectedId={selectedId} onSelect={select} />
          </Suspense>
        </section>
      )}

      {selectedId != null && (
        <div className="fixed inset-0 z-[1100] bg-white lg:absolute lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[420px] lg:border-l lg:border-slate-200 lg:shadow-xl">
          <TicketDrawer id={selectedId} onClose={() => select(null)} />
        </div>
      )}

      {toast != null && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-[1200] mx-auto max-w-sm sm:bottom-12">
          <button
            type="button"
            onClick={() => {
              select(toast);
              setToast(null);
            }}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-left text-sm text-white shadow-lg"
          >
            <span className="font-semibold">{copy.dashboard.newTicket}</span> #{toast} · แตะเพื่อดู
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const session = useSession();
  if (!session) return <LoginGate forbidden={false} />;
  if (session.role !== "responder") return <LoginGate forbidden />;
  return <Dashboard />;
}
