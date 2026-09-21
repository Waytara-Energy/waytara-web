import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import type { DailyPoint } from "./performance-chart";
import { PerformanceChart } from "./lazy-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aggregateDailyYield, maxByDeviceDay, sumByDay, type RawReading } from "@/lib/energy-aggregation";
import { DeviceParameterCards } from "./device-parameter-cards";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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

export function StatTile({ label, value }: { label: string; value: string }) {
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

/** Picks the right category-specific Analytics body — mirrors
 *  DeviceOverviewContent/MonitoringContent/PerformanceContent's dispatch
 *  pattern (Phases 1-3). A category without one yet falls back to the same
 *  generic parameter cards every other unhandled category gets elsewhere. */
export async function AnalyticsContent({
  supabase,
  device,
  tariffRate,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  tariffRate: number;
}) {
  const category = device.deviceType?.category;

  if (category === "solar_inverter") {
    return <SolarInverterAnalytics supabase={supabase} device={device} tariffRate={tariffRate} />;
  }
  if (category === "ev_charger") {
    return <EvChargerAnalytics supabase={supabase} device={device} tariffRate={tariffRate} />;
  }

  const parameters = await fetchDeviceParameterReadings(supabase, device);
  return <DeviceParameterCards parameters={parameters} />;
}

async function SolarInverterAnalytics({
  supabase,
  device,
  tariffRate,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  tariffRate: number;
}) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  // totalInvested stays account-wide (payments aren't tied to a device),
  // even though the yield/savings chart below is device-scoped — the two
  // figures answer different questions (what you spent on the system vs.
  // what this one device has generated).
  const [{ data: payments }, { data }, { data: extra }, { data: latestRows }] = await Promise.all([
    supabase.from("payments").select("amount, status").eq("status", "paid"),
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
  ]);

  const readings = data ?? [];
  const extraRows = extra ?? [];
  let batteryCycleCount: number | null = null;
  for (const r of latestRows ?? []) {
    if (r.instrument_key === "battery_cycle_count" && batteryCycleCount === null) batteryCycleCount = r.value;
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
  const avgDailySaving = dailyKwh.length > 0 ? (dailyKwh.reduce((s, p) => s + p.value, 0) * tariffRate) / dailyKwh.length : 0;
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

  // Grid cost estimation — same tariff rate the yield savings above use; a
  // real feed-in tariff for exports often differs from the import rate,
  // but the register only reports kWh, so this is the same simplification
  // already made for "saved to date".
  const gridImportKwh = extraRows.filter((r) => r.instrument_key === "grid_buy_energy_today_kwh") as RawReading[];
  const gridExportKwh = extraRows.filter((r) => r.instrument_key === "grid_sell_energy_today_kwh") as RawReading[];
  const totalImportKwh = aggregateDailyYield(gridImportKwh).reduce((s, p) => s + p.value, 0);
  const totalExportKwh = aggregateDailyYield(gridExportKwh).reduce((s, p) => s + p.value, 0);

  return (
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
        <PerformanceChart daily={cumulativeSavings} aggregationMode="last" valueFormat="inr" totalLabel="Saved to date" />
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
  );
}

async function EvChargerAnalytics({
  supabase,
  device,
  tariffRate,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  tariffRate: number;
}) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  // Cost is computed from *sessions* (Phase 0's charging_sessions), not a
  // raw cumulative register — a session's own energy delta is what a
  // customer actually paid for on that visit, the same "cost per session"
  // every EV charging app (ChargePoint, Wallbox) leads with, unlike the
  // solar side's tariff-per-kWh-generated framing.
  const { data: sessions } = await supabase
    .from("charging_sessions")
    .select("started_at, ended_at, start_energy_kwh, end_energy_kwh")
    .eq("device_id", device.id)
    .gte("started_at", since.toISOString())
    .not("ended_at", "is", null);

  const completed = (sessions ?? []).filter((s) => s.start_energy_kwh !== null && s.end_energy_kwh !== null);
  const sessionEnergies = completed.map((s) => ({
    monthKey: monthKey(s.started_at),
    energy: (s.end_energy_kwh as number) - (s.start_energy_kwh as number),
  }));

  const totalEnergyKwh = sessionEnergies.reduce((sum, s) => sum + s.energy, 0);
  const totalCost = totalEnergyKwh * tariffRate;
  const avgCostPerSession = completed.length > 0 ? totalCost / completed.length : null;

  const byMonth = new Map<string, number>();
  for (const s of sessionEnergies) byMonth.set(s.monthKey, (byMonth.get(s.monthKey) ?? 0) + s.energy);
  const thisMonthKwh = byMonth.get(monthsAgoKey(0)) ?? 0;
  const lastMonthKwh = byMonth.get(monthsAgoKey(1)) ?? null;
  const momPct = lastMonthKwh !== null ? pctChange(thisMonthKwh, lastMonthKwh) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label={`Total spend (last ${HISTORY_DAYS}d)`} value={inr(totalCost)} />
        <StatTile label="Total energy delivered" value={`${totalEnergyKwh.toFixed(1)} kWh`} />
        <StatTile label="Sessions" value={completed.length.toLocaleString("en-IN")} />
        <StatTile label="Avg. cost per session" value={avgCostPerSession !== null ? inr(avgCostPerSession) : "—"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Charging vs. Prior Month</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendTile label="Energy delivered vs. last month" pct={momPct} />
        </CardContent>
      </Card>
    </>
  );
}
