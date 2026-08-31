import { redirect } from "next/navigation";
import { gatherReportData, toWeeklyRows } from "@/lib/gather-report-data";
import { ReportControls } from "@/components/dashboard/report-controls";

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
            <table className="w-full text-sm">
              <thead className="bg-theme-surface text-left text-xs uppercase tracking-wide text-theme-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Week</th>
                  <th className="px-3 py-2 font-medium">Yield</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {weeks.map((w) => (
                  <tr key={w.label}>
                    <td className="px-3 py-2 text-theme-primary">{w.label}</td>
                    <td className="px-3 py-2 tabular-nums text-theme-secondary">{w.kwh.toFixed(1)} kWh</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
