import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedDevice } from "@/lib/selected-device";
import { getCustomerPlan } from "@/lib/customer-plan";
import { PerformanceChart, DivergingBarChart } from "@/components/dashboard/lazy-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { aggregateDailyYield, zipDailySeries, type RawReading } from "@/lib/energy-aggregation";

const HISTORY_DAYS = 180;
const YIELD_KEY = "daily_yield_kwh";
const KEYS = [
  YIELD_KEY,
  "day_battery_charge_kwh",
  "day_battery_discharge_kwh",
  "day_grid_import_kwh",
  "day_grid_export_kwh",
];

// Server-side gate, matching Monitoring (Task 10.1) — a Basic-tier customer
// hitting this URL directly gets redirected, not just hidden from the nav.
//
// Telemetry-driven redesign (Phase 10): the daily-yield chart stays, joined
// by battery charge-vs-discharge and grid import-vs-export as diverging
// comparisons (cycling behavior / self-consumption vs. grid dependency),
// a computed self-consumption %, and the lifetime PV hero stat.
export default async function PerformancePage() {
  const supabase = await createClient();
  // Device-centric redesign: yield for the *selected* device only, not
  // summed across every device the customer owns. Independent of the
  // plan check below, so it runs alongside it. getCustomerPlan() is
  // cache()-deduped against the layout's own call, so this costs nothing
  // extra.
  const [customerPlan, device] = await Promise.all([getCustomerPlan(), getSelectedDevice()]);

  const features = customerPlan?.features ?? {};
  if (!features.performance) {
    redirect("/dashboard");
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  let rows: { device_id: string; instrument_key: string; value: number | null; ts: string }[] = [];
  let lifetimePvKwh: number | null = null;

  if (device) {
    // Both scoped to the same device, neither depends on the other's
    // result — one round trip instead of two.
    const [{ data }, { data: lifetimeRow }] = await Promise.all([
      supabase
        .from("device_readings")
        .select("device_id, instrument_key, value, ts")
        .eq("device_id", device.id)
        .in("instrument_key", KEYS)
        .eq("is_test", false)
        .gte("ts", since.toISOString())
        .order("ts", { ascending: true }),
      supabase
        .from("device_readings")
        .select("value")
        .eq("device_id", device.id)
        .eq("instrument_key", "total_pv_energy_kwh")
        .order("ts", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    rows = data ?? [];
    lifetimePvKwh = lifetimeRow?.value ?? null;
  }

  const byKey = (key: string): RawReading[] =>
    rows.filter((r) => r.instrument_key === key).map((r) => ({ device_id: r.device_id, value: r.value, ts: r.ts }));

  const daily = aggregateDailyYield(byKey(YIELD_KEY));
  const batteryCharge = aggregateDailyYield(byKey("day_battery_charge_kwh"));
  const batteryDischarge = aggregateDailyYield(byKey("day_battery_discharge_kwh"));
  const gridImport = aggregateDailyYield(byKey("day_grid_import_kwh"));
  const gridExport = aggregateDailyYield(byKey("day_grid_export_kwh"));

  const batteryDiverging = zipDailySeries(batteryCharge, batteryDischarge);
  const gridDiverging = zipDailySeries(gridExport, gridImport);

  const totalYield = daily.reduce((sum, p) => sum + p.value, 0);
  const totalExported = gridExport.reduce((sum, p) => sum + p.value, 0);
  const selfConsumptionPct = totalYield > 0 ? Math.max(0, Math.min(100, ((totalYield - totalExported) / totalYield) * 100)) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Performance</h1>
        <p className="mt-1 text-sm text-theme-muted">
          {device
            ? `Energy yield over time for ${device.label || device.deviceUid}.`
            : "Household energy yield over time."}
        </p>
      </div>

      {!device ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrendingUp />
            </EmptyMedia>
            <EmptyTitle>No devices yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Self-consumption (last {HISTORY_DAYS}d)
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {selfConsumptionPct !== null ? `${selfConsumptionPct.toFixed(0)}%` : "No data yet"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total PV energy (lifetime)
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {lifetimePvKwh !== null ? `${lifetimePvKwh.toLocaleString("en-IN")} kWh` : "No data yet"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
            <PerformanceChart daily={daily} unit="kWh" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Battery: Charge vs. Discharge</CardTitle>
            </CardHeader>
            <CardContent>
              <DivergingBarChart data={batteryDiverging} positiveLabel="Charged" negativeLabel="Discharged" unit="kWh" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Grid: Export vs. Import</CardTitle>
            </CardHeader>
            <CardContent>
              <DivergingBarChart data={gridDiverging} positiveLabel="Exported" negativeLabel="Imported" unit="kWh" />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
