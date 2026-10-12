// Weather for a site, from the MET Norway Locationforecast API (open data, CC BY 4.0, free for commercial use with credit):
// the conditions now and an outlook for the days ahead. Pure parsing (tested) plus one fetch.
//
// MET's rules, which this follows: a User-Agent that says who is asking, coordinates rounded to 4 decimals, no new request before the
// response's own expiry (the server caches for 10 minutes), and "Data from MET Norway" shown with the weather.

import { clearSkyWm2, cloudyWm2, solarOutlook, sunDay, sunElevation, type SolarOutlook, type SunDay } from "./sun";

export const WEATHER_CREDIT = "Weather data from MET Norway";
export const WEATHER_USER_AGENT = "WayTara/1.0 (https://waytaraenergy.com; support@waytaraenergy.com)";
const IST_MS = 19_800_000;

export type Condition = "clear" | "fair" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "heavyrain" | "sleet" | "snow" | "thunder";

export interface WeatherNow {
  tempC: number | null;
  condition: Condition;
  night: boolean;
  humidityPct: number | null;
  windMs: number | null;
  cloudPct: number | null;
  /** Where the wind comes from, degrees clockwise from north. */
  windFromDeg: number | null;
  /** The UV index under a clear sky, and the air pressure at sea level in hPa. */
  uvIndex: number | null;
  pressureHpa: number | null;
  /** Rain expected in the next hour, mm. */
  rainMm: number | null;
  at: string;
}

export interface WeatherDay {
  /** IST date, YYYY-MM-DD. */
  date: string;
  minC: number | null;
  maxC: number | null;
  condition: Condition;
  rainMm: number;
  /** Sunrise and sunset (ISO, UTC) and how much of a clear day's sunshine the forecast cloud leaves (percent). */
  sunrise: string | null;
  sunset: string | null;
  solarPct: number | null;
}

export interface Weather {
  now: WeatherNow;
  days: WeatherDay[];
  /** The sun today, and the sunshine hour by hour. */
  sun: SunDay;
  solar: SolarOutlook;
  updatedAt: string;
}

interface Step {
  time: string;
  data: {
    instant?: { details?: { air_temperature?: number; relative_humidity?: number; wind_speed?: number; wind_from_direction?: number; cloud_area_fraction?: number; ultraviolet_index_clear_sky?: number; air_pressure_at_sea_level?: number } };
    next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
    next_6_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
    next_12_hours?: { summary?: { symbol_code?: string } };
  };
}
export interface MetResponse {
  properties?: { meta?: { updated_at?: string }; timeseries?: Step[] };
}

/** A MET symbol code ("partlycloudy_night", "lightrainshowers_day") as a plain condition. */
export function conditionOf(code: string | undefined): { condition: Condition; night: boolean } {
  const c = (code ?? "cloudy").toLowerCase();
  const night = c.endsWith("_night");
  const base = c.replace(/_(day|night|polartwilight)$/, "");
  if (base.includes("thunder")) return { condition: "thunder", night };
  if (base.includes("snow")) return { condition: "snow", night };
  if (base.includes("sleet")) return { condition: "sleet", night };
  if (base.startsWith("heavyrain")) return { condition: "heavyrain", night };
  if (base.startsWith("lightrain")) return { condition: "drizzle", night };
  if (base.includes("rain")) return { condition: "rain", night };
  if (base === "fog") return { condition: "fog", night };
  if (base === "clearsky") return { condition: "clear", night };
  if (base === "fair") return { condition: "fair", night };
  if (base === "partlycloudy") return { condition: "partly", night };
  return { condition: "cloudy", night };
}

export const CONDITION_TEXT: Record<Condition, string> = {
  clear: "Clear sky",
  fair: "Mostly clear",
  partly: "Partly cloudy",
  cloudy: "Cloudy",
  fog: "Fog",
  drizzle: "Light rain",
  rain: "Rain",
  heavyrain: "Heavy rain",
  sleet: "Sleet",
  snow: "Snow",
  thunder: "Thunderstorms",
};

/** How bad a condition is for the day's headline: when the hours differ, the worst one is what the day is remembered by. */
const SEVERITY: Record<Condition, number> = { clear: 0, fair: 1, partly: 2, cloudy: 3, fog: 4, drizzle: 5, rain: 6, sleet: 7, snow: 7, heavyrain: 8, thunder: 9 };

const istDate = (iso: string) => new Date(Date.parse(iso) + IST_MS).toISOString().slice(0, 10);
const istHour = (iso: string) => new Date(Date.parse(iso) + IST_MS).getUTCHours();

/** The conditions now and for the next `dayCount` India days, from a MET response. Null when the response has no forecast. */
export function summarizeWeather(res: MetResponse, nowMs: number, lat: number, lng: number, dayCount = 7): Weather | null {
  const series = res.properties?.timeseries ?? [];
  if (series.length === 0) return null;

  // "Now": the step that is current (the newest one that has started).
  const current = [...series].reverse().find((s) => Date.parse(s.time) <= nowMs) ?? series[0];
  const d = current.data.instant?.details ?? {};
  const sym = conditionOf(current.data.next_1_hours?.summary?.symbol_code ?? current.data.next_6_hours?.summary?.symbol_code);
  const now: WeatherNow = {
    tempC: d.air_temperature ?? null,
    condition: sym.condition,
    night: sym.night,
    humidityPct: d.relative_humidity ?? null,
    windMs: d.wind_speed ?? null,
    cloudPct: d.cloud_area_fraction ?? null,
    windFromDeg: d.wind_from_direction ?? null,
    uvIndex: d.ultraviolet_index_clear_sky ?? null,
    pressureHpa: d.air_pressure_at_sea_level ?? null,
    rainMm: current.data.next_1_hours?.details?.precipitation_amount ?? null,
    at: current.time,
  };

  // Cloud cover through the forecast, for the sunshine of any day in it.
  const cloud = series.flatMap((s) => (typeof s.data.instant?.details?.cloud_area_fraction === "number" ? [{ ms: Date.parse(s.time), pct: s.data.instant.details.cloud_area_fraction }] : []));

  const byDay = new Map<string, Step[]>();
  for (const s of series) byDay.set(istDate(s.time), [...(byDay.get(istDate(s.time)) ?? []), s]);
  const today = istDate(new Date(nowMs).toISOString());
  const days: WeatherDay[] = [...byDay.entries()]
    .filter(([date]) => date >= today)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, dayCount)
    .map(([date, steps]) => {
      const temps = steps.map((s) => s.data.instant?.details?.air_temperature).filter((t): t is number => typeof t === "number");
      // Rain: the 6-hour amounts that start at 00, 06, 12 and 18 UTC are separate blocks that do not overlap, so they add up.
      const rain = steps.filter((s) => [0, 6, 12, 18].includes(new Date(s.time).getUTCHours())).reduce((sum, s) => sum + (s.data.next_6_hours?.details?.precipitation_amount ?? 0), 0);
      // The day's condition: the worst of its daytime blocks (07:00 to 19:00 India time).
      const daytime = steps.filter((s) => istHour(s.time) >= 7 && istHour(s.time) <= 18);
      const conds = (daytime.length > 0 ? daytime : steps)
        .map((s) => s.data.next_6_hours?.summary?.symbol_code ?? s.data.next_12_hours?.summary?.symbol_code ?? s.data.next_1_hours?.summary?.symbol_code)
        .filter((c): c is string => !!c)
        .map((c) => conditionOf(c).condition);
      const condition = conds.reduce<Condition>((worst, c) => (SEVERITY[c] > SEVERITY[worst] ? c : worst), "clear");
      const sun = sunDay(date, lat, lng);
      return {
        date,
        minC: temps.length ? Math.min(...temps) : null,
        maxC: temps.length ? Math.max(...temps) : null,
        condition: conds.length ? condition : "cloudy",
        rainMm: Math.round(rain * 10) / 10,
        sunrise: sun.sunrise,
        sunset: sun.sunset,
        solarPct: cloud.length ? solarOutlook(date, lat, lng, cloud).potentialPct : null,
      };
    });

  return { now, days, sun: sunDay(today, lat, lng), solar: solarOutlook(today, lat, lng, cloud), updatedAt: res.properties?.meta?.updated_at ?? current.time };
}

// ---- the full forecast, hour by hour -----------------------------------------------------------------------------------------------

/** One moment of the forecast: the first two days come every hour, the rest every six hours. */
export interface HourPoint {
  /** ISO time (UTC) and the hour of it in India time. */
  time: string;
  hour: number;
  tempC: number | null;
  cloudPct: number | null;
  windMs: number | null;
  windFromDeg: number | null;
  humidityPct: number | null;
  uvIndex: number | null;
  /** Rain expected over the `spanH` hours that start at this time, mm. */
  rainMm: number | null;
  spanH: number;
  condition: Condition;
  night: boolean;
  /** Expected sunshine at that moment, with the forecast cloud, W/m². */
  wm2: number;
}

export interface ForecastDay extends WeatherDay {
  hours: HourPoint[];
  sun: SunDay;
  solar: SolarOutlook;
  avgCloudPct: number | null;
  avgHumidityPct: number | null;
  maxWindMs: number | null;
  maxUv: number | null;
}

export interface Forecast {
  weather: Weather;
  days: ForecastDay[];
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const max = (v: number[]) => (v.length ? Math.max(...v) : null);
const nums = (v: (number | null)[]) => v.filter((x): x is number => x !== null);

/** The next `dayCount` India days with every forecast moment in them, the sun, and the sunshine. Empty when the response has no forecast. */
export function forecastDays(res: MetResponse, nowMs: number, lat: number, lng: number, dayCount = 7): ForecastDay[] {
  const base = summarizeWeather(res, nowMs, lat, lng, dayCount);
  if (!base) return [];
  const series = res.properties?.timeseries ?? [];
  const cloud = series.flatMap((s) => (typeof s.data.instant?.details?.cloud_area_fraction === "number" ? [{ ms: Date.parse(s.time), pct: s.data.instant.details.cloud_area_fraction }] : []));
  return base.days.map((day) => {
    const hours: HourPoint[] = series
      .filter((s) => istDate(s.time) === day.date)
      .map((s) => {
        const d = s.data.instant?.details ?? {};
        const sym = conditionOf(s.data.next_1_hours?.summary?.symbol_code ?? s.data.next_6_hours?.summary?.symbol_code ?? s.data.next_12_hours?.summary?.symbol_code);
        const ms = Date.parse(s.time);
        const cloudPct = d.cloud_area_fraction ?? null;
        return {
          time: s.time,
          hour: istHour(s.time),
          tempC: d.air_temperature ?? null,
          cloudPct,
          windMs: d.wind_speed ?? null,
          windFromDeg: d.wind_from_direction ?? null,
          humidityPct: d.relative_humidity ?? null,
          uvIndex: d.ultraviolet_index_clear_sky ?? null,
          rainMm: s.data.next_1_hours?.details?.precipitation_amount ?? s.data.next_6_hours?.details?.precipitation_amount ?? null,
          spanH: s.data.next_1_hours ? 1 : 6,
          condition: sym.condition,
          night: sym.night,
          wm2: Math.round(cloudyWm2(clearSkyWm2(sunElevation(ms, lat, lng)), cloudPct ?? 0)),
        };
      });
    const clouds = nums(hours.map((h) => h.cloudPct));
    const avgCloud = mean(clouds);
    return {
      ...day,
      hours,
      sun: sunDay(day.date, lat, lng),
      solar: solarOutlook(day.date, lat, lng, cloud),
      avgCloudPct: avgCloud === null ? null : Math.round(avgCloud),
      avgHumidityPct: ((v) => (v === null ? null : Math.round(v)))(mean(nums(hours.map((h) => h.humidityPct)))),
      maxWindMs: max(nums(hours.map((h) => h.windMs))),
      maxUv: max(nums(hours.map((h) => h.uvIndex))),
    };
  });
}

/** MET asks for coordinates to no more than 4 decimals. */
export const roundCoordinate = (v: number) => Math.round(v * 10_000) / 10_000;

/** Reads the forecast. `revalidate` seconds is how long the answer is reused: MET asks not to be asked again before its expiry. */
async function fetchMet(lat: number, lng: number, revalidate: number): Promise<MetResponse | null> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${roundCoordinate(lat)}&lon=${roundCoordinate(lng)}`;
  const res = await fetch(url, { headers: { "User-Agent": WEATHER_USER_AGENT, Accept: "application/json" }, next: { revalidate } });
  return res.ok ? ((await res.json()) as MetResponse) : null;
}

export async function fetchWeather(lat: number, lng: number, nowMs: number, revalidate = 600): Promise<Weather | null> {
  const met = await fetchMet(lat, lng, revalidate);
  return met ? summarizeWeather(met, nowMs, lat, lng) : null;
}

/** The full forecast for the forecast page: the same reading as the summary, with every moment of it. */
export async function fetchForecast(lat: number, lng: number, nowMs = Date.now(), revalidate = 600): Promise<Forecast | null> {
  const met = await fetchMet(lat, lng, revalidate);
  const weather = met ? summarizeWeather(met, nowMs, lat, lng) : null;
  return met && weather ? { weather, days: forecastDays(met, nowMs, lat, lng) } : null;
}
