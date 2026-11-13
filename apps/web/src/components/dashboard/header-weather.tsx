"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useSiteWeather } from "@/hooks/use-site-weather";
import { cn } from "@/lib/utils";
import { WEATHER_ICON, temp } from "./weather-ui";

/** The weather at the selected site in the header: its icon and temperature, and a click opens the full forecast. It shows nothing when the
 *  site has no saved location or the weather cannot be read (the forecast page says why). */
export function HeaderWeather({ siteId }: { siteId: string | null }) {
  const { weather } = useSiteWeather(siteId); // undefined = still loading

  if (!siteId || weather === null) return null;
  if (weather === undefined) return <Skeleton className="h-8 w-12 rounded-md" />;

  const n = weather.now;
  const Icon = WEATHER_ICON[n.condition][n.night ? "night" : "day"];
  return (
    <Link
      href="/dashboard/weather"
      aria-label="Weather at the site. Open the forecast."
      className="-mr-1 flex h-8 shrink-0 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Icon className={cn("size-[18px]", WEATHER_ICON[n.condition].tone)} strokeWidth={1.7} />
      <span className="tabular-nums">{temp(n.tempC)}</span>
    </Link>
  );
}
