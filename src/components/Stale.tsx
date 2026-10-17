import { useEffect, useState } from "react";
import { useIngestedAt } from "../api/meta";
import { copy } from "../copy";
import { formatDateTime, isStale } from "../lib/format";
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

/** DS nm-stale for one station, shown above its reading. The old time stays visible. */
export function StaleNotice({ ts, agency }: { ts: string | null | undefined; agency: string | null }) {
  const now = useNow();
  if (!isStale(ts, agency, now)) return null;
  return (
    <p role="status" className="nm-stale m-0">
      <AlertIcon className="mt-0.5 shrink-0 text-[18px]" />
      {copy.stale.station(formatDateTime(ts))}
    </p>
  );
}

/** Global notice when the backend's last ThaiWater ingest is older than 30 min. */
export function StaleBanner() {
  const ingestedAt = useIngestedAt();
  const now = useNow();
  if (!ingestedAt || now - new Date(ingestedAt).getTime() < 30 * 60_000) return null;
  return (
    <div role="status" className="nm-stale rounded-none px-4">
      <AlertIcon className="mt-0.5 shrink-0 text-[18px]" />
      {copy.stale.banner(formatDateTime(ingestedAt))}
    </div>
  );
}
