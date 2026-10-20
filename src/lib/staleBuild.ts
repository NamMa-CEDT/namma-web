// Each deploy replaces dist/, so a tab opened before it asks for page chunks that no longer exist (404). A reload
// fetches the new index.html and its chunks. Guarded so a chunk that is really broken can't reload forever.

const KEY = "namma.staleReloadAt";
const MIN_GAP_MS = 10_000;

// Chrome, Firefox and Safari word a failed import() differently.
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

export function isChunkError(err: unknown): boolean {
  return err instanceof Error && CHUNK_ERROR.test(err.message);
}

/** Reloads the page unless it already did in the last few seconds. Returns true when it reloads. */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < MIN_GAP_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
