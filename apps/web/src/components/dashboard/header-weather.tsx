"use client";

import * as React from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { CONDITION_TEXT, type Weather } from "@/lib/weather";
import { cn } from "@/lib/utils";
import { WEATHER_ICON, temp } from "./weather-ui";

const REFRESH_MS = 10 * 60_000;

/** The weather at the selected site in the header: its icon and temperature, and a click opens the full forecast. It shows nothing when the
 *  site has no saved location or the weather cannot be read (the forecast page says why). */
export function HeaderWeather({ siteId }: { siteId: string | null }) {
  const [weather, setWeather] = React.useState<Weather | null | undefined>(undefined); // undefined = still loading

  React.useEffect(() => {
    if (!siteId) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch("/api/weather", { signal: controller.signal, cache: "no-store" });
        const body = await res.json();
        if (controller.signal.aborted) return;
        if (body?.weather) setWeather(body.weather as Weather);
        else setWeather((prev) => (prev ? prev : null));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setWeather((prev) => (prev ? prev : null));
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

  if (!siteId || weather === null) return null;
  if (weather === undefined) return <Skeleton className="h-8 w-12 rounded-md" />;

  const n = weather.now;
  const Icon = WEATHER_ICON[n.condition][n.night ? "night" : "day"];
  return (
    <Link
      href="/dashboard/weather"
      title={`${CONDITION_TEXT[n.condition]}${n.tempC !== null ? `, ${Math.round(n.tempC)}°C` : ""} at the site. Open the weather forecast.`}
      aria-label="Weather at the site. Open the forecast."
      className="-mr-1 flex h-8 shrink-0 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Icon className={cn("size-[18px]", WEATHER_ICON[n.condition].tone)} strokeWidth={1.7} />
      <span className="tabular-nums">{temp(n.tempC)}</span>
    </Link>
  );
}
