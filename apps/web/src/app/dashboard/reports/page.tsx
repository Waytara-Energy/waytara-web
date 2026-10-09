import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getRequestProfile } from "@/lib/request-profile";
import { gatherReportsBase } from "@/lib/reports/gather";
import { getEnabledMetricKeys } from "@/lib/report-day-data";
import { availableReadingIds, availableReportTypes, toAvailableReports } from "@/lib/report-types";
import { toReportView, toRunView } from "@/lib/reports/saved-report-view";
import { ReportsBoard } from "@/components/dashboard/reports-board";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// Server-side gate, matching Monitoring/Performance: a customer on a plan without the "reports" feature (only Advance has it) is
// redirected, not just hidden from the nav. The numbers are read once here (one history of day-by-day energy, priced on the same
// tariff Performance uses) and the page works out whatever period is chosen from them in the browser.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const { device: deviceIdParam } = await searchParams;
  const [base, profile] = await Promise.all([gatherReportsBase(deviceIdParam), getRequestProfile()]);
  if (!base.authorized || !profile) redirect("/dashboard");

  if (!base.deviceId || !base.isSolar) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>{base.deviceId ? "Reports for this device are on the way" : "No devices yet"}</EmptyTitle>
          <EmptyDescription>{base.deviceId ? "Energy reports are available for solar inverters today; charger reports are next." : "Your WayTara advisor sets this up during installation."}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  // The time-series reports offer only what this device's own metrics can supply (a PV3 report is never offered on a two-input
  // inverter). The customer's own saved reports and their latest e-mails come with the page and then follow live.
  const supabase = await createClient();
  const [keys, savedRows, runRows] = await Promise.all([
    getEnabledMetricKeys(base.deviceId),
    supabase.from("customer_reports").select("id, name, equipment_id, params, schedule_kind, schedule_time, schedule_dow, schedule_dom, send_to_me, recipients, enabled, next_run_at, last_run_at").order("created_at", { ascending: false }),
    supabase.from("customer_report_runs").select("id, report_id, status, trigger, recipients, error, started_at, finished_at").order("started_at", { ascending: false }).limit(100),
  ]);
  // Every single reading the device reports (voltage, current, frequency...) is offered in the filter, not only those in the ready-made reports.
  const available = [...toAvailableReports(availableReportTypes(keys)), { id: "readings", seriesIds: availableReadingIds(keys) }];
  const reports = (savedRows.data ?? []).map(toReportView).filter((r): r is NonNullable<typeof r> => r !== null);
  const runs = (runRows.data ?? []).map(toRunView);

  return <ReportsBoard base={base} customerId={profile.id} reports={reports} runs={runs} available={available} />;
}
