import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError } from "../../api/client";
import { useTickets } from "../../api/queries";
import type { TicketStatus, TicketSummary } from "../../api/types";
import { canDemoLogin, loginDemo, logout, useSession } from "../../auth/session";
import { ShieldIcon, UsersIcon } from "../../components/icons";
import { useNow } from "../../components/Stale";
import { EmptyState, ErrorState, Loading } from "../../components/States";
import { copy } from "../../copy";
import { formatAge, formatDateTime } from "../../lib/format";
import { URGENCY_RANK } from "../../lib/tiers";
import { LineIcon } from "../../components/icons";
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

/** The responder dashboard runs in the dark theme for long shifts (DS Surfaces). */
function useDarkTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.dataset.theme;
    root.dataset.theme = "dark";
    return () => {
      if (prev) root.dataset.theme = prev;
      else delete root.dataset.theme;
    };
  }, []);
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
    <div className="flex h-full items-center justify-center p-4">
      <div className="grid w-full max-w-sm gap-3 rounded-md border border-line bg-surface-raised p-6 text-center">
        <ShieldIcon className="mx-auto text-[32px] text-river" />
        <h1 className="m-0 text-title font-semibold">{copy.dashboard.loginTitle}</h1>
        <p className="m-0 text-body text-ink-muted">{forbidden ? copy.dashboard.forbidden : copy.dashboard.loginBody}</p>
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
            className="nm-btn nm-btn--primary nm-btn--block"
          >
            {copy.dashboard.loginDemo}
          </button>
        ) : (
          <>
            <button type="button" disabled className="nm-btn nm-btn--line nm-btn--block" aria-disabled="true">
              <LineIcon className="text-[22px]" />
              {copy.dashboard.loginLine}
            </button>
            <p className="m-0 text-caption text-ink-muted">{copy.dashboard.loginNotReady}</p>
          </>
        )}
      </div>
    </div>
  );
}

/** DS TicketRow: the person's own words first, urgency as stripe + word + shape. */
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
  const level = t.urgency === "critical" ? "nm-ticket--urgent" : t.urgency === "high" ? "nm-ticket--high" : "";
  return (
    <li>
      <button type="button" onClick={onSelect} aria-current={selected || undefined} className={`nm-ticket ${level}`}>
        <span className="nm-ticket__stripe" aria-hidden="true" />
        <span className="nm-ticket__main">
          <span className="flex flex-wrap items-center gap-2">
            <UrgencyBadge urgency={t.urgency} />
            <span className="min-w-0 truncate text-label font-semibold">{t.place_label ?? copy.dashboard.noLocation}</span>
          </span>
          <span className="nm-ticket__meta">
            <span className="nm-ticket__id">#{t.id}</span>
            <span className="inline-flex items-center gap-1">
              <UsersIcon className="text-[16px]" />
              {copy.dashboard.people(t.people_count)}
            </span>
            {isNew && <span className="font-semibold text-river">{copy.dashboard.newTag}</span>}
          </span>
          {t.vulnerable.length > 0 && <Chips items={t.vulnerable} kind="vulnerable" />}
        </span>
        <span className="nm-ticket__side">
          <span className="num text-caption text-ink-muted" title={formatDateTime(t.created_at)}>
            {formatAge(t.created_at, now)}
          </span>
          <StatusBadge status={t.status} />
        </span>
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
    if (authStatus === 401) void logout(); // session expired: back to the login gate
  }, [authStatus]);
  if (authStatus === 401 || authStatus === 403) return <LoginGate forbidden={authStatus === 403} />;

  return (
    <div className="flex h-full">
      <section className="flex w-full min-w-0 flex-col border-r border-line bg-surface-raised lg:w-[460px] lg:flex-none">
        <header className="border-b border-line px-4 pt-4">
          <h1 className="m-0 text-title font-semibold">{copy.dashboard.title}</h1>
          <p className="m-0 mt-1 rounded-sm bg-surface-sunken px-3 py-1.5 text-caption text-ink-muted">{copy.dashboard.banner}</p>
          <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist">
            {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={`min-h-11 shrink-0 border-b-2 px-3 text-label font-semibold ${
                  filter === k ? "border-river text-river" : "border-transparent text-ink-muted hover:text-ink"
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
            <ul className="m-0 list-none p-0">
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
        <div className="fixed inset-0 z-[1100] bg-surface-raised lg:absolute lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[440px] lg:border-l lg:border-line lg:shadow-float">
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
            className="min-h-12 w-full rounded-md border border-line-strong bg-surface-raised px-4 py-3 text-left text-body text-ink shadow-float"
          >
            <span className="font-semibold">{copy.dashboard.newTicket}</span> <span className="nm-code">#{toast}</span> ·{" "}
            {copy.dashboard.tapToView}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  useDarkTheme();
  const session = useSession();
  if (!session) return <LoginGate forbidden={false} />;
  if (session.role !== "responder") return <LoginGate forbidden />;
  return <Dashboard />;
}
