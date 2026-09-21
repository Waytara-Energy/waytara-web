import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, resolveDeviceInSite, deviceDisplayId } from "@/lib/selected-site";
import { DevicePicker } from "@/components/dashboard/device-picker";
import { DeviceDetailsCard } from "@/components/dashboard/device-details-card";
import { AnalyticsContent } from "@/components/dashboard/analytics-content";
import { getCustomerPlan } from "@/lib/customer-plan";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// Server-side gate, matching Monitoring/Performance — a Basic or Pro
// customer without the Advance-tier "analytics" feature gets redirected,
// not just hidden from the nav.
//
// Phase 4 of the multi-device-type dashboard roadmap: the body is now
// category-aware via AnalyticsContent — solar_inverter keeps the
// savings/ROI chart, month-over-month/year-over-year PV comparison, grid
// import/export cost estimation, and battery cycle count; ev_charger gets
// cost-per-session and total charging spend over the period, computed from
// Phase 0's charging_sessions table (energy actually delivered per visit)
// rather than the solar side's tariff-per-kWh-generated framing, which
// doesn't map onto what a customer pays for a charge.
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const supabase = await createClient();
  // Cost figures for the *selected* device, not summed across every device
  // at the site — a site can have more than one device now, so which one
  // is picked via this page's own `?device=` (DevicePicker below),
  // independently of Monitoring/Performance/etc. Independent of the plan
  // check below, so it runs alongside it. getCustomerPlan() is
  // cache()-deduped against the layout's own call and carries the tariff
  // rate too, so this replaces what used to be a separate `customers`
  // query here.
  const [customerPlan, { device: deviceIdParam }, site] = await Promise.all([
    getCustomerPlan(),
    searchParams,
    getSelectedSite(),
  ]);
  const device = resolveDeviceInSite(site, deviceIdParam);

  const features = customerPlan?.features ?? {};
  if (!features.analytics) {
    redirect("/dashboard");
  }
  const tariffRate = customerPlan?.tariffRatePerKwh ?? 8;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Analytics</h1>
        <p className="mt-1 text-sm text-theme-muted">
          {device ? `${deviceDisplayId(device)}'s cost analytics` : "Cost analytics"}, estimated at ₹{tariffRate.toFixed(2)}/kWh.
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
          {/* Savings/ROI, trend, and grid-cost figures are all derived
              server-side from device_readings — not safe to hand-patch, so
              a new reading debounce-refreshes the whole page. */}
          <RealtimeRefresh table="device_readings" event="INSERT" filter={`device_id=eq.${device.id}`} />
          {site && <DevicePicker devices={site.devices} selectedId={device.id} />}
          <DeviceDetailsCard device={device} />
          <AnalyticsContent supabase={supabase} device={device} tariffRate={tariffRate} />
        </>
      )}
    </div>
  );
}
