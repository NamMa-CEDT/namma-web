// The NamMa LINE Official Account's add-friend link (https://line.me/R/ti/p/@<id>). VITE_LINE_OA_URL overrides it;
// left blank it falls back to the live OA, so a blank .env never hides the LINE bot.
export const NAMMA_LINE_OA_URL = "https://line.me/R/ti/p/@753kmkri";
export const LINE_OA_URL: string | null =
  (import.meta.env.VITE_LINE_OA_URL as string | undefined)?.trim() || NAMMA_LINE_OA_URL;

/** The OA's id with its "@" ("@namma") from a line.me link, which may spell the "@" as %40. */
export function lineOaId(url: string | null): string | null {
  const id = url && /\/(?:@|%40)([^/?#]+)/i.exec(url)?.[1];
  return id ? `@${id}` : null;
}

/**
 * Opens the OA's chat with `text` typed in, for the person to send (LINE URL scheme "oaMessage"). Null when the OA
 * link is unset or has no id.
 */
export function lineMessageUrl(text: string, oaUrl: string | null = LINE_OA_URL): string | null {
  const id = lineOaId(oaUrl);
  return id && `https://line.me/R/oaMessage/${encodeURIComponent(id)}/?${encodeURIComponent(text)}`;
}
