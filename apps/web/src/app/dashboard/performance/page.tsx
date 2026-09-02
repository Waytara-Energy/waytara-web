import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { getSelectedDevice } from "@/lib/selected-device";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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

  // Device-centric redesign: yield for the *selected* device only, not
  // summed across every device the customer owns.
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

  const daily = aggregateDailyYield(readings);

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
        <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
          <PerformanceChart daily={daily} unit="kWh" />
        </div>
      )}
    </div>
  );
}
