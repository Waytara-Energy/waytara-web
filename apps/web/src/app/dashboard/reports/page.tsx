import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getRequestProfile } from "@/lib/request-profile";
import { gatherReportsBase } from "@/lib/reports/gather";
import { getEnabledMetricKeys } from "@/lib/report-day-data";
import { availableReadingIds, availableReportTypes, toAvailableReports } from "@/lib/report-types";
import { toReportView, toRunView } from "@/lib/reports/saved-report-view";
import { ReportsBoard } from "@/components/dashboard/reports-board";
import { EvReportsBoard } from "@/components/dashboard/ev-reports-board";
import { EV_PERF_COLUMNS, type EvPerfSession } from "@/lib/ev-perf-stats";
import { getCustomerPlan } from "@/lib/customer-plan";
import { deviceDisplayId, getSelectedSite, resolvePageDevices, type CustomerDevice } from "@/lib/selected-site";
import { fetchResolvedTariff } from "@/lib/tariff-server";
import { CATEGORY_LABEL } from "@/lib/tariff";
import { fmtDate } from "@/lib/savings";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** How far back the EV report reads sessions: two years, the longest period a download covers. */
const EV_HISTORY_DAYS = 730;

// Server-side gate, matching Monitoring/Performance: a customer on a plan without the "reports" feature (only Advance has it) is
// redirected, not just hidden from the nav. The numbers are read once here (one history of day-by-day energy, priced on the same
// tariff Performance uses) and the page works out whatever period is chosen from them in the browser.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const { device: deviceIdParam } = await searchParams;
  const site = await getSelectedSite();
  // The inverter and the charger are tabs of this one page, so neither has to be chosen to see the other.
  const { solar, ev, chosen, focus } = await resolvePageDevices(site, deviceIdParam);
  const device = focus === null && chosen ? chosen : (solar ?? ev ?? chosen);
  const [base, profile] = await Promise.all([gatherReportsBase(device?.id ?? deviceIdParam, { tolerant: true }), getRequestProfile()]);
  if (!base.authorized || !profile) redirect("/dashboard");

  // An EV charger has its own report: the sessions of the chosen period, as figures, a table and CSV / PDF downloads. With an inverter it is
  // one more tab of the page; without one it is the page.
  const evReport = ev && (solar || device?.id === ev.id) ? await evReportFor(ev, base.customerName, base.siteName, deviceDisplayId(ev)) : null;
  if (!solar && evReport) return evReport;

  if (!base.deviceId || !base.isSolar) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>{base.deviceId ? "Reports for this device are on the way" : "No devices yet"}</EmptyTitle>
          <EmptyDescription>{base.deviceId ? "Energy reports are available for solar inverters and EV chargers today; reports for other devices are next." : "Your WayTara advisor sets this up during installation."}</EmptyDescription>
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

  return <ReportsBoard base={base} customerId={profile.id} reports={reports} runs={runs} available={available} ev={evReport} />;
}

/** The charger's report: its sessions as figures, a table, and CSV / PDF downloads. */
async function evReportFor(device: CustomerDevice, customerName: string, siteName: string | null, deviceLabel: string) {
  const supabase = await createClient();
  const [site, plan] = await Promise.all([getSelectedSite(), getCustomerPlan()]);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - EV_HISTORY_DAYS);
  const [tariff, { data }] = await Promise.all([
    fetchResolvedTariff(supabase, site, plan?.tariffRatePerKwh ?? 8),
    supabase.from("ev_sessions").select(EV_PERF_COLUMNS).eq("equipment_id", device.id).gte("started_at", since.toISOString()).order("started_at", { ascending: false }).limit(5000),
  ]);
  const where = tariff.state ? `${tariff.state} ${CATEGORY_LABEL[tariff.category]}` : CATEGORY_LABEL[tariff.category];
  return (
    <EvReportsBoard
      deviceId={device.id}
      deviceLabel={deviceLabel}
      customerName={customerName}
      siteName={siteName}
      tariffRate={tariff.rate > 0 ? tariff.rate : null}
      tariffNote={`${where} tariff${tariff.effectiveFrom ? `, in force since ${fmtDate(tariff.effectiveFrom)}` : ""}`}
      sessions={(data ?? []) as unknown as EvPerfSession[]}
    />
  );
}
