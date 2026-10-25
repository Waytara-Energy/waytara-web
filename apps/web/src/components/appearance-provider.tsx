"use client";

import * as React from "react";
import { DEFAULT_APPEARANCE, type AppearancePrefs } from "@/lib/appearance-prefs";
import { applyAppearance } from "./appearance-applier";

interface AppearanceContextValue {
  prefs: AppearancePrefs;
  setPrefs: (next: AppearancePrefs) => void;
}

const AppearanceContext = React.createContext<AppearanceContextValue>({
  prefs: DEFAULT_APPEARANCE,
  setPrefs: () => undefined,
});

/**
 * Holds the person's appearance choices (text size, reduce motion, weather overlay) for the dashboard.
 * Mounted once in the dashboard layout.
 */
export function AppearanceProvider({ initial, children }: { initial: AppearancePrefs; children: React.ReactNode }) {
  const [prefs, setPrefsState] = React.useState<AppearancePrefs>(initial);

  const setPrefs = React.useCallback((next: AppearancePrefs) => {
    setPrefsState(next);
    applyAppearance(next);
  }, []);

  // Fresh value from server replaces local state
  const [seen, setSeen] = React.useState(() => JSON.stringify(initial));
  const incoming = JSON.stringify(initial);
  if (incoming !== seen) {
    setSeen(incoming);
    setPrefsState(initial);
  }

  const value = React.useMemo(() => ({ prefs, setPrefs }), [prefs, setPrefs]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  return React.useContext(AppearanceContext);
}

/** Whether the weather overlay (sunrise and sunset lines on monitoring charts) is enabled. */
export function useWeatherOverlay(): boolean {
  const { prefs } = React.useContext(AppearanceContext);
  return prefs.weatherOverlay;
}
