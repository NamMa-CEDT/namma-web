import { useState } from "react";

// Light/dark choice. "auto" follows the device (prefers-color-scheme in tokens.css); light and dark set
// data-theme on <html>. index.html applies the saved choice before first paint, so there is no flash.
export type Theme = "auto" | "light" | "dark";

export const THEME_KEY = "namma.theme";
const ORDER: Theme[] = ["auto", "light", "dark"];

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

function applyTheme(t: Theme): void {
  const root = document.documentElement;
  if (t === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  try {
    if (t === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

/** Current choice and a function that moves to the next one (auto → light → dark → auto). */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState(readTheme);
  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    applyTheme(next);
    setTheme(next);
  };
  return [theme, cycle];
}
