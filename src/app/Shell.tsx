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
    <div className="flex h-dvh flex-col">
      <header className="z-[1000] flex items-center gap-3 bg-brand-800 px-4 py-2 text-white shadow-sm">
        <NavLink to="/chat" className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold">{copy.appName}</span>
          <span className="text-xs text-brand-100/80">{copy.appNameEn}</span>
        </NavLink>
        <nav className="ml-4 hidden gap-1 sm:flex" aria-label="หลัก">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  isActive ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10"
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <a
          href={DDPM.telHref}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-emergency px-3 py-1.5 text-sm font-semibold text-white shadow"
        >
          <PhoneIcon />
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

      <footer className="border-t border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold text-slate-700">{copy.footer.unofficial}</span>
          <span aria-hidden="true">·</span>
          <span>
            {copy.footer.emergency}{" "}
            <a href={DDPM.telHref} className="font-semibold text-emergency underline">
              {DDPM.hotline}
            </a>
          </span>
          <span aria-hidden="true">·</span>
          <a href={DDPM.lineHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
            <LineIcon className="text-[#06c755]" />
            {DDPM.lineId}
          </a>
          <span className="hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="hidden sm:inline">{copy.footer.followOfficial}</span>
          <span className="hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="hidden sm:inline">{copy.footer.dataCredit}</span>
        </p>
      </footer>

      <nav className="pb-safe grid grid-cols-3 border-t border-slate-200 bg-white sm:hidden" aria-label="หลัก">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${
                isActive ? "text-brand-700" : "text-slate-500"
              }`
            }
          >
            <Icon className="text-xl" />
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
