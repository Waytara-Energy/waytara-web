import { NextRequest, NextResponse } from "next/server";
import { gatherReportsBase } from "@/lib/reports/gather";
import { daysInclusive, daysIn } from "@/lib/reports/period-math";
import { periodCsv } from "@/lib/reports/period-csv";

const MAX_DAYS = 730;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// The day-by-day energy of a period as CSV. Auth is cookie-based, so RLS scopes it to whoever is signed in.
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to) || to < from || daysInclusive(from, to) > MAX_DAYS) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD dates, at most 730 days apart" }, { status: 400 });
  }
  const base = await gatherReportsBase(req.nextUrl.searchParams.get("device") ?? undefined);
  if (!base.authorized) return NextResponse.json({ error: "Not available on your plan." }, { status: 403 });
  if (!base.isSolar) return NextResponse.json({ error: "Energy exports are available for solar inverters." }, { status: 404 });

  return new NextResponse(periodCsv(daysIn(base.days, from, to)), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="waytara-energy-${from}-to-${to}.csv"` },
  });
}
