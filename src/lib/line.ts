// The NamMa LINE Official Account's add-friend link (https://line.me/R/ti/p/@<id>), from VITE_LINE_OA_URL.
// Unset until the OA exists: the add-friend buttons are hidden rather than pointing nowhere.
export const LINE_OA_URL: string | null = (import.meta.env.VITE_LINE_OA_URL as string | undefined)?.trim() || null;
