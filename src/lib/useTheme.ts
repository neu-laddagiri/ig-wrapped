"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, type ThemeChoice } from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readTheme(): ThemeChoice {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => {
    media.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

/** The effective light/dark theme, plus a setter that remembers the choice. */
export function useTheme() {
  const theme = useSyncExternalStore<ThemeChoice>(
    subscribe,
    readTheme,
    () => "light"
  );

  const setTheme = useCallback((next: ThemeChoice) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice lasts for this page only.
    }
  }, []);

  const toggleTheme = useCallback(
    () => setTheme(readTheme() === "dark" ? "light" : "dark"),
    [setTheme]
  );

  return { theme, setTheme, toggleTheme };
}
