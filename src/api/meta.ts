import { useSyncExternalStore } from "react";

// Latest meta.ingested_at seen in any API response; drives the global stale-data banner.
let ingestedAt: string | null = null;
const listeners = new Set<() => void>();

export function setIngestedAt(ts: string | null | undefined): void {
  if (!ts || ts === ingestedAt) return;
  if (ingestedAt && new Date(ts) < new Date(ingestedAt)) return;
  ingestedAt = ts;
  listeners.forEach((fn) => fn());
}

export function useIngestedAt(): string | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => ingestedAt,
  );
}
