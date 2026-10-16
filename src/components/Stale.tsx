import { useEffect, useState } from "react";
import { useIngestedAt } from "../api/meta";
import { copy } from "../copy";
import { formatAge, isStale } from "../lib/format";
import { AlertIcon } from "./icons";

/** Re-render every minute so ages and staleness stay current. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function StaleBadge({ ts, agency }: { ts: string | null | undefined; agency: string | null }) {
  const now = useNow();
  if (!isStale(ts, agency, now)) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
      <AlertIcon className="text-[0.9em]" />
      {copy.stale.badge}
    </span>
  );
}

/** Global banner when the backend's last ThaiWater ingest is older than 30 min. */
export function StaleBanner() {
  const ingestedAt = useIngestedAt();
  const now = useNow();
  if (!ingestedAt || now - new Date(ingestedAt).getTime() < 30 * 60_000) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-amber-100 px-4 py-1.5 text-sm text-amber-950">
      <AlertIcon className="shrink-0" />
      {copy.stale.banner(formatAge(ingestedAt, now))}
    </div>
  );
}
