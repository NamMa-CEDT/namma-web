import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "../../api/client";
import type { Provider } from "../../api/types";
import { canDemoLogin, deleteAccount, link, loginDemo, loginGoogle, logout, unlink, useSession } from "../../auth/session";
import { LineIcon, UserIcon } from "../../components/icons";
import { copy } from "../../copy";
import { GOOGLE_CLIENT_ID, renderGoogleButton } from "../../lib/google";

/** Google's own button (its brand rules). Without a client id in the build, a note says why it is missing. */
function GoogleButton({ onToken }: { onToken: (idToken: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!el.current || !GOOGLE_CLIENT_ID) return;
    renderGoogleButton(el.current, (t) => cb.current(t)).catch(() => setFailed(true));
  }, []);
  if (!GOOGLE_CLIENT_ID || failed) return <p className="m-0 text-caption text-ink-muted">{copy.account.googleMissing}</p>;
  return <div ref={el} className="min-h-11" />;
}

function errorText(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) return e.message.includes("only way") ? copy.account.lastWay : copy.account.conflict;
  return copy.account.failed;
}

function SignIn() {
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoName, setDemoName] = useState("");
  const done = (merged?: boolean) => {
    setNote(merged ? copy.account.merged : null);
    void qc.invalidateQueries({ queryKey: ["profile"] });
  };
  const attempt = (p: Promise<{ merged_chat?: boolean }>) =>
    p.then((r) => done(r.merged_chat)).catch((e) => setError(errorText(e)));

  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="m-0 text-title font-semibold">{copy.account.signInTitle}</h1>
        <p className="m-0 text-body text-ink-muted">{copy.account.signInBody}</p>
      </div>
      <GoogleButton onToken={(t) => void attempt(loginGoogle(t))} />
      <button type="button" disabled className="nm-btn nm-btn--line justify-self-start" aria-disabled="true">
        <LineIcon className="text-[22px]" />
        {copy.account.lineSoon}
      </button>
      {canDemoLogin && (
        <form
          className="flex flex-wrap items-end gap-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const name = demoName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
            void attempt(loginDemo(name || undefined));
          }}
        >
          <label className="grid gap-1 text-caption text-ink-muted" htmlFor="demo-name">
            {copy.account.demoName}
            <input id="demo-name" className="nm-input" value={demoName} onChange={(e) => setDemoName(e.target.value)} />
          </label>
          <button type="submit" className="nm-btn nm-btn--secondary">
            {copy.account.demo}
          </button>
        </form>
      )}
      {note && <p className="m-0 text-body">{note}</p>}
      {error && (
        <p className="nm-field-error m-0" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function Account() {
  const session = useSession()!;
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ids = session.identities ?? { line: false, google: null };
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      void qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const both = ids.line && !!ids.google;

  const row = (provider: Provider, label: string, linked: boolean, detail: string | null, action: ReactNode) => (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-body font-semibold">{label}</div>
        <div className="text-caption text-ink-muted">{linked ? (detail ?? copy.account.linked) : copy.account.notLinked}</div>
      </div>
      {linked ? (
        // The last way to sign in can't be unlinked (delete the account instead).
        both && (
          <button type="button" className="nm-btn nm-btn--secondary nm-btn--sm" disabled={busy} onClick={() => void run(() => unlink(provider))}>
            {copy.account.unlink}
          </button>
        )
      ) : (
        action
      )}
    </li>
  );

  return (
    <section className="grid gap-6">
      <div className="flex items-center gap-3">
        {session.picture_url ? (
          <img src={session.picture_url} alt="" className="size-12 rounded-full" />
        ) : (
          <UserIcon className="text-[48px] text-ink-muted" />
        )}
        <div>
          <div className="text-caption text-ink-muted">{copy.account.signedInAs}</div>
          <h1 className="m-0 text-title font-semibold">{session.display_name}</h1>
        </div>
      </div>

      <div className="grid gap-1">
        <h2 className="m-0 text-heading font-semibold">{copy.account.ways}</h2>
        <ul className="m-0 list-none p-0">
          {row("line", copy.account.line, ids.line, null, <span className="text-caption text-ink-muted">{copy.account.lineNote}</span>)}
          {row(
            "google",
            copy.account.google,
            !!ids.google,
            ids.google,
            <GoogleButton onToken={(t) => void run(() => link("google", t))} />,
          )}
        </ul>
      </div>

      {error && (
        <p className="nm-field-error m-0" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="nm-btn nm-btn--secondary justify-self-start" disabled={busy} onClick={() => void run(logout)}>
        {copy.account.logout}
      </button>

      <div className="grid gap-2 rounded-md border border-line p-4">
        <h2 className="m-0 text-heading font-semibold">{copy.account.deleteTitle}</h2>
        <p className="m-0 text-body text-ink-muted">{copy.account.deleteBody}</p>
        {confirmDelete ? (
          <div className="flex flex-wrap gap-2">
            {/* DS: danger red is for rescue only, never "delete". */}
            <button type="button" className="nm-btn nm-btn--secondary" disabled={busy} onClick={() => void run(deleteAccount)}>
              {copy.account.deleteConfirm}
            </button>
            <button type="button" className="nm-btn nm-btn--secondary" onClick={() => setConfirmDelete(false)}>
              {copy.account.cancel}
            </button>
          </div>
        ) : (
          <button type="button" className="nm-btn nm-btn--secondary justify-self-start" onClick={() => setConfirmDelete(true)}>
            {copy.account.deleteAsk}
          </button>
        )}
      </div>
    </section>
  );
}

/** Sign in (Google now, LINE once its Login channel exists), link a second way, sign out, delete the account. */
export default function AccountPage() {
  const session = useSession();
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">{session ? <Account /> : <SignIn />}</div>
    </div>
  );
}
