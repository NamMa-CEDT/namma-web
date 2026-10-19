import { lazy, Suspense } from "react";
import { Link, NavLink, Outlet, useSearchParams } from "react-router";
import { API_MODE } from "../api/client";
import { AutoThemeIcon, ChatIcon, FloodIcon, LineIcon, MapIcon, MoonIcon, SunIcon } from "../components/icons";
import { LogoMark } from "../components/Logo";
import { ErrorBoundary, Loading } from "../components/States";
import { StaleBanner } from "../components/Stale";
import { AccountMenu } from "../features/account/AccountMenu";
import { copy, DDPM } from "../copy";
import { useTheme } from "../lib/theme";

const THEME_ICON = { auto: AutoThemeIcon, light: SunIcon, dark: MoonIcon };

// Static check so http builds drop the demo panel (and the mock store it imports) entirely.
const DemoPanel = import.meta.env.VITE_API_MODE === "http" ? null : lazy(() => import("../features/demo/DemoPanel"));

const NAV = [
  { to: "/chat", label: copy.nav.chat, Icon: ChatIcon },
  { to: "/map", label: copy.nav.map, Icon: MapIcon },
  { to: "/flood", label: copy.nav.flood, Icon: FloodIcon },
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
  const [theme, cycleTheme] = useTheme();
  const ThemeIcon = THEME_ICON[theme];
  return (
    <div className="flex h-dvh flex-col bg-surface text-ink">
      <header className="z-[1000] flex min-h-16 items-center gap-x-1.5 border-b border-line bg-surface-raised px-2 py-1 sm:gap-x-4 sm:px-6">
        <Link to="/" className="nm-wordmark min-h-11 min-w-11" aria-label={`${copy.appNameEn} ${copy.appName} ${copy.nav.home}`}>
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
            className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:text-ink sm:border sm:border-line-strong sm:text-ink"
          >
            <ThemeIcon className="text-[20px]" />
          </button>
          <AccountMenu />
        </div>
      </header>

      <StaleBanner />

      {/* Pages scroll inside themselves: nothing in one may make the window scroll (a second scrollbar, a gap under
          the footer), not even an absolutely placed screen-reader label. */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <ErrorBoundary>
          <Suspense fallback={<Loading className="h-full" />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Always shown, chat included: with no call button in the header, this is the hotline on every page. */}
      <footer className="border-t border-line bg-surface-raised px-4 py-1.5 text-caption text-ink-muted">
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
