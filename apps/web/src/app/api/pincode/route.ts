import { NextRequest, NextResponse } from "next/server";
import { placeForPincode } from "@/lib/geocode";
import { allowRequest, clientIp } from "@/lib/rate-limit";

// City and state for a PIN code, for the public lead forms. Open to visitors, so it is limited per client IP and in total, and what it
// finds is kept for 30 days (a PIN code does not move), so a repeat costs the address service nothing.
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const kept = new Map<string, { at: number; found: { city: string | null; state: string | null } | null }>();

export async function GET(req: NextRequest) {
  const pin = req.nextUrl.searchParams.get("pin")?.trim() ?? "";
  if (!/^[1-9]\d{5}$/.test(pin)) return NextResponse.json({ error: "Not a PIN code." }, { status: 400 });

  const hit = kept.get(pin);
  if (hit && Date.now() - hit.at < KEEP_MS) return NextResponse.json(hit.found ? hit.found : { error: "not-found" }, { headers: { "Cache-Control": "public, max-age=86400" } });

  const allowed = (await allowRequest("pincode:ip", clientIp(req.headers), 30, 10 * 60)) && (await allowRequest("pincode:global", "all", 3000, 60 * 60));
  if (!allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const place = await placeForPincode(pin);
  if (place === undefined) return NextResponse.json({ error: "unavailable" }, { status: 200 }); // the service did not answer: not remembered
  const found = place && (place.city || place.state) ? { city: place.city, state: place.state } : null;
  kept.set(pin, { at: Date.now(), found });
  return NextResponse.json(found ?? { error: "not-found" }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
