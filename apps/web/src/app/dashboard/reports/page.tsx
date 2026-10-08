import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { gatherReportData, toWeeklyRows } from "@/lib/gather-report-data";
import { fetchDashboardFields, fetchFieldValues, resolveComputedValues, type FieldValue } from "@/lib/template-fields";
import { LiveDynamicFieldGroup } from "@/components/dashboard/live-field-group";
import { valuesFor } from "@/lib/field-values";
import { ReportControls } from "@/components/dashboard/report-controls";
import { DayReport } from "@/components/dashboard/day-report";
import { getEnabledMetricKeys } from "@/lib/report-day-data";
import { availableReportTypes, toAvailableReports } from "@/lib/report-types";
import { DeviceTitle } from "@/components/dashboard/device-title";
import { ChartEmptyState } from "@/components/dashboard/chart-empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

const DEFAULT_DAYS = 90;

function groupTitle(category: string, groupName: string | null): string {
  return groupName ? `${category} — ${groupName}` : category;
}

// Server-side gate, matching Monitoring/Performance/Analytics — a customer
// on a plan without the "reports" feature (only Advance has it) gets
// redirected, not just hidden from the nav.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const { device: deviceIdParam } = await searchParams;
  const report = await gatherReportData(DEFAULT_DAYS, deviceIdParam);
  if (!report.authorized) {
    redirect("/dashboard");
  }

  const weeks = toWeeklyRows(report.daily, 8);
  const device = report.site && report.deviceId ? (report.site.devices.find((d) => d.id === report.deviceId) ?? null) : null;

  // The new equipment_templates inventory has no Reports-section rows for
  // ev_charger at all (confirmed via direct query) — every Reports field
  // is solar-only, so this section is skipped entirely for any other
  // category rather than rendering an empty shell.
  let reportSections: Awaited<ReturnType<typeof fetchDashboardFields>> = [];
  let getFieldValue: (key: string) => FieldValue = () => null;
  if (device && device.deviceType?.category === "solar_inverter") {
    const supabase = await createClient();
    reportSections = await fetchDashboardFields(supabase, device, "Reports");
    const dynamicFields = reportSections.flatMap((s) => s.groups.flatMap((g) => g.fields));
    const dynamicKeys = dynamicFields.map((f) => f.key);
    // total_pv_energy_kwh is Monitoring-owned, cross-referenced for
    // co2_saved_kg/trees_equivalent's own resolvers (same reuse pattern
    // every other phase already established).
    const rawValues = await fetchFieldValues(supabase, device.id, [...dynamicKeys, "total_pv_energy_kwh"]);
    const values = resolveComputedValues(dynamicFields, rawValues, device);
    // savings_amount is this exact page's own totalSaved figure
    // (totalKwh * tariffRate over the selected period) — gatherReportData
    // already computes it for the weekly table above, reused here rather
    // than recomputed.
    getFieldValue = (key) => (key === "savings_amount" ? report.totalSaved : (values.get(key) ?? null));
  }

  // Daily-report choices come from this device's own equipment_metrics (read + show_for_user),
  // so a metric that isn't enabled for it (e.g. PV3 on a 2-input inverter) is never offered.
  const dailyReports =
    device && device.deviceType?.category === "solar_inverter"
      ? toAvailableReports(availableReportTypes(await getEnabledMetricKeys(device.id)))
      : [];

  // The first day with readings: the custom window can't start before it.
  let firstDay: string | null = null;
  if (dailyReports.length > 0 && device) {
    const { data } = await (await createClient()).rpc("device_data_range", { p_equipment_id: device.id });
    const row = Array.isArray(data) ? data[0] : data;
    firstDay = (row?.first_day as string | undefined) ?? null;
  }

  return (
    <div className="space-y-6">
      {!device ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>No devices yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DeviceTitle devices={report.site?.devices ?? [device]} selectedId={device.id} />
              <p className="mt-1 text-sm text-theme-muted">Pick a report and a day (00:00 to 23:59) or a window of 7, 30, 90 days or up to 30 days from a date you choose, then download it as CSV or PDF.</p>
            </div>
          </div>

          {dailyReports.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-theme-primary">Daily report</h2>
              <DayReport deviceId={device.id} available={dailyReports} firstDay={firstDay} />
            </div>
          )}

          <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
            <h2 className="mb-3 text-sm font-semibold text-theme-primary">Long-range yield export</h2>
            <ReportControls defaultDays={DEFAULT_DAYS} deviceId={report.deviceId} />
          </div>

          <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
            <h2 className="mb-3 text-sm font-semibold text-theme-primary">Weekly yield (last 8 weeks)</h2>
            {weeks.length === 0 ? (
              <ChartEmptyState />
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

          {reportSections.map((section) =>
            section.groups.map((group) => (
              <LiveDynamicFieldGroup deviceId={device.id}
                key={`${section.category}-${group.groupName ?? ""}`}
                title={groupTitle(section.category, group.groupName)}
                fields={group.fields}
                initial={valuesFor(group.fields, getFieldValue)}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
