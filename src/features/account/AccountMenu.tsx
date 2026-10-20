import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useSession } from "../../auth/session";
import { UserIcon } from "../../components/icons";
import { copy } from "../../copy";
import { LogoutButton } from "./LogoutButton";

/** Header account button: the profile picture (or a plain icon) only. Tapping it opens a small menu with the name and sign in/out. */
export function AccountMenu() {
  const session = useSession();
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={session ? `${copy.account.nav}: ${session.display_name}` : copy.account.signIn}
        className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:text-ink md:size-10 md:border md:border-line-strong md:text-ink"
      >
        {session?.picture_url ? (
          <img src={session.picture_url} alt="" referrerPolicy="no-referrer" className="size-7 rounded-full object-cover" />
        ) : (
          <UserIcon className="text-[20px]" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={copy.account.nav}
          className="absolute right-0 top-full z-[1100] mt-2 grid w-56 gap-2 rounded-md border border-line bg-surface-raised p-3 shadow-float"
        >
          {session ? (
            <>
              <div className="flex min-w-0 items-center gap-2 border-b border-line pb-2">
                {session.picture_url ? (
                  <img src={session.picture_url} alt="" referrerPolicy="no-referrer" className="size-9 flex-none rounded-full object-cover" />
                ) : (
                  <span className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
                    <UserIcon className="text-[18px]" />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="text-caption text-ink-muted">{copy.account.signedInAs}</div>
                  <div className="truncate text-label font-semibold">{session.display_name}</div>
                </div>
              </div>
              <Link to="/account" onClick={() => setOpen(false)} className="nm-btn nm-btn--sm nm-btn--secondary nm-btn--block no-underline">
                {copy.account.nav}
              </Link>
              <LogoutButton small block onDone={() => setOpen(false)} />
            </>
          ) : (
            <>
              <p className="m-0 text-caption text-ink-muted">{copy.account.signInTitle}</p>
              <Link to="/account" onClick={() => setOpen(false)} className="nm-btn nm-btn--sm nm-btn--primary nm-btn--block no-underline">
                {copy.account.signIn}
              </Link>
            </>
          )}
          <Link to="/about" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center justify-center text-body text-ink-muted underline">
            {copy.about.nav}
          </Link>
        </div>
      )}
    </div>
  );
}
