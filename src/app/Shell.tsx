import { lazy, Suspense } from "react";
import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router";
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

// Order: ask, see the flooding, then the stations behind it.
const NAV = [
  { to: "/chat", label: copy.nav.chat, Icon: ChatIcon },
  { to: "/flood", label: copy.nav.flood, Icon: FloodIcon },
  { to: "/map", label: copy.nav.map, Icon: MapIcon },
];

// Phones name the page next to the logo (the desktop bar shows the links instead). The home page shows the wordmark.
const PAGE_TITLE: Record<string, string> = {
  "/chat": copy.nav.chat,
  "/flood": copy.nav.flood,
  "/map": copy.nav.map,
  "/account": copy.account.nav,
};

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
  const pageTitle = PAGE_TITLE[useLocation().pathname] ?? null;
  return (
    <div className="flex h-dvh flex-col bg-surface text-ink">
      {/* Design C: a slim 52 px bar. Mark + wordmark, the three sections, then theme and profile. */}
      <header className="z-[1000] flex min-h-13 items-center gap-x-1 bg-surface-raised px-1 shadow-[0_1px_0_var(--line),0_2px_6px_rgb(11_26_46/0.05)] md:gap-x-5 md:px-5">
        <Link to="/" className="nm-wordmark min-h-11 min-w-11 justify-center" aria-label={`${copy.appNameEn} ${copy.appName} ${copy.nav.home}`}>
          <LogoMark size={32} />
          <span className={`nm-wordmark__en ${pageTitle ? "max-md:hidden" : ""}`}>{copy.appNameEn}</span>
        </Link>
        {pageTitle && (
          // The page's own heading is in the page; this is the phone's "you are here", like an app's title bar.
          <span className="ml-1 truncate text-heading font-semibold md:hidden" aria-hidden="true">
            {pageTitle}
          </span>
        )}
        <span aria-hidden="true" className="hidden h-[22px] w-px bg-line md:block" />
        <nav className="hidden gap-0.5 md:flex" aria-label="หลัก">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-9 items-center rounded-md px-3 text-[15px] no-underline ${
                  isActive ? "bg-river-soft font-semibold text-ink" : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
          <button
            type="button"
            onClick={cycleTheme}
            aria-label={`${copy.theme[theme]} · ${copy.theme.hint}`}
            title={copy.theme[theme]}
            className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:text-ink md:size-10 md:border md:border-line-strong md:text-ink"
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
