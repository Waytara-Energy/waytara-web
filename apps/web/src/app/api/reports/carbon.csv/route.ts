import { NextRequest, NextResponse } from "next/server";
import { gatherReportsBase } from "@/lib/reports/gather";
import { buildCarbonPack } from "@/lib/reports/carbon-data";
import { carbonCsv } from "@/lib/reports/carbon-csv";

// The carbon report's dataset (summary, months and every day) as CSV. Auth is cookie-based, so RLS scopes it to whoever is signed in.
export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "";
  if (!/^(all|fy-\d{4})$/.test(period)) return NextResponse.json({ error: "period must be 'all' or fy-YYYY" }, { status: 400 });
  const base = await gatherReportsBase(req.nextUrl.searchParams.get("device") ?? undefined);
  if (!base.authorized) return NextResponse.json({ error: "Not available on your plan." }, { status: 403 });
  if (!base.isSolar) return NextResponse.json({ error: "The carbon report is available for solar inverters." }, { status: 404 });
  const pack = buildCarbonPack(base, period);
  if (!pack) return NextResponse.json({ error: "There are no readings in that period." }, { status: 404 });

  return new NextResponse(carbonCsv(pack), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="waytara-carbon-${period}.csv"`, "Cache-Control": "private, no-store" },
  });
}
