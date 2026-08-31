import { NextRequest, NextResponse } from "next/server";
import { gatherReportData, toWeeklyRows } from "@/lib/gather-report-data";
import { generateReportPdf } from "@/lib/report-pdf";

const ALLOWED_DAYS = [30, 90, 365];
const PERIOD_LABEL: Record<number, string> = {
  30: "Last 30 days",
  90: "Last 90 days",
  365: "Last 12 months",
};

export async function GET(req: NextRequest) {
  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = ALLOWED_DAYS.includes(daysParam) ? daysParam : 90;

  const report = await gatherReportData(days);
  if (!report.authorized) {
    return NextResponse.json({ error: "Not available on your plan." }, { status: 403 });
  }

  const pdfBuffer = await generateReportPdf({
    customerName: report.customerName,
    planName: report.planName,
    generatedAt: new Date().toISOString(),
    periodLabel: PERIOD_LABEL[days],
    totalKwh: report.totalKwh,
    totalSaved: report.totalSaved,
    totalInvested: report.totalInvested,
    roiPct: report.roiPct,
    tariffRate: report.tariffRate,
    sites: report.sites.map((s) => ({ name: s.name, kwhLast30Days: s.kwhLast30Days })),
    weeks: toWeeklyRows(report.daily),
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="waytara-report-${days}d.pdf"`,
    },
  });
}
