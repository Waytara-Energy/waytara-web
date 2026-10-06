import { NextRequest, NextResponse } from "next/server";
import { gatherDayReport } from "@/lib/report-day-data";
import { dayReportCsv } from "@/lib/report-day-csv";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const result = await gatherDayReport({
    deviceId: q.get("device") ?? undefined,
    date: q.get("date"),
    days: q.get("days"),
    type: q.get("type"),
    bucketMinutes: q.get("interval"),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const { report } = result;
  return new NextResponse(dayReportCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="waytara-${report.type.id}-${report.date}${report.days > 1 ? `-${report.days}d` : ""}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
