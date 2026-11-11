// The weather the landing page's demo shows in its header: the real weather at the VISITOR'S approximate place, with no browser location prompt.
// The place is the city-level position that the hosting network (Vercel) attaches to the request; it is rounded further, never stored, never
// logged, and never sent anywhere except to MET Norway as two rounded numbers. Pure shaping (tested) plus the response type.

import { CONDITION_TEXT, type Condition, type Forecast } from "./weather";

/** Where we look when the request carries no position (a local run, or a network that hides it). Not shown as the visitor's place. */
export const FALLBACK_PLACE = { lat: 13.08, lng: 80.27, timeZone: "Asia/Kolkata" } as const;

export interface PublicWeather {
  /** The visitor's city when the network said it, else null. */
  place: string | null;
  tempC: number;
  feelsC: number;
  condition: Condition;
  night: boolean;
  text: string;
  humidityPct: number;
  windKmh: number;
  /** The next six hours. */
  hours: { hour: number; tempC: number; condition: Condition; night: boolean }[];
  /** One line about what the sky means for solar. */
  outlook: string;
}

/** Roughly city-level: two decimals is about a kilometre, which is plenty and lets neighbours share one cached answer. */
export const approximate = (v: number) => Math.round(v * 100) / 100;

/** How warm it feels (the Australian Bureau of Meteorology's apparent temperature from the air temperature, humidity and wind). */
export function feelsLike(tempC: number, humidityPct: number, windMs: number): number {
  const vapour = (humidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return tempC + 0.33 * vapour - 0.7 * windMs - 4;
}

/** The hour of day (0 to 23) of a moment in a time zone; falls back to India time for an unknown zone. */
export function hourIn(ms: number, timeZone: string): number {
  try {
    const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(new Date(ms));
    return Number(h) % 24;
  } catch {
    return hourIn(ms, FALLBACK_PLACE.timeZone);
  }
}

const WET: Condition[] = ["drizzle", "rain", "heavyrain", "thunder", "sleet", "snow"];

/** The header's reading from a forecast: now, the next six hours, and a line for solar. Null when the forecast has no current temperature. */
export function publicWeatherFrom(forecast: Forecast, nowMs: number, timeZone: string, place: string | null): PublicWeather | null {
  const { now } = forecast.weather;
  if (now.tempC === null) return null;
  const upcoming = forecast.days
    .flatMap((d) => d.hours)
    .filter((h) => Date.parse(h.time) > nowMs && h.tempC !== null)
    .slice(0, 6)
    .map((h) => ({ hour: hourIn(Date.parse(h.time), timeZone), tempC: Math.round(h.tempC as number), condition: h.condition, night: h.night }));
  const wetSoon = upcoming.some((h) => WET.includes(h.condition));
  const outlook = now.night
    ? "No sun until the morning."
    : wetSoon || WET.includes(now.condition)
      ? "Rain is expected; solar dips for a while."
      : now.condition === "cloudy" || now.condition === "fog"
        ? "Cloud keeps solar below its best."
        : "Good sun for solar.";
  return {
    place,
    tempC: Math.round(now.tempC),
    feelsC: Math.round(feelsLike(now.tempC, now.humidityPct ?? 50, now.windMs ?? 0)),
    condition: now.condition,
    night: now.night,
    text: CONDITION_TEXT[now.condition],
    humidityPct: Math.round(now.humidityPct ?? 0),
    windKmh: Math.round((now.windMs ?? 0) * 3.6),
    hours: upcoming,
    outlook,
  };
}
