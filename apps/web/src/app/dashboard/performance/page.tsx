import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, resolveDeviceInSite, deviceDisplayId } from "@/lib/selected-site";
import { DeviceSwitcher } from "@/components/dashboard/device-switcher";
import { PerformanceContent } from "@/components/dashboard/performance-content";
import { AnalyticsContent } from "@/components/dashboard/analytics-content";
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
// ev_sessions table — the direct WayTara equivalent of ChargePoint/
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
  const device = await resolveDeviceInSite(site, deviceIdParam);

  const features = customerPlan?.features ?? {};
  if (!features.performance) {
    redirect("/dashboard");
  }
  // Analytics merged into this page (was its own sidebar item/route) — its
  // own feature gate stays a real tier check, just an inline section
  // instead of a redirect: a Performance-only customer still gets this
  // whole page, just without the cost/ROI section below.
  const tariffRate = customerPlan?.tariffRatePerKwh ?? 8;

  return (
    <div className="space-y-6">
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
              buckets, latest-per-key totals) from equipment_telemetry — not
              safe to hand-patch, so a new reading debounce-refreshes the
              whole page. */}
          <RealtimeRefresh table="equipment_telemetry" event="INSERT" filter={`equipment_id=eq.${device.id}`} throttleMs={15000} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DeviceSwitcher devices={site?.devices ?? [device]} selectedId={device.id} />
              <p className="mt-1 text-sm text-theme-muted">Performance history, updated as new readings arrive.</p>
            </div>
          </div>
          <PerformanceContent supabase={supabase} device={device} />
          {features.analytics && (
            <>
              <div className="pt-2">
                <h2 className="text-lg font-semibold text-theme-primary">Cost &amp; Savings Analytics</h2>
                <p className="mt-1 text-sm text-theme-muted">
                  {deviceDisplayId(device)}&apos;s cost analytics, estimated at ₹{tariffRate.toFixed(2)}/kWh.
                </p>
              </div>
              <AnalyticsContent supabase={supabase} device={device} tariffRate={tariffRate} />
            </>
          )}
        </>
      )}
    </div>
  );
}
