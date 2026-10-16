import { NextRequest, NextResponse } from "next/server";
import { getRequestProfile } from "@/lib/request-profile";
import { getSelectedSite, resolveDeviceInSite } from "@/lib/selected-site";
import { cadenceConfigured, readCadence } from "@/lib/cadence-hub";

// The readings of a device at their own rhythm (5 s / 10 s / 30 s) between two times: what Go Live opens with, and what the day report
// uses for "Today". The device must be one the signed-in person can see (it is looked up in their selected site, never taken on trust
// from the request); the data itself comes from the WayTara readings service (the hub, see lib/cadence-hub.ts), which checks again.
//
//   GET /api/cadence?device=<equipment id>&from=<epoch ms>&to=<epoch ms>&keys=a,b,c
//   -> { from_ms, to_ms, series: { key: [[epoch ms, value], ...] }, unknown: [keys with no cadence history] }
const MAX_SPAN_MS = 36 * 3_600_000;
const MAX_KEYS = 60;

export async function GET(req: NextRequest) {
  const [profile, site] = await Promise.all([getRequestProfile(), getSelectedSite()]);
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const device = await resolveDeviceInSite(site, req.nextUrl.searchParams.get("device") ?? undefined);
  if (!site || !device) return NextResponse.json({ error: "No device found." }, { status: 404 });
  if (!cadenceConfigured()) return NextResponse.json({ error: "The cadence history is not set up yet." }, { status: 503 });

  const fromMs = Number(req.nextUrl.searchParams.get("from"));
  const toMs = Number(req.nextUrl.searchParams.get("to"));
  const keys = (req.nextUrl.searchParams.get("keys") ?? "").split(",").map((k) => k.trim()).filter((k) => /^[a-z0-9_]{1,80}$/.test(k));
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return NextResponse.json({ error: "Bad time range." }, { status: 400 });
  if (toMs - fromMs > MAX_SPAN_MS) return NextResponse.json({ error: "That range is too long." }, { status: 400 });
  if (keys.length === 0 || keys.length > MAX_KEYS) return NextResponse.json({ error: "Ask for between 1 and 60 metrics." }, { status: 400 });

  try {
    const { series, unknown } = await readCadence(device.id, keys, fromMs, toMs);
    return NextResponse.json({ from_ms: fromMs, to_ms: toMs, series, unknown }, { headers: { "Cache-Control": "private, max-age=10" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The cadence history is unavailable." }, { status: 502 });
  }
}
