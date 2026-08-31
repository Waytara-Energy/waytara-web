import { redirect } from "next/navigation";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { aggregateDailyYield } from "@/lib/energy-aggregation";

const HISTORY_DAYS = 180;
const YIELD_INSTRUMENT_KEY = "daily_yield_kwh";

// Server-side gate, matching Monitoring (Task 10.1) — a Basic-tier customer
// hitting this URL directly gets redirected, not just hidden from the nav.
export default async function PerformancePage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: customer } = profile
    ? await supabase.from("customers").select("plan:plans(features)").eq("id", profile.id).maybeSingle()
    : { data: null };

  const features = (customer?.plan?.features as Record<string, boolean>) ?? {};
  if (!features.performance) {
    redirect("/dashboard");
  }

  const { data: devices } = await supabase.from("devices").select("id");
  const deviceIds = (devices ?? []).map((d) => d.id);

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

  const daily = aggregateDailyYield(readings);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Performance</h1>
        <p className="mt-1 text-sm text-theme-muted">
          Household energy yield over time, across every solar device on your account.
        </p>
      </div>

      <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
        <PerformanceChart daily={daily} unit="kWh" />
      </div>
    </div>
  );
}
