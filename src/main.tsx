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
import { initSession } from "./auth/session";

const HomePage = lazy(() => import("./features/home/HomePage"));
const ChatPage = lazy(() => import("./features/chat/ChatPage"));
const MapPage = lazy(() => import("./features/map/MapPage"));
const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage"));
const AccountPage = lazy(() => import("./features/account/AccountPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

if (API_MODE === "mock") {
  // Another tab changed the mock store (e.g. chat created a ticket): refresh everything.
  window.addEventListener("storage", (e) => {
    if (e.key === MOCK_STORE_KEY) queryClient.invalidateQueries();
  });
}

// Session first: on day 5 this is liff.init(), which must finish before the router reads the URL.
initSession().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<HomePage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
});
