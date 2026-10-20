import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ApiError } from "../../api/client";
import type { Provider } from "../../api/types";
import {
  canDemoLogin,
  canLineLogin,
  deleteAccount,
  link,
  linkLine,
  loginDemo,
  loginGoogle,
  loginLine,
  logout,
  takeLinePending,
  unlink,
  useSession,
} from "../../auth/session";
import { CaretRightIcon, ChatIcon, FloodIcon, LineIcon, PinIcon, UserIcon, UsersIcon } from "../../components/icons";
import { copy } from "../../copy";
import { GOOGLE_CLIENT_ID, renderGoogleButton } from "../../lib/google";

/** Google's own button (its brand rules). Without a client id in the build, a note says why it is missing.
 *  `fill` sizes it to its container (Google allows 200–400px). */
function GoogleButton({ onToken, fill = false }: { onToken: (idToken: string) => void; fill?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!el.current || !GOOGLE_CLIENT_ID) return;
    const width = fill ? Math.max(200, Math.min(400, Math.floor(el.current.offsetWidth))) : undefined;
    renderGoogleButton(el.current, (t) => cb.current(t), width).catch(() => setFailed(true));
  }, [fill]);
  if (!GOOGLE_CLIENT_ID || failed) return <p className="m-0 text-center text-caption text-ink-muted">{copy.account.googleMissing}</p>;
  return <div ref={el} className={fill ? "flex min-h-11 w-full justify-center" : "min-h-11"} />;
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
  const attempt = (p: Promise<{ merged_chat?: boolean } | null>) =>
    p.then((r) => done(r?.merged_chat)).catch((e) => setError(errorText(e)));

  // Back from LINE's login page: finish the sign-in that was started there.
  useEffect(() => {
    if (takeLinePending() === "login") void attempt(loginLine());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on the way back from LINE
  }, []);

  const perkIcons = [PinIcon, UsersIcon, ChatIcon];

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface-raised shadow-float">
      {/* Header band: the app's water mark on the soft river tint. */}
      <div className="grid justify-items-center gap-3 bg-river-soft px-6 pb-6 pt-8 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-river text-on-river">
          <FloodIcon className="text-[30px]" />
        </span>
        <h1 className="m-0 text-heading font-semibold sm:text-title">{copy.account.signInTitle}</h1>
      </div>

      <div className="grid gap-5 p-5 sm:p-6">
        <ul className="m-0 grid list-none gap-3 p-0">
          {copy.account.signInPerks.map((perk, i) => {
            const Icon = perkIcons[i] ?? PinIcon;
            return (
              <li key={perk} className="flex items-start gap-3 text-body">
                <span className="mt-0.5 inline-flex size-7 flex-none items-center justify-center rounded-full bg-surface-sunken text-river">
                  <Icon className="text-[16px]" />
                </span>
                {perk}
              </li>
            );
          })}
        </ul>

        <div className="grid gap-3">
          {canLineLogin ? (
            <button type="button" className="nm-btn nm-btn--line nm-btn--block" onClick={() => void attempt(loginLine())}>
              <LineIcon className="text-[22px]" />
              {copy.account.lineSignIn}
            </button>
          ) : (
            <button type="button" disabled className="nm-btn nm-btn--line nm-btn--block" aria-disabled="true">
              <LineIcon className="text-[22px]" />
              {copy.account.lineSoon}
            </button>
          )}
          <div className="flex items-center gap-3 text-caption text-ink-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            {copy.account.or}
            <span className="h-px flex-1 bg-line" />
          </div>
          <GoogleButton fill onToken={(t) => void attempt(loginGoogle(t))} />
        </div>

        {note && <p className="m-0 rounded-md bg-tier-normal-soft px-3 py-2 text-body text-tier-normal-ink">{note}</p>}
        {error && (
          <p className="nm-field-error m-0" role="alert">
            {error}
          </p>
        )}

        {canDemoLogin && (
          <details className="group border-t border-line pt-4">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-caption text-ink-muted [&::-webkit-details-marker]:hidden">
              <CaretRightIcon className="text-[14px] transition-transform group-open:rotate-90" />
              {copy.account.demoOpen}
            </summary>
            <form
              className="mt-3 grid gap-2 sm:flex sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                const name = demoName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
                void attempt(loginDemo(name || undefined));
              }}
            >
              <label className="grid flex-1 gap-1 text-caption text-ink-muted" htmlFor="demo-name">
                {copy.account.demoName}
                <input id="demo-name" className="nm-input w-full" value={demoName} onChange={(e) => setDemoName(e.target.value)} />
              </label>
              <button type="submit" className="nm-btn nm-btn--secondary">
                {copy.account.demo}
              </button>
            </form>
          </details>
        )}
      </div>
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

  // Back from LINE's login page after "เชื่อม LINE": finish the link.
  useEffect(() => {
    if (takeLinePending() === "link") void run(linkLine);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on the way back from LINE
  }, []);

  const row =(provider: Provider, label: string, linked: boolean, detail: string | null, action: ReactNode) => (
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
          {row(
            "line",
            copy.account.line,
            ids.line,
            null,
            canLineLogin ? (
              <div className="grid justify-items-end gap-1">
                <button type="button" className="nm-btn nm-btn--line nm-btn--sm" disabled={busy} onClick={() => void run(linkLine)}>
                  <LineIcon className="text-[18px]" />
                  {copy.account.lineLink}
                </button>
                <span className="text-caption text-ink-muted">{copy.account.lineNote}</span>
              </div>
            ) : (
              <span className="text-caption text-ink-muted">{copy.account.lineNote}</span>
            ),
          )}
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
      <div
        className={
          session
            ? "mx-auto grid max-w-xl gap-8 px-4 py-8 sm:px-6"
            : "mx-auto grid min-h-full max-w-md content-center gap-4 px-4 py-8"
        }
      >
        {session ? <Account /> : <SignIn />}
        <p className={`m-0 flex flex-wrap gap-x-4 text-caption ${session ? "" : "justify-center"}`}>
          <Link to="/privacy" className="text-ink-muted underline">
            {copy.legal.privacyLink}
          </Link>
          <Link to="/pdpa" className="text-ink-muted underline">
            {copy.legal.pdpaLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
