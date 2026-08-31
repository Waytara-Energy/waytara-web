import { redirect } from "next/navigation";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { PerformanceChart, type DailyPoint } from "@/components/dashboard/performance-chart";
import { SiteComparisonChart, type SitePoint } from "@/components/dashboard/site-comparison-chart";
import { maxByDeviceDay, sumByDay } from "@/lib/energy-aggregation";

const HISTORY_DAYS = 365;
const COMPARISON_WINDOW_DAYS = 30;
const YIELD_INSTRUMENT_KEY = "daily_yield_kwh";

function inr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// Server-side gate, matching Monitoring/Performance — a Basic or Pro
// customer without the Advance-tier "analytics" feature gets redirected,
// not just hidden from the nav.
export default async function AnalyticsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: customer } = profile
    ? await supabase
        .from("customers")
        .select("tariff_rate_per_kwh, plan:plans(features)")
        .eq("id", profile.id)
        .maybeSingle()
    : { data: null };

  const features = (customer?.plan?.features as Record<string, boolean>) ?? {};
  if (!features.analytics) {
    redirect("/dashboard");
  }
  const tariffRate = Number(customer?.tariff_rate_per_kwh ?? 8);

  const { data: sites } = await supabase.from("sites").select("id, name").order("created_at", { ascending: true });
  const { data: devices } = await supabase.from("devices").select("id, site_id");
  const deviceIds = (devices ?? []).map((d) => d.id);
  const siteIdByDevice = new Map((devices ?? []).map((d) => [d.id, d.site_id]));

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  let readings: { device_id: string; value: number | null; ts: string }[] = [];
  if (deviceIds.length > 0) {
    const { data } = await supabase
      .from("device_readings")
      .select("device_id, value, ts")
      .in("device_id", deviceIds)
      .eq("instrument_key", YIELD_INSTRUMENT_KEY)
      .eq("is_test", false)
      .gte("ts", since.toISOString())
      .order("ts", { ascending: true });
    readings = data ?? [];
  }

  const { data: payments } = await supabase.from("payments").select("amount, status").eq("status", "paid");
  const totalInvested = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  // Same running-total-per-day semantics as Performance: the max value seen
  // per device per calendar day is that day's total, summed across devices.
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

  // Cross-site comparison — last 30 days generation per site. Only worth
  // showing once there's more than one site to compare.
  const comparisonSince = new Date();
  comparisonSince.setUTCDate(comparisonSince.getUTCDate() - COMPARISON_WINDOW_DAYS);
  const siteTotals = new Map<string, number>();
  for (const [key, value] of perDeviceDay) {
    const [deviceId, day] = key.split(":");
    if (day < comparisonSince.toISOString().slice(0, 10)) continue;
    const siteId = siteIdByDevice.get(deviceId);
    if (!siteId) continue;
    siteTotals.set(siteId, (siteTotals.get(siteId) ?? 0) + value);
  }
  const sitePoints: SitePoint[] = (sites ?? []).map((s) => ({
    siteId: s.id,
    label: s.name,
    value: siteTotals.get(s.id) ?? 0,
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Analytics</h1>
        <p className="mt-1 text-sm text-theme-muted">
          Cost savings and return on investment, estimated at ₹{tariffRate.toFixed(2)}/kWh.
        </p>
      </div>

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

      {sitePoints.length > 1 && (
        <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
          <h2 className="text-sm font-semibold text-theme-primary">Site comparison</h2>
          <p className="mb-3 text-xs text-theme-muted">Energy yield by site, last {COMPARISON_WINDOW_DAYS} days.</p>
          <SiteComparisonChart sites={sitePoints} unit="kWh" />
        </div>
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
