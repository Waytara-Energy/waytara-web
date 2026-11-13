import { NextRequest, NextResponse } from "next/server";
import { getRequestProfile } from "@/lib/request-profile";
import { getSelectedSite, resolveDeviceInSite } from "@/lib/selected-site";
import { fetchForecast } from "@/lib/weather";

// The weather at the site of a device: today's forecast with the conditions now, the sun, the sunshine hour by hour and the next two days hour by hour. The
// place comes from the site's saved location in the database, never from the request. The browser keeps the answer for the day (see use-site-weather) and
// works "now" out from it hour by hour, so this is asked about once a day per site; the answer is also reused for 10 minutes on the server (MET Norway asks
// not to be asked more often than its own expiry).
export async function GET(req: NextRequest) {
  const [profile, site] = await Promise.all([getRequestProfile(), getSelectedSite()]);
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const device = await resolveDeviceInSite(site, req.nextUrl.searchParams.get("device") ?? undefined);
  if (!site || !device) return NextResponse.json({ error: "No device found." }, { status: 404 });
  if (site.latitude === null || site.longitude === null) return NextResponse.json({ error: "no-location" }, { status: 200 });

  const forecast = await fetchForecast(site.latitude, site.longitude, Date.now());
  if (!forecast) return NextResponse.json({ error: "unavailable" }, { status: 200 });
  // the first two days are hourly; later days are every six hours and are not needed here
  const hours = forecast.days.slice(0, 2).flatMap((d) => d.hours.filter((h) => h.spanH === 1));
  return NextResponse.json({ weather: forecast.weather, hours }, { headers: { "Cache-Control": "private, max-age=300" } });
}
