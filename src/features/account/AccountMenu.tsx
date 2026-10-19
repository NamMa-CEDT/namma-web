import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { logout, useSession } from "../../auth/session";
import { UserIcon } from "../../components/icons";
import { copy } from "../../copy";

/** Header account button: the profile picture (or a plain icon) only. Tapping it opens a small menu with the name and sign in/out. */
export function AccountMenu() {
  const session = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = async () => {
    setBusy(true);
    await logout();
    void qc.invalidateQueries({ queryKey: ["profile"] });
    setBusy(false);
    setOpen(false);
  };

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={session ? `${copy.account.nav}: ${session.display_name}` : copy.account.signIn}
        className="inline-flex size-11 items-center justify-center overflow-hidden rounded-full text-ink-muted hover:text-ink sm:border sm:border-line-strong sm:text-ink"
      >
        {session?.picture_url ? (
          <img src={session.picture_url} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          <UserIcon className="text-[26px]" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={copy.account.nav}
          className="absolute right-0 top-full z-[1100] mt-2 grid w-64 gap-3 rounded-md border border-line bg-surface-raised p-4 shadow-float"
        >
          {session ? (
            <>
              <div className="min-w-0">
                <div className="text-caption text-ink-muted">{copy.account.signedInAs}</div>
                <div className="truncate text-body font-semibold">{session.display_name}</div>
              </div>
              <Link to="/account" onClick={() => setOpen(false)} className="nm-btn nm-btn--secondary nm-btn--block no-underline">
                {copy.account.nav}
              </Link>
              <button type="button" className="nm-btn nm-btn--secondary nm-btn--block" disabled={busy} onClick={() => void signOut()}>
                {copy.account.logout}
              </button>
            </>
          ) : (
            <Link to="/account" onClick={() => setOpen(false)} className="nm-btn nm-btn--primary nm-btn--block no-underline">
              {copy.account.signIn}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
