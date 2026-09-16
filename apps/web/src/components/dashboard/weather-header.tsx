import Link from "next/link";
import { geocodeCity, getCurrentWeather, describeWeatherCode } from "@/lib/weather";
import type { SiteAddress } from "@/lib/site-catalog";

// City names get typed in all kinds of casing ("CHENNAI", "chennai") —
// normalized for display only, the stored value is never touched.
function toTitleCase(value: string): string {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

// Replaces the old "Welcome, {name} / {device} · {type} · {site}" header —
// the device switcher up in the dashboard header already shows which
// device/site is selected, so that line was redundant here. Live current
// conditions for the site's own address instead: geocoded once (cached for
// 30 days) into coordinates + a timezone, then a short-lived weather fetch
// against those coordinates. Both calls are free/keyless (Open-Meteo). The
// heading itself is now "{city} · {site name}" (e.g. "Chennai · Waytara
// Office Roof") instead of a generic "Weather Today" label, so it doubles
// as confirmation of which of the customer's sites this is for.
export async function WeatherHeader({ address, siteName }: { address: SiteAddress | null; siteName: string | null }) {
  const city = address?.city?.trim();
  const location = city ? await geocodeCity(city, address?.state) : null;
  const weather = location ? await getCurrentWeather(location.latitude, location.longitude) : null;
  const heading = [city ? toTitleCase(city) : null, siteName].filter(Boolean).join(" · ") || "Weather Today";

  if (!location || !weather) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{heading}</p>
        <p className="mt-1 text-sm text-foreground">
          Add your site address in{" "}
          <Link href="/dashboard/settings/instruments" className="font-medium underline underline-offset-2 hover:text-foreground">
            Settings
          </Link>{" "}
          to see local weather here.
        </p>
      </div>
    );
  }

  const condition = describeWeatherCode(weather.code, weather.isDay);
  const now = new Date();
  const timeLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: location.timezone }).format(now);
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: location.timezone }).format(now);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{heading}</p>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-3xl font-semibold leading-none text-foreground">{weather.tempC}°C</span>
        <div className="flex items-center gap-1.5">
          {/* Meteocons' own art is already fully colored (and animated —
              plain <img> renders that fine, next/image would need SVG
              optimization enabled app-wide just for this), so no icon
              component + manual color mapping needed anymore. */}
          <img src={`/images/weather/${condition.icon}.svg`} alt="" width={48} height={48} className="h-12 w-12" />
          <div>
            <p className="text-sm font-medium leading-none text-foreground">{condition.label}</p>
            <p className="mt-1 text-xs leading-none text-muted-foreground">
              {timeLabel} · {dateLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
