import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedDevice } from "@/lib/selected-device";
import { getCustomerPlan } from "@/lib/customer-plan";
import type { DailyPoint } from "@/components/dashboard/performance-chart";
import { PerformanceChart } from "@/components/dashboard/lazy-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { aggregateDailyYield, maxByDeviceDay, sumByDay, type RawReading } from "@/lib/energy-aggregation";

const HISTORY_DAYS = 365;
const YIELD_INSTRUMENT_KEY = "solar_energy_today_kwh";
const EXTRA_KEYS = ["grid_buy_energy_today_kwh", "grid_sell_energy_today_kwh"];

function inr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function monthKey(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

function monthsAgoKey(monthsBack: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - monthsBack, 1);
  return d.toISOString().slice(0, 7);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Server-side gate, matching Monitoring/Performance — a Basic or Pro
// customer without the Advance-tier "analytics" feature gets redirected,
// not just hidden from the nav.
//
// Telemetry-driven redesign (Phase 11): the savings/ROI chart stays, joined
// by a month-over-month / year-over-year PV comparison, grid import/export
// cost estimation, and battery cycle count. (The essential-vs-non-essential
// load split this phase originally shipped with was removed in the Modbus
// register mapping pass — essential_load_pct has no confirmed register on
// the real hardware, only a derived Watts formula, so the field was
// dropped from the catalog rather than ship a card that can never
// populate for a real customer.)
export default async function AnalyticsPage() {
  const supabase = await createClient();
  // Device-centric redesign: cost savings/ROI for the *selected* device's
  // own yield, not summed across every device — the cross-site comparison
  // chart this page used to carry is gone along with that, since a
  // single-device view has nothing left to compare against. Independent
  // of the plan check below, so it runs alongside it. getCustomerPlan()
  // is cache()-deduped against the layout's own call and carries the
  // tariff rate too, so this replaces what used to be a separate
  // `customers` query here.
  const [customerPlan, device] = await Promise.all([getCustomerPlan(), getSelectedDevice()]);

  const features = customerPlan?.features ?? {};
  if (!features.analytics) {
    redirect("/dashboard");
  }
  const tariffRate = customerPlan?.tariffRatePerKwh ?? 8;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  let readings: { device_id: string; value: number | null; ts: string }[] = [];
  let extraRows: { instrument_key: string; device_id: string; value: number | null; ts: string }[] = [];
  let batteryCycleCount: number | null = null;

  // totalInvested stays account-wide (payments aren't tied to a device),
  // even though the yield/savings chart below is device-scoped — the two
  // figures answer different questions (what you spent on the system vs.
  // what this one device has generated). Doesn't depend on `device` at
  // all, so it's fetched alongside the device-scoped queries below rather
  // than after them.
  const paymentsPromise = supabase.from("payments").select("amount, status").eq("status", "paid");

  const [{ data: payments }, deviceQueries] = await Promise.all([
    paymentsPromise,
    device
      ? // Three independent device-scoped reads, none depending on
        // another's result — one round trip instead of three.
        Promise.all([
          supabase
            .from("device_readings")
            .select("device_id, value, ts")
            .eq("device_id", device.id)
            .eq("instrument_key", YIELD_INSTRUMENT_KEY)
            .eq("is_test", false)
            .gte("ts", since.toISOString())
            .order("ts", { ascending: true }),
          supabase
            .from("device_readings")
            .select("instrument_key, device_id, value, ts")
            .eq("device_id", device.id)
            .in("instrument_key", EXTRA_KEYS)
            .eq("is_test", false)
            .gte("ts", since.toISOString())
            .order("ts", { ascending: true }),
          supabase
            .from("device_readings")
            .select("instrument_key, value, ts")
            .eq("device_id", device.id)
            .in("instrument_key", ["battery_cycle_count"])
            .order("ts", { ascending: false })
            .limit(20),
        ])
      : null,
  ]);

  if (deviceQueries) {
    const [{ data }, { data: extra }, { data: latestRows }] = deviceQueries;
    readings = data ?? [];
    extraRows = extra ?? [];
    for (const r of latestRows ?? []) {
      if (r.instrument_key === "battery_cycle_count" && batteryCycleCount === null) batteryCycleCount = r.value;
    }
  }

  const totalInvested = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const perDeviceDay = maxByDeviceDay(readings);
  const dailyKwh = sumByDay(perDeviceDay);

  let running = 0;
  const cumulativeSavings: DailyPoint[] = dailyKwh.map((p) => {
    running += p.value;
    return { date: p.date, value: running * tariffRate };
  });

  const totalSavedToDate = cumulativeSavings[cumulativeSavings.length - 1]?.value ?? 0;
  const avgDailySaving =
    dailyKwh.length > 0 ? (dailyKwh.reduce((s, p) => s + p.value, 0) * tariffRate) / dailyKwh.length : 0;
  const remaining = Math.max(0, totalInvested - totalSavedToDate);
  const paybackMonths = avgDailySaving > 0 ? remaining / (avgDailySaving * 30) : null;
  const roiPct = totalInvested > 0 ? (totalSavedToDate / totalInvested) * 100 : null;

  // Month-over-month / year-over-year: bucket the same 365-day daily-yield
  // series by calendar month, then compare this month's total (so far)
  // against last month's and the same month a year ago. With only up to
  // HISTORY_DAYS of history, the year-ago bucket may not exist yet — shown
  // as "—" rather than a misleading 0.
  const byMonth = new Map<string, number>();
  for (const p of dailyKwh) byMonth.set(monthKey(p.date), (byMonth.get(monthKey(p.date)) ?? 0) + p.value);
  const thisMonth = byMonth.get(monthsAgoKey(0)) ?? 0;
  const lastMonth = byMonth.get(monthsAgoKey(1)) ?? null;
  const sameMonthLastYear = byMonth.get(monthsAgoKey(12)) ?? null;
  const momPct = lastMonth !== null ? pctChange(thisMonth, lastMonth) : null;
  const yoyPct = sameMonthLastYear !== null ? pctChange(thisMonth, sameMonthLastYear) : null;

  // Grid cost estimation — same tariff rate the yield savings above use;
  // a real feed-in tariff for exports often differs from the import rate,
  // but the register only reports kWh, so this is the same simplification
  // already made for "saved to date".
  const gridImportKwh = extraRows.filter((r) => r.instrument_key === "grid_buy_energy_today_kwh") as RawReading[];
  const gridExportKwh = extraRows.filter((r) => r.instrument_key === "grid_sell_energy_today_kwh") as RawReading[];
  const totalImportKwh = aggregateDailyYield(gridImportKwh).reduce((s, p) => s + p.value, 0);
  const totalExportKwh = aggregateDailyYield(gridExportKwh).reduce((s, p) => s + p.value, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Analytics</h1>
        <p className="mt-1 text-sm text-theme-muted">
          {device ? `${device.label || device.deviceUid}'s cost savings and return on investment` : "Cost savings and return on investment"}
          , estimated at ₹{tariffRate.toFixed(2)}/kWh.
        </p>
      </div>

      {!device ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BarChart3 />
            </EmptyMedia>
            <EmptyTitle>No devices yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Total invested" value={inr(totalInvested)} />
            <StatTile label="Saved to date" value={inr(totalSavedToDate)} />
            <StatTile label="Return on investment" value={roiPct !== null ? `${roiPct.toFixed(0)}%` : "—"} />
            <StatTile
              label="Est. time to break even"
              value={
                totalInvested === 0
                  ? "—"
                  : remaining === 0
                    ? "Recovered"
                    : paybackMonths !== null
                      ? `${Math.ceil(paybackMonths)} mo`
                      : "—"
              }
            />
          </div>

          <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
            <h2 className="mb-3 text-sm font-semibold text-theme-primary">Cumulative savings over time</h2>
            <PerformanceChart
              daily={cumulativeSavings}
              aggregationMode="last"
              valueFormat="inr"
              totalLabel="Saved to date"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Generation vs. Prior Periods</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <TrendTile label="Vs. last month" pct={momPct} />
              <TrendTile label="Vs. same month last year" pct={yoyPct} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Grid Cost Estimate (last {HISTORY_DAYS}d)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <StatTile label="Grid import cost" value={inr(totalImportKwh * tariffRate)} />
              <StatTile label="Grid export credit" value={inr(totalExportKwh * tariffRate)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Battery Health</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">
                {batteryCycleCount !== null ? batteryCycleCount.toLocaleString("en-IN") : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Charge cycles to date</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-theme-border bg-theme-surface p-3">
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-theme-primary">{value}</p>
    </div>
  );
}

function TrendTile({ label, pct }: { label: string; pct: number | null }) {
  const up = pct !== null && pct > 0;
  const down = pct !== null && pct < 0;
  return (
    <div className="rounded-lg border border-theme-border bg-theme-surface p-3">
      <p className="text-xs text-theme-muted">{label}</p>
      <p
        className={
          "mt-1 text-xl font-semibold " +
          (up ? "text-emerald-600 dark:text-emerald-400" : down ? "text-amber-600 dark:text-amber-400" : "text-theme-primary")
        }
      >
        {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`}
      </p>
    </div>
  );
}
