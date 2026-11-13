"use client";

import * as React from "react";
import type { Weather } from "@/lib/weather";

const REFRESH_MS = 10 * 60_000;

/**
 * The weather at the selected site, read from /api/weather (which takes the place from the site's saved location and reuses MET Norway's answer for
 * ten minutes): `undefined` while the first answer is on its way, `null` when there is none (`reason` says why: "no-location" when the site has no
 * saved location, "unavailable" when the weather could not be read). It is read again every ten minutes and when the tab is looked at again; a
 * failed re-read keeps the last weather on screen.
 */
export function useSiteWeather(siteId: string | null): { weather: Weather | null | undefined; reason: "no-location" | "unavailable" | null } {
  const [weather, setWeather] = React.useState<Weather | null | undefined>(undefined);
  const [reason, setReason] = React.useState<"no-location" | "unavailable" | null>(null);

  React.useEffect(() => {
    if (!siteId) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch("/api/weather", { signal: controller.signal, cache: "no-store" });
        const body = await res.json();
        if (controller.signal.aborted) return;
        if (body?.weather) {
          setWeather(body.weather as Weather);
          setReason(null);
        } else {
          setWeather((prev) => (prev ? prev : null));
          setReason(body?.error === "no-location" ? "no-location" : "unavailable");
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setWeather((prev) => (prev ? prev : null));
        setReason("unavailable");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [siteId]);

  return { weather, reason };
}
