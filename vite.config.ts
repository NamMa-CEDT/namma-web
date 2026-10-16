import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import type { UserConfig } from "vite";

// VITE_API_MODE=mock (default) serves the in-app mock API; =http talks to the FastAPI app.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const config: UserConfig & { test: Record<string, unknown> } = {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: env.VITE_API_MODE === "http" ? { "/api": "http://localhost:8000" } : undefined,
    },
    test: {
      environment: "jsdom",
      globals: true,
    },
  };
  return config;
});
