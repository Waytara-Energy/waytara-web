import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTotalInvested } from "@/lib/total-invested";
import { co2AvoidedKg, treesEquivalent } from "@/lib/environmental-impact";
import { DAY_KEYS, LIFETIME_KEYS } from "@/lib/performance-metrics";
import { byMonth, olderSavings, priceMonths, recentSavedPerDay, sumBills, type Bill, type DayEnergy } from "@/lib/savings";
import { istDate } from "@/lib/telemetry/combine";
import type { ResolvedTariff } from "@/lib/tariff";
import { CostSavings } from "./cost-savings";
import { fetchDailyMaxReadings } from "@/lib/device-readings-fetch";
import { DeviceParameterCards } from "./device-parameter-cards";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const HISTORY_DAYS = 365;
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
  tariff,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  tariff: ResolvedTariff;
}) {
  const tariffRate = tariff.rate;
  const category = device.deviceType?.category;

  if (category === "solar_inverter") {
    return <SolarInverterAnalytics supabase={supabase} device={device} tariff={tariff} />;
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
  tariff,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  tariff: ResolvedTariff;
}) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);
  const rates = { rate: tariff.rate, exportRate: tariff.exportRate, schedule: tariff.schedule, netMetering: tariff.netMetering };
  const today = new Date(new Date().getTime() + 19_800_000).toISOString().slice(0, 10);

  // What was spent on the system is account-wide (payments are not tied to a device). The day-by-day energy comes from the
  // daily rollup (a day's value = the counter's highest reading that day); the lifetime totals from the inverter's counters.
  const [totalInvested, dailyRows, { data: latestRows }] = await Promise.all([
    getTotalInvested(supabase),
    fetchDailyMaxReadings(supabase, device.id, [DAY_KEYS.pv, DAY_KEYS.load, DAY_KEYS.imported, DAY_KEYS.exported], since.toISOString()),
    supabase.from("equipment_latest").select("key_name, value").eq("equipment_id", device.id).in("key_name", [LIFETIME_KEYS.pv, LIFETIME_KEYS.load, LIFETIME_KEYS.imported, LIFETIME_KEYS.exported]),
  ]);

  const byDay = new Map<string, DayEnergy>();
  for (const r of dailyRows) {
    if (r.value === null) continue;
    const day = istDate(new Date(r.ts).getTime());
    const d = byDay.get(day) ?? { day, loadKwh: 0, importKwh: 0, exportKwh: 0, pvKwh: 0 };
    if (r.key_name === DAY_KEYS.load) d.loadKwh = r.value;
    else if (r.key_name === DAY_KEYS.imported) d.importKwh = r.value;
    else if (r.key_name === DAY_KEYS.exported) d.exportKwh = r.value;
    else if (r.key_name === DAY_KEYS.pv) d.pvKwh = r.value;
    byDay.set(day, d);
  }
  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  const months = priceMonths(byMonth(days), tariff.timeline, rates, today);

  const latest = new Map((latestRows ?? []).map((r) => [r.key_name, r.value]));
  const has = (k: string) => typeof latest.get(k) === "number";
  const lifetime =
    has(LIFETIME_KEYS.load) && has(LIFETIME_KEYS.imported) && has(LIFETIME_KEYS.exported)
      ? { loadKwh: latest.get(LIFETIME_KEYS.load) as number, importKwh: latest.get(LIFETIME_KEYS.imported) as number, exportKwh: latest.get(LIFETIME_KEYS.exported) as number, pvKwh: (latest.get(LIFETIME_KEYS.pv) as number | undefined) ?? 0 }
      : null;
  const pvLifetime = latest.get(LIFETIME_KEYS.pv);
  const co2Kg = typeof pvLifetime === "number" ? co2AvoidedKg(pvLifetime) : null;

  // Since commissioning = the months on file, each on its own bill, plus whatever the counters hold from before the history starts
  // (priced at the tariff's typical rate - there is no month to put it in).
  let lifetimeBill: Bill | null = null;
  if (lifetime) {
    const inWindow = days.reduce((s, d) => ({ loadKwh: s.loadKwh + d.loadKwh, importKwh: s.importKwh + d.importKwh, exportKwh: s.exportKwh + d.exportKwh }), { loadKwh: 0, importKwh: 0, exportKwh: 0 });
    const older = { loadKwh: Math.max(0, lifetime.loadKwh - inWindow.loadKwh), importKwh: Math.max(0, lifetime.importKwh - inWindow.importKwh), exportKwh: Math.max(0, lifetime.exportKwh - inWindow.exportKwh) };
    lifetimeBill = sumBills([...months.map((m) => m.bill), olderSavings(older, rates)]);
  }

  return (
    <CostSavings
      tariff={tariff}
      lifetime={lifetimeBill}
      months={months}
      invested={totalInvested}
      savedPerDay={recentSavedPerDay(days, rates)}
      co2Kg={co2Kg}
      trees={co2Kg === null ? null : treesEquivalent(co2Kg)}
    />
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
    .from("ev_sessions")
    .select("started_at, ended_at, start_energy_kwh, end_energy_kwh")
    .eq("equipment_id", device.id)
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
