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
  takeLinePending,
  unlink,
  useSession,
} from "../../auth/session";
import { CaretRightIcon, ChatIcon, FloodIcon, GoogleIcon, LineIcon, PinIcon, UserIcon, UsersIcon } from "../../components/icons";
import { copy } from "../../copy";
import { GOOGLE_CLIENT_ID, renderGoogleButton } from "../../lib/google";
import { LogoutButton } from "./LogoutButton";

/** Google sign-in in our nm-btn style. Google's own button is drawn invisibly on top of ours and takes the
 *  click, so the popup and ID token are Google's as before (.nm-google in index.css). Without a client id in
 *  the build, our button shows disabled with a note saying why. `fill` makes it as wide as its container. */
function GoogleButton({ onToken, label, fill = false, small = false }: { onToken: (idToken: string) => void; label: string; fill?: boolean; small?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const hit = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!hit.current || !wrap.current || !GOOGLE_CLIENT_ID) return;
    // Google allows 200–400px; match ours so the whole button is clickable.
    const width = Math.max(200, Math.min(400, Math.ceil(wrap.current.offsetWidth)));
    renderGoogleButton(hit.current, (t) => cb.current(t), width).catch(() => setFailed(true));
  }, []);
  const off = !GOOGLE_CLIENT_ID || failed;
  const btn = `nm-btn nm-btn--secondary${small ? " nm-btn--sm" : ""}${fill ? " nm-btn--block" : ""}`;
  return (
    <div className={`grid gap-1 ${fill ? "" : "justify-items-end"}`}>
      <div ref={wrap} className={off ? "grid" : "nm-google"}>
        <span className={btn} aria-hidden={!off} aria-disabled={off || undefined}>
          <GoogleIcon className={small ? "text-[18px]" : "text-[20px]"} />
          {label}
        </span>
        {!off && <div ref={hit} className="nm-google__hit" />}
      </div>
      {off && <p className="m-0 text-center text-caption text-ink-muted">{copy.account.googleMissing}</p>}
    </div>
  );
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

  // Back from LINE's login page: finish the sign-in that was started there. Never sends the browser to LINE
  // by itself: when LINE didn't sign the person in (cancelled, back button), the button is there to try again.
  useEffect(() => {
    if (takeLinePending() === "login") void attempt(loginLine(true));
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
          <GoogleButton fill label={copy.account.googleSignIn} onToken={(t) => void attempt(loginGoogle(t))} />
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
    if (takeLinePending() === "link") void run(() => linkLine(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on the way back from LINE
  }, []);

  const row = (opts: { provider: Provider; icon: ReactNode; label: string; linked: boolean; detail: string | null; hint?: string; action: ReactNode }) => (
    <li className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <span className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-surface-sunken">{opts.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-body font-semibold">{opts.label}</div>
        <div className="truncate text-caption text-ink-muted">{opts.linked ? (opts.detail ?? copy.account.linked) : copy.account.notLinked}</div>
        {!opts.linked && opts.hint && <div className="text-caption text-ink-muted">{opts.hint}</div>}
      </div>
      <div className="flex-none">
        {opts.linked
          ? // The last way to sign in can't be unlinked (delete the account instead).
            both && (
              <button type="button" className="nm-btn nm-btn--secondary nm-btn--sm" disabled={busy} onClick={() => void run(() => unlink(opts.provider))}>
                {copy.account.unlink}
              </button>
            )
          : opts.action}
      </div>
    </li>
  );

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-lg border border-line bg-surface-raised shadow-float">
        {/* Header band, as on the sign-in card: who is signed in. */}
        <div className="flex items-center gap-4 bg-river-soft px-5 py-6 sm:px-6">
          {session.picture_url ? (
            <img src={session.picture_url} alt="" referrerPolicy="no-referrer" className="size-14 flex-none rounded-full object-cover ring-2 ring-surface-raised" />
          ) : (
            <span className="inline-flex size-14 flex-none items-center justify-center rounded-full bg-river text-on-river">
              <UserIcon className="text-[28px]" />
            </span>
          )}
          <div className="min-w-0">
            <div className="text-caption text-ink-muted">{copy.account.signedInAs}</div>
            <h1 className="m-0 truncate text-heading font-semibold sm:text-title">{session.display_name}</h1>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:p-6">
          <div className="grid gap-2">
            <h2 className="m-0 text-label font-semibold text-ink-muted">{copy.account.ways}</h2>
            <ul className="m-0 list-none rounded-md border border-line p-0">
              {row({
                provider: "line",
                icon: <LineIcon className="text-[22px] text-line-green" />,
                label: copy.account.line,
                linked: ids.line,
                detail: null,
                hint: copy.account.lineNote,
                action: canLineLogin && (
                  <button type="button" className="nm-btn nm-btn--line nm-btn--sm" disabled={busy} onClick={() => void run(linkLine)}>
                    <LineIcon className="text-[18px]" />
                    {copy.account.connect}
                  </button>
                ),
              })}
              {row({
                provider: "google",
                icon: <GoogleIcon className="text-[20px]" />,
                label: copy.account.google,
                linked: !!ids.google,
                detail: ids.google,
                action: <GoogleButton small label={copy.account.connect} onToken={(t) => void run(() => link("google", t))} />,
              })}
            </ul>
          </div>

          {error && (
            <p className="nm-field-error m-0" role="alert">
              {error}
            </p>
          )}

          <LogoutButton block />
        </div>
      </section>

      <section className="grid gap-2 rounded-lg border border-line p-5">
        <h2 className="m-0 text-heading font-semibold">{copy.account.deleteTitle}</h2>
        <p className="m-0 text-body text-ink-muted">{copy.account.deleteBody}</p>
        {confirmDelete ? (
          <div className="flex flex-wrap gap-2">
            {/* DS: danger red is for rescue only, never "delete". */}
            <button type="button" className="nm-btn nm-btn--secondary nm-btn--sm" disabled={busy} onClick={() => void run(deleteAccount)}>
              {copy.account.deleteConfirm}
            </button>
            <button type="button" className="nm-btn nm-btn--secondary nm-btn--sm" onClick={() => setConfirmDelete(false)}>
              {copy.account.cancel}
            </button>
          </div>
        ) : (
          <button type="button" className="nm-btn nm-btn--secondary nm-btn--sm justify-self-start" onClick={() => setConfirmDelete(true)}>
            {copy.account.deleteAsk}
          </button>
        )}
      </section>
    </div>
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
            ? "mx-auto grid max-w-md gap-4 px-4 py-8"
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
