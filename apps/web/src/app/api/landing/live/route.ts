import { NextRequest, NextResponse } from "next/server";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { getLandingSnapshot } from "@/lib/landing-live";

// The live figures behind the laptop on the landing page (the Waytara Office inverter). Public and read-only: it serves a short,
// fixed list of readings for one device (see lib/landing-live.ts), is cached for a few seconds, and is rate limited per visitor.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await allowRequest("landing_live", clientIp(req.headers), 40, 60))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "30" } });
  }
  try {
    const snapshot = await getLandingSnapshot();
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "public, s-maxage=4, stale-while-revalidate=8" } });
  } catch (err) {
    console.error("[landing-live]", err);
    return NextResponse.json({ error: "Live data is unavailable right now" }, { status: 503 });
  }
}
