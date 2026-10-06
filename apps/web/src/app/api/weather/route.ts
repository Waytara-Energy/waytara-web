import { NextRequest, NextResponse } from "next/server";
import { getRequestProfile } from "@/lib/request-profile";
import { getCurrentWeather } from "@/lib/weather";

// Current conditions for a site's coordinates, for the open dashboard to refresh itself every 30 minutes without
// re-rendering the page. Only for signed-in customers (this must not become an open proxy), and the coordinates
// are validated; the upstream call is cached for 30 minutes by getCurrentWeather.
export async function GET(req: NextRequest) {
  const profile = await getRequestProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }
  const weather = await getCurrentWeather(lat, lon);
  if (!weather) return NextResponse.json({ error: "Weather is unavailable." }, { status: 502 });
  return NextResponse.json(weather, { headers: { "Cache-Control": "private, max-age=300" } });
}
