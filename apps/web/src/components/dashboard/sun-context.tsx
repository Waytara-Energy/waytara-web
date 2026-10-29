"use client";

import * as React from "react";
import { sunDay, type SunDay } from "@/lib/sun";
import { istDate } from "@/lib/telemetry/combine";

export interface SunTimesInfo {
  sunriseIso: string | null;
  sunsetIso: string | null;
  sunriseMs: number | null;
  sunsetMs: number | null;
  sunriseClock: string;
  sunsetClock: string;
}

const DEFAULT_COORDS = {
  latitude: 13.0827, // Chennai / WayTara headquarters default
  longitude: 80.2707,
};

const SunContext = React.createContext<SunTimesInfo>({
  sunriseIso: null,
  sunsetIso: null,
  sunriseMs: null,
  sunsetMs: null,
  sunriseClock: "",
  sunsetClock: "",
});

function formatClock(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).toUpperCase();
}

export function SunProvider({
  coordinates,
  children,
}: {
  coordinates?: { latitude: number | null; longitude: number | null } | null;
  children: React.ReactNode;
}) {
  const lat = coordinates?.latitude ?? DEFAULT_COORDS.latitude;
  const lng = coordinates?.longitude ?? DEFAULT_COORDS.longitude;

  // The day the times are worked out for is read once when the provider mounts (a page opened tomorrow starts again).
  const [today] = React.useState(() => istDate(Date.now()));

  const value = React.useMemo<SunTimesInfo>(() => {
    const day: SunDay = sunDay(today, lat, lng);
    return {
      sunriseIso: day.sunrise,
      sunsetIso: day.sunset,
      sunriseMs: day.sunrise ? new Date(day.sunrise).getTime() : null,
      sunsetMs: day.sunset ? new Date(day.sunset).getTime() : null,
      sunriseClock: formatClock(day.sunrise),
      sunsetClock: formatClock(day.sunset),
    };
  }, [today, lat, lng]);

  return <SunContext.Provider value={value}>{children}</SunContext.Provider>;
}

export function useSunTimes(): SunTimesInfo {
  return React.useContext(SunContext);
}
