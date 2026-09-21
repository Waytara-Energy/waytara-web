import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { MonitoringContent } from "@/components/dashboard/monitoring-content";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getSelectedSite, resolveDeviceInSite } from "@/lib/selected-site";

// Server-side gate, matching Overview/Performance/Analytics — a Basic-tier
// customer hitting this URL directly gets redirected, matching the
// RLS-not-UI enforcement pattern used everywhere else in this codebase.
//
// Phase 2 of the multi-device-type dashboard roadmap: the body (live
// charts + snapshot detail) is now category-aware via MonitoringContent —
// solar_inverter keeps the two live-polling charts (power flows + battery
// SOC), PV1-vs-PV2 comparison, temperature gauges, and grid-connected
// indicator this page has had since Phase 9; ev_charger gets its own live
// charging-power/current charts and detail list built from OCPP telemetry
// instead of the inverter's fixed key list (which it never reported, so
// this page used to come back essentially blank for it).
export default async function MonitoringPage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const supabase = await createClient();
  // getSelectedSite() doesn't depend on the plan check below, so it runs
  // alongside it instead of after. getCustomerPlan() is cache()-deduped
  // against the layout's own call (and every other page's), so this isn't
  // a second real query — same reasoning throughout this pass: independent
  // queries in one round trip, not a waterfall of them. Which device at
  // the site is picked via this page's own `?device=` (DeviceSwitcher,
  // rendered inside MonitoringContent) — a site can have more than one now.
  const [customerPlan, { device: deviceIdParam }, site] = await Promise.all([
    getCustomerPlan(),
    searchParams,
    getSelectedSite(),
  ]);
  const device = resolveDeviceInSite(site, deviceIdParam);

  const features = customerPlan?.features ?? {};
  if (!features.monitoring) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      {!device ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Activity />
            </EmptyMedia>
            <EmptyTitle>No devices yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* The live charts inside MonitoringContent already poll/subscribe
              on their own — this is for everything else on the page (detail
              cards, badges), all snapshot-rendered server-side and not safe
              to hand-patch from a raw insert payload. */}
          <RealtimeRefresh table="device_readings" event="INSERT" filter={`device_id=eq.${device.id}`} />
          <MonitoringContent supabase={supabase} device={device} devices={site?.devices ?? [device]} />
        </>
      )}
    </div>
  );
}
