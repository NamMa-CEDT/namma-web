import { lazy, Suspense } from "react";
import { NavLink, Outlet, useSearchParams } from "react-router";
import { API_MODE } from "../api/client";
import { ChatIcon, LineIcon, MapIcon, PhoneIcon, ShieldIcon } from "../components/icons";
import { ErrorBoundary, Loading } from "../components/States";
import { StaleBanner } from "../components/Stale";
import { copy, DDPM } from "../copy";

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
  return (
    <div className="flex h-dvh flex-col bg-surface text-ink">
      <header className="z-[1000] flex min-h-16 items-center gap-3 border-b border-line bg-surface-raised px-4">
        {/* No logo yet: the name in the body face at 600 (DS Iconography). */}
        <NavLink to="/chat" className="flex items-baseline gap-2 text-ink no-underline">
          <span className="text-title font-semibold">{copy.appName}</span>
          <span className="text-caption text-ink-muted">{copy.appNameEn}</span>
        </NavLink>
        <nav className="ml-4 hidden gap-1 sm:flex" aria-label="หลัก">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-2 rounded-md px-3 text-label font-semibold no-underline ${
                  isActive ? "bg-river-soft text-river" : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                }`
              }
            >
              <Icon className="text-[20px]" />
              {label}
            </NavLink>
          ))}
        </nav>
        <a href={DDPM.telHref} className="nm-btn nm-btn--call nm-btn--sm ml-auto">
          <PhoneIcon className="text-[20px]" />
          {copy.footer.callButton}
        </a>
      </header>

      <StaleBanner />

      <main className="relative min-h-0 flex-1">
        <ErrorBoundary>
          <Suspense fallback={<Loading className="h-full" />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

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
          <span aria-hidden="true">·</span>
          <a href={DDPM.lineHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink underline">
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

      <nav className="pb-safe grid grid-cols-3 border-t border-line bg-surface-raised sm:hidden" aria-label="หลัก">
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
