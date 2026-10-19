import { lazy, Suspense } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { API_MODE } from "../api/client";
import {
  AutoThemeIcon,
  ChatIcon,
  LineIcon,
  MapIcon,
  MoonIcon,
  PhoneIcon,
  ShieldIcon,
  SunIcon,
  UserIcon,
} from "../components/icons";
import { useSession } from "../auth/session";
import { LogoMark } from "../components/Logo";
import { ErrorBoundary, Loading } from "../components/States";
import { StaleBanner } from "../components/Stale";
import { copy, DDPM } from "../copy";
import { useTheme } from "../lib/theme";

const THEME_ICON = { auto: AutoThemeIcon, light: SunIcon, dark: MoonIcon };

// Static check so http builds drop the demo panel (and the mock store it imports) entirely.
const DemoPanel = import.meta.env.VITE_API_MODE === "http" ? null : lazy(() => import("../features/demo/DemoPanel"));

const NAV = [
  { to: "/chat", label: copy.nav.chat, Icon: ChatIcon },
  { to: "/map", label: copy.nav.map, Icon: MapIcon },
  { to: "/dashboard", label: copy.nav.dashboard, Icon: ShieldIcon },
];

function useDemoMode(): boolean {
  const [params] = useSearchParams();
  if (API_MODE !== "mock") return false;
  try {
    if (params.get("demo") === "1") localStorage.setItem("namma.demo", "1");
    if (params.get("demo") === "0") localStorage.removeItem("namma.demo");
    return localStorage.getItem("namma.demo") === "1";
  } catch {
    return params.get("demo") === "1";
  }
}

export function Shell() {
  const demo = useDemoMode();
  const navigate = useNavigate();
  const session = useSession();
  const [theme, cycleTheme] = useTheme();
  const ThemeIcon = THEME_ICON[theme];
  // On a phone the chat needs the height; the header's 1784 button and each answer's HotlineNotice carry the hotline.
  const inChat = useLocation().pathname === "/chat";
  return (
    <div className="flex h-dvh flex-col bg-surface text-ink">
      <header className="z-[1000] flex min-h-16 items-center gap-x-1.5 border-b border-line bg-surface-raised px-2 py-1 sm:gap-x-4 sm:px-6">
        <Link to="/" className="nm-wordmark" aria-label={`${copy.appNameEn} ${copy.appName} ${copy.nav.home}`}>
          <LogoMark size={36} />
          <span className="nm-wordmark__en max-sm:hidden">{copy.appNameEn}</span>
        </Link>
        <nav className="hidden flex-1 gap-1 md:flex" aria-label="หลัก">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-2 border-b-[3px] px-2 text-label no-underline ${
                  isActive ? "border-river font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"
                }`
              }
            >
              <Icon className="text-[20px]" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={cycleTheme}
            aria-label={`${copy.theme[theme]} · ${copy.theme.hint}`}
            title={copy.theme[theme]}
            className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:text-ink sm:border sm:border-line-strong sm:text-ink max-sm:size-10"
          >
            <ThemeIcon className="text-[20px]" />
          </button>
          <NavLink
            to="/account"
            aria-label={session ? `${copy.account.nav}: ${session.display_name}` : copy.account.signIn}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-2 rounded-md px-1 text-label no-underline sm:px-2 ${
                isActive ? "font-semibold text-ink" : "text-ink-muted hover:text-ink"
              }`
            }
          >
            <UserIcon className="text-[24px]" />
            <span className="max-w-32 truncate max-md:hidden">{session ? session.display_name : copy.account.signIn}</span>
          </NavLink>
          <a href={DDPM.telHref} className="nm-btn nm-btn--call nm-btn--sm max-sm:px-2 max-sm:text-[15px]">
            <PhoneIcon className="text-[20px] max-sm:hidden" />
            {copy.footer.callButton}
          </a>
          {/* Rescue starts in the chat: triage asks before anything is sent (CLAUDE.md §6). */}
          <button
            type="button"
            className="nm-btn nm-btn--danger nm-btn--sm max-sm:px-2 max-sm:text-[15px]"
            onClick={() => navigate("/chat", { state: { send: copy.rescueMessage } })}
          >
            {copy.nav.rescue}
          </button>
        </div>
      </header>

      <StaleBanner />

      <main className="relative min-h-0 flex-1">
        <ErrorBoundary>
          <Suspense fallback={<Loading className="h-full" />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className={`border-t border-line bg-surface-raised px-4 py-1.5 text-caption text-ink-muted ${inChat ? "max-md:hidden" : ""}`}>
        <p className="m-0 flex flex-wrap items-center gap-x-2">
          <span className="font-semibold text-ink">{copy.footer.unofficial}</span>
          <span aria-hidden="true">·</span>
          <span>
            {copy.footer.emergency}{" "}
            <a href={DDPM.telHref} className="font-semibold text-tier-danger-ink underline">
              {DDPM.hotline}
            </a>
          </span>
          {/* Phones keep the footer to one line; the LINE contact is also in each HotlineNotice. */}
          <span className="max-sm:hidden" aria-hidden="true">
            ·
          </span>
          <a
            href={DDPM.lineHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-ink underline max-sm:hidden"
          >
            <LineIcon />
            {DDPM.lineId}
          </a>
          <span className="hidden lg:inline" aria-hidden="true">
            ·
          </span>
          <span className="hidden lg:inline">{copy.footer.followOfficial}</span>
          <span className="hidden lg:inline" aria-hidden="true">
            ·
          </span>
          <span className="hidden lg:inline">{copy.footer.dataCredit}</span>
        </p>
      </footer>

      <nav className="pb-safe grid grid-cols-3 border-t border-line bg-surface-raised md:hidden" aria-label="หลัก">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-caption font-semibold no-underline ${
                isActive ? "text-river" : "text-ink-muted"
              }`
            }
          >
            <Icon className="text-[22px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      {demo && DemoPanel && (
        <Suspense fallback={null}>
          <DemoPanel />
        </Suspense>
      )}
    </div>
  );
}
