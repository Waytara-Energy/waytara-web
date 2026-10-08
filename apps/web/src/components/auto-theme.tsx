"use client";

import * as React from "react";
import { useTheme } from "next-themes";

export type ThemeMode = "light" | "dark" | "auto";

const KEY = "theme_auto";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function write(value: "1" | "0") {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // storage can be blocked; Auto then only lasts until the page is closed
  }
  listeners.forEach((l) => l());
}
const useAutoFlag = () => React.useSyncExternalStore(subscribe, read, () => null);

/** Auto follows the clock: light from 06:00 to 18:00 on this device, dark the rest of the day. */
export function themeForHour(hour: number): "light" | "dark" {
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

/** The appearance choice (light, dark or auto) and how to change it. Auto is kept beside the theme and applies light or dark itself. */
export function useThemeMode(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } {
  const { theme, setTheme } = useTheme();
  const flag = useAutoFlag();
  const mode: ThemeMode = flag === "1" ? "auto" : theme === "dark" ? "dark" : theme === "light" ? "light" : "auto";
  const setMode = React.useCallback(
    (next: ThemeMode) => {
      write(next === "auto" ? "1" : "0");
      setTheme(next === "auto" ? themeForHour(new Date().getHours()) : next);
    },
    [setTheme]
  );
  return { mode, setMode };
}

/** While Auto is chosen, switches between light and dark as the day turns. Mounted once, inside the theme provider. */
export function AutoThemeSync() {
  const { theme, setTheme } = useTheme();
  const flag = useAutoFlag();
  React.useEffect(() => {
    // Someone who had "System" before has no choice stored yet: that becomes Auto.
    if (flag === null && theme === "system") {
      write("1");
      return;
    }
    if (flag !== "1") return;
    const apply = () => {
      const want = themeForHour(new Date().getHours());
      if (theme !== want) setTheme(want);
    };
    apply();
    const id = window.setInterval(apply, 60_000);
    return () => window.clearInterval(id);
  }, [flag, theme, setTheme]);
  return null;
}
