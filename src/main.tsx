import "@fontsource/ibm-plex-sans-thai-looped/400.css";
import "@fontsource/ibm-plex-sans-thai-looped/600.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router";
import { ApiError, API_MODE, MOCK_STORE_KEY } from "./api/client";
import { Shell } from "./app/Shell";
import { autoLineSignIn, getSession, initSession, subscribeSession } from "./auth/session";
import { reloadForNewBuild } from "./lib/staleBuild";

const HomePage = lazy(() => import("./features/home/HomePage"));
const ChatPage = lazy(() => import("./features/chat/ChatPage"));
const MapPage = lazy(() => import("./features/map/MapPage"));
const FloodPage = lazy(() => import("./features/flood/FloodPage"));
const AccountPage = lazy(() => import("./features/account/AccountPage"));
const AboutPage = lazy(() => import("./features/about/AboutPage"));
const PrivacyPage = lazy(() => import("./features/legal/LegalPage").then((m) => ({ default: m.PrivacyPage })));
const PdpaPage = lazy(() => import("./features/legal/LegalPage").then((m) => ({ default: m.PdpaPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

// Vite reports a failed chunk load here first; reloading picks up the new build (see lib/staleBuild).
window.addEventListener("vite:preloadError", (e) => {
  if (reloadForNewBuild()) e.preventDefault();
});

if (API_MODE === "mock") {
  // Another tab changed the mock store (e.g. the demo panel raised a tier): refresh everything.
  window.addEventListener("storage", (e) => {
    if (e.key === MOCK_STORE_KEY) queryClient.invalidateQueries();
  });
}

// Signed out: drop everything cached about the person (their profile: places, memory, facts). Station and flood
// data aren't anyone's and stay.
let signedIn = false;
subscribeSession(() => {
  const now = getSession() !== null;
  if (signedIn && !now) queryClient.removeQueries({ queryKey: ["profile"] });
  signedIn = now;
});

// Session first: on day 5 this is liff.init(), which must finish before the router reads the URL.
initSession().then(() => {
  signedIn = getSession() !== null;
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<HomePage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/flood" element={<FloodPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/pdpa" element={<PdpaPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
  // Opened inside the LINE app: sign in with LINE without a button, then refetch as the signed-in person.
  void autoLineSignIn().then((ok) => {
    if (ok) void queryClient.invalidateQueries();
  });
});
