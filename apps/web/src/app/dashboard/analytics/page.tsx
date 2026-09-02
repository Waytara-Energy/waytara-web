import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { getSelectedDevice } from "@/lib/selected-device";
import { PerformanceChart, type DailyPoint } from "@/components/dashboard/performance-chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { maxByDeviceDay, sumByDay } from "@/lib/energy-aggregation";

const HISTORY_DAYS = 365;
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

  // Device-centric redesign: cost savings/ROI for the *selected* device's
  // own yield, not summed across every device — the cross-site comparison
  // chart this page used to carry is gone along with that, since a
  // single-device view has nothing left to compare against.
  const device = await getSelectedDevice();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  let readings: { device_id: string; value: number | null; ts: string }[] = [];
  if (device) {
    const { data } = await supabase
      .from("device_readings")
      .select("device_id, value, ts")
      .eq("device_id", device.id)
      .eq("instrument_key", YIELD_INSTRUMENT_KEY)
      .eq("is_test", false)
      .gte("ts", since.toISOString())
      .order("ts", { ascending: true });
    readings = data ?? [];
  }

  // totalInvested stays account-wide (payments aren't tied to a device),
  // even though the yield/savings chart below is device-scoped — the two
  // figures answer different questions (what you spent on the system vs.
  // what this one device has generated).
  const { data: payments } = await supabase.from("payments").select("amount, status").eq("status", "paid");
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
