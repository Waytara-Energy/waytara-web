import { redirect } from "next/navigation";
import { gatherReportData, toWeeklyRows } from "@/lib/gather-report-data";
import { ReportControls } from "@/components/dashboard/report-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DEFAULT_DAYS = 90;

// Server-side gate, matching Monitoring/Performance/Analytics — a customer
// on a plan without the "reports" feature (only Advance has it) gets
// redirected, not just hidden from the nav.
export default async function ReportsPage() {
  const report = await gatherReportData(DEFAULT_DAYS);
  if (!report.authorized) {
    redirect("/dashboard");
  }

  const weeks = toWeeklyRows(report.daily, 8);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Reports</h1>
        <p className="mt-1 text-sm text-theme-muted">Export your energy and savings data as CSV or PDF.</p>
      </div>

      <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
        <ReportControls defaultDays={DEFAULT_DAYS} />
      </div>

      <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
        <h2 className="mb-3 text-sm font-semibold text-theme-primary">Weekly yield (last 8 weeks)</h2>
        {weeks.length === 0 ? (
          <p className="text-sm text-theme-muted">No readings yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-theme-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead className="text-right">Yield</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeks.map((w) => (
                  <TableRow key={w.label}>
                    <TableCell className="text-foreground">{w.label}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {w.kwh.toFixed(1)} kWh
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
