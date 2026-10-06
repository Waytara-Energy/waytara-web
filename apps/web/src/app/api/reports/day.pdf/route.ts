import { NextRequest, NextResponse } from "next/server";
import { gatherDayReport } from "@/lib/report-day-data";
import { generateDayReportPdf } from "@/lib/report-day-pdf";

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
  const pdf = await generateDayReportPdf(report, new Date().toISOString());
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="waytara-${report.type.id}-${report.date}${report.days > 1 ? `-${report.days}d` : ""}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
