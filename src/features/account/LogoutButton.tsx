import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { logout } from "../../auth/session";
import { copy } from "../../copy";

/** Every way out of the account: the first tap asks, the second signs out. `onDone` runs after signing out. */
export function LogoutButton({ small = false, block = false, onDone }: { small?: boolean; block?: boolean; onDone?: () => void }) {
  const qc = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const size = `${small ? " nm-btn--sm" : ""}${block ? " nm-btn--block" : ""}`;

  if (!asking) {
    return (
      <button type="button" className={`nm-btn nm-btn--secondary${size}`} onClick={() => setAsking(true)}>
        {copy.account.logout}
      </button>
    );
  }

  const signOut = async () => {
    setBusy(true);
    await logout();
    void qc.invalidateQueries({ queryKey: ["profile"] });
    setBusy(false);
    setAsking(false);
    onDone?.();
  };

  return (
    <div role="group" aria-label={copy.account.logoutAsk} className="grid gap-2 rounded-md bg-surface-sunken p-3">
      <p className="m-0 text-body font-semibold">{copy.account.logoutAsk}</p>
      <p className="m-0 text-caption text-ink-muted">{copy.account.logoutNote}</p>
      {/* Stacked full width: side by side, the narrow menu broke "ออกจากระบบ" over three lines. Confirm shows on top. */}
      <div className="flex flex-col-reverse gap-2 whitespace-nowrap">
        {/* Cancel takes focus, so a stray Enter keeps the person signed in. */}
        <button type="button" autoFocus className="nm-btn nm-btn--secondary nm-btn--sm" disabled={busy} onClick={() => setAsking(false)}>
          {copy.account.cancel}
        </button>
        <button type="button" className="nm-btn nm-btn--primary nm-btn--sm" disabled={busy} onClick={() => void signOut()}>
          {copy.account.logoutConfirm}
        </button>
      </div>
    </div>
  );
}
