import { NextRequest, NextResponse } from "next/server";
import { getRequestProfile } from "@/lib/request-profile";
import { geocoderName, placeById, reversePlace, searchPlaces } from "@/lib/geocode";

// Address search and "what is at this spot" for the site map. Signed-in customers only (the key of the address service stays on the
// server), and the inputs are checked: a search text of a sensible length, or a position on Earth, or a place id.
//   GET ?q=text[&lat=&lng=]   places that match (nearest to lat/lng first)
//   GET ?lat=&lng=            the address at a spot
//   GET ?place_id=id          the position of a result that came without one
export async function GET(req: NextRequest) {
  const profile = await getRequestProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const lat = sp.has("lat") ? Number(sp.get("lat")) : null;
  const lng = sp.has("lng") ? Number(sp.get("lng")) : null;
  const placeId = sp.get("place_id")?.trim() ?? "";
  const validPoint = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const headers = { "Cache-Control": "private, max-age=60" };

  if (q) {
    if (q.length < 2 || q.length > 120) return NextResponse.json({ places: [] }, { headers });
    const places = await searchPlaces(q, validPoint ? { lat, lng } : undefined);
    return NextResponse.json(places ? { places, provider: geocoderName() } : { error: "unavailable" }, { headers });
  }
  if (placeId) {
    if (placeId.length > 200) return NextResponse.json({ error: "Not a valid place." }, { status: 400 });
    const place = await placeById(placeId);
    return NextResponse.json(place ? { place } : { error: "unavailable" }, { headers });
  }
  if (validPoint) {
    const place = await reversePlace(lat, lng);
    return NextResponse.json(place ? { place, provider: geocoderName() } : { error: "unavailable" }, { headers });
  }
  return NextResponse.json({ error: "Give a search text, a position or a place id." }, { status: 400 });
}
