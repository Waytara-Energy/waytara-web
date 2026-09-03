import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedDevice } from "@/lib/selected-device";
import { getCustomerPlan } from "@/lib/customer-plan";
import { PerformanceChart, DivergingBarChart } from "@/components/dashboard/lazy-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { aggregateDailyYield, zipDailySeries, type RawReading } from "@/lib/energy-aggregation";
import {
  MONTH_TOTAL_FIELDS,
  YEAR_TOTAL_FIELDS,
  LIFETIME_TOTAL_FIELDS,
  formatValue,
} from "@/lib/telemetry-catalog";

const HISTORY_DAYS = 180;
const TOTALS_KEYS = [...MONTH_TOTAL_FIELDS, ...YEAR_TOTAL_FIELDS, ...LIFETIME_TOTAL_FIELDS].map((f) => f.key);
const YIELD_KEY = "solar_energy_today_kwh";
const KEYS = [
  YIELD_KEY,
  "day_battery_charge_kwh",
  "day_battery_discharge_kwh",
  "grid_buy_energy_today_kwh",
  "grid_sell_energy_today_kwh",
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
  const totals = new Map<string, number | null>();

  if (device) {
    // Three independent device-scoped reads, one round trip instead of
    // three — the totals snapshot is the same "latest value per
    // instrument" pattern Overview/Monitoring already use, just scoped to
    // the month/year/lifetime counter keys instead of live telemetry.
    const [{ data }, { data: lifetimeRow }, { data: totalsRows }] = await Promise.all([
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
      supabase
        .from("device_readings")
        .select("instrument_key, value, ts")
        .eq("device_id", device.id)
        .in("instrument_key", TOTALS_KEYS)
        .order("ts", { ascending: false })
        .limit(TOTALS_KEYS.length * 5),
    ]);
    rows = data ?? [];
    lifetimePvKwh = lifetimeRow?.value ?? null;
    for (const r of totalsRows ?? []) {
      if (!totals.has(r.instrument_key)) totals.set(r.instrument_key, r.value);
    }
  }
  const getTotal = (key: string) => totals.get(key) ?? null;

  const byKey = (key: string): RawReading[] =>
    rows.filter((r) => r.instrument_key === key).map((r) => ({ device_id: r.device_id, value: r.value, ts: r.ts }));

  const daily = aggregateDailyYield(byKey(YIELD_KEY));
  const batteryCharge = aggregateDailyYield(byKey("day_battery_charge_kwh"));
  const batteryDischarge = aggregateDailyYield(byKey("day_battery_discharge_kwh"));
  const gridImport = aggregateDailyYield(byKey("grid_buy_energy_today_kwh"));
  const gridExport = aggregateDailyYield(byKey("grid_sell_energy_today_kwh"));

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

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Period & Lifetime Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">This month</p>
                <div className="grid grid-cols-3 gap-4">
                  {MONTH_TOTAL_FIELDS.map((field) => (
                    <TotalTile key={field.key} label={field.label} value={formatValue(getTotal(field.key), field)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">This year</p>
                <div className="grid grid-cols-3 gap-4">
                  {YEAR_TOTAL_FIELDS.map((field) => (
                    <TotalTile key={field.key} label={field.label} value={formatValue(getTotal(field.key), field)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Lifetime</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {LIFETIME_TOTAL_FIELDS.map((field) => (
                    <TotalTile key={field.key} label={field.label} value={formatValue(getTotal(field.key), field)} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function TotalTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-theme-border bg-theme-surface p-3">
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-theme-primary">{value}</p>
    </div>
  );
}
