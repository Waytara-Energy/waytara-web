import { NextRequest, NextResponse } from "next/server";
import { daysInclusive } from "@/lib/reports/period-math";
import { evReportCsv } from "@/lib/reports/ev-report";
import { gatherEvReport } from "@/lib/reports/ev-report-data";
import { EV_REPORT_MODES, parseEvFilters, type EvReportMode } from "@/lib/reports/ev-filters";

const MAX_DAYS = 730;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// The EV charger's sessions of a period as CSV. Auth is cookie-based, so RLS scopes it to whoever is signed in.
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to) || to < from || daysInclusive(from, to) > MAX_DAYS) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD dates, at most 730 days apart" }, { status: 400 });
  }
  const q = req.nextUrl.searchParams;
  const asked = q.get("mode") as EvReportMode | null;
  const mode: EvReportMode = asked && EV_REPORT_MODES.includes(asked) ? asked : "sessions";
  const r = await gatherEvReport(q.get("device") ?? undefined, from, to, parseEvFilters((k) => q.get(k)));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return new NextResponse(evReportCsv(r.report, mode), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="waytara-ev-${mode === "sessions" ? "charging" : mode === "daily" ? "daily" : "statement"}-${from}-to-${to}.csv"` },
  });
}
