import { NextRequest, NextResponse } from "next/server";
import { approximate, FALLBACK_PLACE, publicWeatherFrom } from "@/lib/public-weather";
import { fetchForecast } from "@/lib/weather";

// The weather for the landing page's demo header, at the visitor's APPROXIMATE place. No browser permission is asked: the place is the city-level
// position the hosting network adds to the request (Vercel's x-vercel-ip-* headers, which a visitor cannot set). It is rounded, used for this one
// lookup, and neither stored nor logged. A request that carries no position gets the fallback place. Nothing in the query string is read.
export async function GET(req: NextRequest) {
  const num = (name: string) => {
    const v = Number(req.headers.get(name));
    return req.headers.get(name) !== null && Number.isFinite(v) ? v : null;
  };
  const lat = num("x-vercel-ip-latitude");
  const lng = num("x-vercel-ip-longitude");
  const located = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const timeZone = req.headers.get("x-vercel-ip-timezone") || FALLBACK_PLACE.timeZone;
  let place: string | null = null;
  try {
    place = located ? decodeURIComponent(req.headers.get("x-vercel-ip-city") ?? "").slice(0, 60) || null : null;
  } catch {
    place = null;
  }

  const forecast = await fetchForecast(approximate(located ? (lat as number) : FALLBACK_PLACE.lat), approximate(located ? (lng as number) : FALLBACK_PLACE.lng));
  const weather = forecast ? publicWeatherFrom(forecast, Date.now(), timeZone, place) : null;
  if (!weather) return NextResponse.json({ error: "unavailable" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  // private: the answer depends on where the visitor is, so a shared cache must not hand it to someone else
  return NextResponse.json({ weather }, { headers: { "Cache-Control": "private, max-age=600" } });
}
