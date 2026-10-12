import { NextRequest, NextResponse } from "next/server";
import { getRequestProfile } from "@/lib/request-profile";
import { getSelectedSite, resolveDeviceInSite } from "@/lib/selected-site";
import { fetchWeather } from "@/lib/weather";

// The weather at the site of a device: now, and the days ahead. The place comes from the site's saved location in the database, never
// from the request, and the answer is reused for 10 minutes (MET Norway asks not to be asked more often than its own expiry).
export async function GET(req: NextRequest) {
  const [profile, site] = await Promise.all([getRequestProfile(), getSelectedSite()]);
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const device = await resolveDeviceInSite(site, req.nextUrl.searchParams.get("device") ?? undefined);
  if (!site || !device) return NextResponse.json({ error: "No device found." }, { status: 404 });
  if (site.latitude === null || site.longitude === null) return NextResponse.json({ error: "no-location" }, { status: 200 });

  const weather = await fetchWeather(site.latitude, site.longitude, Date.now());
  if (!weather) return NextResponse.json({ error: "unavailable" }, { status: 200 });
  return NextResponse.json({ weather }, { headers: { "Cache-Control": "private, max-age=120" } });
}
