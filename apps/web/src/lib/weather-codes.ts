// Weather code -> label/icon: pure, so both the server render and the live client component use it.

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
