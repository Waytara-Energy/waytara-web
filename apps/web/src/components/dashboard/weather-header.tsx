import Link from "next/link";
import { geocodeCity, getCurrentWeather } from "@/lib/weather";
import { WeatherLive } from "./weather-live";
import type { SiteAddress } from "@/lib/site-catalog";

// City names get typed in all kinds of casing ("CHENNAI", "chennai") —
// normalized for display only, the stored value is never touched.
function toTitleCase(value: string): string {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

// Replaces the old "Welcome, {name} / {device} · {type} · {site}" header —
// the device switcher up in the dashboard header already shows which
// device/site is selected, so that line was redundant here. Live current
// conditions for the site's own location instead: the site's own
// latitude/longitude (set via EnableLocationButton on a device's Site
// Setting tab, under Devices) when it has one — no geocoding needed, straight to the forecast call —
// falling back to geocoding the address's city (cached 30 days) only when
// the site has no coordinates yet. Both calls are free/keyless
// (Open-Meteo). The heading itself is "{city} · {site name}" (e.g.
// "Chennai · Waytara Office Roof") instead of a generic "Weather Today"
// label, so it doubles as confirmation of which of the customer's sites
// this is for — city comes from the address either way (not reverse-
// geocoded from coordinates), so it's still shown even when lat/long is
// what drove the actual forecast lookup.
export async function WeatherHeader({
  address,
  siteName,
  latitude,
  longitude,
}: {
  address: SiteAddress | null;
  siteName: string | null;
  latitude: number | null;
  longitude: number | null;
}) {
  const city = address?.city?.trim();
  const location = latitude !== null && longitude !== null ? { latitude, longitude } : city ? await geocodeCity(city, address?.state) : null;
  const weather = location ? await getCurrentWeather(location.latitude, location.longitude) : null;
  const heading = [city ? toTitleCase(city) : null, siteName].filter(Boolean).join(" · ") || "Weather Today";

  if (!location || !weather) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{heading}</p>
        <p className="mt-1 text-sm text-foreground">
          Add your site address in{" "}
          <Link href="/dashboard/devices" className="font-medium underline underline-offset-2 hover:text-foreground">
            Devices
          </Link>{" "}
          to see local weather here.
        </p>
      </div>
    );
  }

  return <WeatherLive heading={heading} latitude={location.latitude} longitude={location.longitude} initial={weather} />;
}
