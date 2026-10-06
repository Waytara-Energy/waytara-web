"use client";

import * as React from "react";
import { describeWeatherCode } from "@/lib/weather-codes";

interface WeatherData {
  tempC: number;
  code: number;
  isDay: boolean;
  timezone: string;
}

const REFRESH_MS = 30 * 60 * 1000;

/** Current conditions for the site. The server renders the first reading; this keeps it current - the temperature is
 *  asked again every 30 minutes and the clock ticks once a minute - without re-rendering the page. */
export function WeatherLive({ heading, latitude, longitude, initial }: { heading: string; latitude: number; longitude: number; initial: WeatherData }) {
  const [weather, setWeather] = React.useState<WeatherData>(initial);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return; // a hidden tab asks nobody
      try {
        const res = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}`);
        if (res.ok && !cancelled) setWeather((await res.json()) as WeatherData);
      } catch {
        /* keep showing the last reading */
      }
    };
    const poll = setInterval(refresh, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(tick);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [latitude, longitude]);

  const condition = describeWeatherCode(weather.code, weather.isDay);
  const date = new Date(now);
  const timeLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: weather.timezone }).format(date);
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: weather.timezone }).format(date);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{heading}</p>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-3xl font-semibold leading-none text-foreground">{weather.tempC}°C</span>
        <div className="flex items-center gap-1.5">
          {/* Meteocons' art is already fully colored (and animated); a plain <img> renders that fine. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/images/weather/${condition.icon}.svg`} alt="" width={48} height={48} className="h-12 w-12" />
          <div>
            <p className="text-sm font-medium leading-none text-foreground">{condition.label}</p>
            <p className="mt-1 text-xs leading-none text-muted-foreground" suppressHydrationWarning>
              {timeLabel} · {dateLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
