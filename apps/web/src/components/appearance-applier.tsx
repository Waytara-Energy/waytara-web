"use client";

import * as React from "react";
import { textPercent, type AppearancePrefs } from "@/lib/appearance-prefs";

/** Applies the person's text size and reduced-motion choice to the page (the size scales every rem on the page; reduced motion is a rule in
 *  globals.css keyed to the attribute set here). Also used by the settings page so a change shows at once. */
export function applyAppearance(prefs: AppearancePrefs): void {
  const root = document.documentElement;
  root.style.fontSize = prefs.textSize === "md" ? "" : `${textPercent(prefs.textSize)}%`;
  if (prefs.reduceMotion) root.setAttribute("data-reduce-motion", "true");
  else root.removeAttribute("data-reduce-motion");
  if (prefs.weatherOverlay) root.setAttribute("data-weather-overlay", "true");
  else root.removeAttribute("data-weather-overlay");
  if (typeof document !== "undefined") {
    document.cookie = `weather_overlay=${prefs.weatherOverlay ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }
}

/** Mounted once in the dashboard layout with what the server read from the profile, so the choice follows the person to every device. */
export function AppearanceApplier({ prefs }: { prefs: AppearancePrefs }) {
  React.useEffect(() => {
    applyAppearance(prefs);
  }, [prefs.textSize, prefs.reduceMotion, prefs.weatherOverlay, prefs]);
  return null;
}
