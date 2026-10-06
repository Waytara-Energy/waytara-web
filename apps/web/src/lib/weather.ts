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

// 30 min - matches how often the open dashboard asks again (WeatherLive), so each ask gets genuinely new data
// rather than replaying the same cached response.
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

export { describeWeatherCode, type WeatherIcon } from "./weather-codes";
