import "server-only";

// Open-Meteo — free, keyless, no billing/quota to manage for a widget this
// small. Two calls: geocode the site's city/state into coordinates + an
// IANA timezone (cached for 30 days — a city's coordinates never change),
// then fetch current conditions for those coordinates (cached briefly,
// since conditions genuinely do change).

export interface GeocodedLocation {
  latitude: number;
  longitude: number;
}

export interface CurrentWeather {
  tempC: number;
  code: number;
  isDay: boolean;
  /** Resolved by the forecast call itself (`timezone=auto`) from whichever
   *  coordinates were passed in — one less round trip than asking the
   *  geocoder for it separately, and it works just as well for a site's
   *  own lat/long as for a geocoded city. */
  timezone: string;
}

interface GeocodeResult {
  latitude: number;
  longitude: number;
  name: string;
  admin1?: string;
}

export async function geocodeCity(city: string, state?: string): Promise<GeocodedLocation | null> {
  const trimmed = city.trim();
  if (!trimmed) return null;
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", trimmed);
    url.searchParams.set("count", "5");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!res.ok) return null;
    const json: { results?: GeocodeResult[] } = await res.json();
    const results = json.results ?? [];
    if (results.length === 0) return null;
    // Prefer a result whose state/region matches, when we have one to check
    // against — a bare city name alone can match places in several states.
    const match = (state && results.find((r) => r.admin1?.toLowerCase().includes(state.trim().toLowerCase()))) || results[0];
    return { latitude: match.latitude, longitude: match.longitude };
  } catch {
    return null;
  }
}

// 30 min — matches the auto-refresh interval on the pages that render
// this (see IntervalRefresh), so a client left open picks up genuinely
// new data each time it refreshes rather than replaying the same cached
// response.
const WEATHER_REVALIDATE_SECONDS = 60 * 30;

export async function getCurrentWeather(latitude: number, longitude: number): Promise<CurrentWeather | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("current", "temperature_2m,weather_code,is_day");
    url.searchParams.set("timezone", "auto");
    const res = await fetch(url, { next: { revalidate: WEATHER_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    const json: { current?: { temperature_2m: number; weather_code: number; is_day: number }; timezone?: string } = await res.json();
    if (!json.current) return null;
    return {
      tempC: Math.round(json.current.temperature_2m),
      code: json.current.weather_code,
      isDay: json.current.is_day === 1,
      timezone: json.timezone ?? "UTC",
    };
  } catch {
    return null;
  }
}

// Filenames match apps/web/public/images/weather/*.svg — Meteocons' Fill
// style, copied from @meteocons/svg (see that folder's own README for
// where they came from and how to update them). Every name here must have
// a corresponding file in that folder.
export type WeatherIcon =
  | "clear-day"
  | "clear-night"
  | "mostly-clear-day"
  | "mostly-clear-night"
  | "partly-cloudy-day"
  | "partly-cloudy-night"
  | "overcast-day"
  | "overcast-night"
  | "fog-day"
  | "fog-night"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunderstorms";

// WMO weather codes (what Open-Meteo's `weather_code` returns) collapsed
// into a plain-English label + icon. Day/night only changes which icon is
// picked for the sky-cover conditions (clear/mostly clear/partly
// cloudy/overcast/fog) — Meteocons doesn't have day/night variants of the
// precipitation icons, and a rain or snow cloud reads the same either way.
export function describeWeatherCode(code: number, isDay: boolean): { label: string; icon: WeatherIcon } {
  if (code === 0) return { label: isDay ? "Sunny" : "Clear", icon: isDay ? "clear-day" : "clear-night" };
  if (code === 1) return { label: "Mostly Clear", icon: isDay ? "mostly-clear-day" : "mostly-clear-night" };
  if (code === 2) return { label: "Partly Cloudy", icon: isDay ? "partly-cloudy-day" : "partly-cloudy-night" };
  if (code === 3) return { label: "Overcast", icon: isDay ? "overcast-day" : "overcast-night" };
  if (code === 45 || code === 48) return { label: "Foggy", icon: isDay ? "fog-day" : "fog-night" };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: "Drizzle", icon: "drizzle" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "Rainy", icon: "rain" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snowy", icon: "snow" };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", icon: "thunderstorms" };
  return { label: "—", icon: isDay ? "overcast-day" : "overcast-night" };
}
