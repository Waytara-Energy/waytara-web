import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, resolveDeviceInSite, deviceDisplayId } from "@/lib/selected-site";
import { DevicePicker } from "@/components/dashboard/device-picker";
import { DeviceDetailsCard } from "@/components/dashboard/device-details-card";
import { PerformanceContent } from "@/components/dashboard/performance-content";
import { getCustomerPlan } from "@/lib/customer-plan";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// Server-side gate, matching Monitoring (Task 10.1) — a Basic-tier customer
// hitting this URL directly gets redirected, not just hidden from the nav.
//
// Phase 3 of the multi-device-type dashboard roadmap: the body is now
// category-aware via PerformanceContent — solar_inverter keeps the daily
// yield chart, battery charge-vs-discharge and grid import-vs-export
// diverging comparisons, self-consumption %, and period/lifetime totals;
// ev_charger gets a cumulative energy trend chart plus a real charging
// session history (date/duration/energy per session, from the
// charging_sessions table — the direct WayTara equivalent of ChargePoint/
// Wallbox's charging history) instead of the inverter's fixed key list.
export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const supabase = await createClient();
  // Independent of the plan check below, so it runs alongside it.
  // getCustomerPlan() is cache()-deduped against the layout's own call, so
  // this costs nothing extra. Which device at the site is picked via this
  // page's own `?device=` (DevicePicker below) — a site can have more than
  // one now.
  const [customerPlan, { device: deviceIdParam }, site] = await Promise.all([
    getCustomerPlan(),
    searchParams,
    getSelectedSite(),
  ]);
  const device = resolveDeviceInSite(site, deviceIdParam);

  const features = customerPlan?.features ?? {};
  if (!features.performance) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Performance</h1>
        <p className="mt-1 text-sm text-theme-muted">
          {device ? `Performance history for ${deviceDisplayId(device)}.` : "Household performance history over time."}
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
          {/* Every chart/tile below is aggregated server-side (daily
              buckets, latest-per-key totals) from device_readings — not
              safe to hand-patch, so a new reading debounce-refreshes the
              whole page. */}
          <RealtimeRefresh table="device_readings" event="INSERT" filter={`device_id=eq.${device.id}`} />
          {site && <DevicePicker devices={site.devices} selectedId={device.id} />}
          <DeviceDetailsCard device={device} />
          <PerformanceContent supabase={supabase} device={device} />
        </>
      )}
    </div>
  );
}
