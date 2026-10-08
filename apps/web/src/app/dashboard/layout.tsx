import { cookies } from "next/headers";
import { createClient } from "@waytara/supabase/server";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { HeaderSlotProvider } from "@/components/dashboard/header-slot";
import { ChartStyleProvider } from "@/components/dashboard/chart-style";
import { CHART_STYLE_COOKIE, parseChartStyle } from "@/lib/chart-style";
import { SidebarBrandToggle } from "@/components/dashboard/sidebar-brand-toggle";
import { SessionWatcher } from "@/components/dashboard/session-watcher";
import { RealtimeProvider } from "@waytara/ui/realtime-provider";
import { TelemetryProvider } from "@/lib/telemetry/react";
import { SubmitButton } from "@/components/ui/submit-button";
import { deviceDisplayId, getCustomerSites, resolveSelectedSite, SELECTED_DEVICE_COOKIE, SELECTED_SITE_COOKIE } from "@/lib/selected-site";
import { getLastSyncInfo } from "@/lib/device-sync";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getRequestProfile, isRequestOnboarded } from "@/lib/request-profile";
import { fetchActiveFaultCodes, fetchCustomerAlerts } from "@/lib/device-overview";
import { logout } from "./actions";
import { NO_INDEX } from "@/lib/seo";

// Reachable only as a `customer` profile — middleware.ts enforces that.
//
// This layout wraps every /dashboard/* page and reads cookies() (sidebar
// state, selected device), which makes the whole segment dynamic — Next
// re-executes it on the server for every navigation, not just the first
// load. That means whatever this function awaits is a tax paid on every
// single sidebar click, uniformly, regardless of which page is being
// navigated to. It used to be 4 fully sequential round trips (profile,
// customer+plan, onboarding stage, devices); the customer+plan one is now
// getCustomerPlan() (cache()-deduped against every page's own feature-gate
// check, see @/lib/customer-plan), the profile/onboarding ones read
// proxy.ts's already-fetched headers instead of re-querying (see
// @/lib/request-profile — this was the biggest remaining cost, since it's
// a real network round trip to Supabase's Auth server), and the rest run
// in two parallel batches instead of four sequential ones.
// The customer dashboard is private; never index it.
export const metadata = NO_INDEX;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // profile and sites don't depend on each other at all.
  const [profile, sites] = await Promise.all([getRequestProfile(), getCustomerSites()]);

  // Onboarding pipeline redesign, Phase 6: proxy.ts already redirects any
  // not-yet-onboarded customer to /dashboard/onboarding-status for every
  // other /dashboard/* route, so by the time this renders, `children` is
  // guaranteed to be that page alone — this only decides whether the real
  // dashboard's sidebar nav shows around it. Neither this nor the plan
  // lookup below depends on the other, so they run together too.
  const [customerPlan, isOnboarded] = await Promise.all([getCustomerPlan(), isRequestOnboarded()]);

  if (!isOnboarded) {
    return (
      <RealtimeProvider>
        <div className="flex min-h-screen flex-col bg-theme-bg text-theme-primary">
          <SessionWatcher />
          <header className="flex h-16 items-center justify-between border-b border-theme-border px-6">
            <span className="text-sm font-semibold text-theme-primary">WayTara Energy</span>
            <form action={logout}>
              <SubmitButton variant="outline" size="sm" pendingText="Signing out…">
                Sign out
              </SubmitButton>
            </form>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </RealtimeProvider>
    );
  }

  const features = customerPlan?.features ?? {};

  // Every device across every site the customer has — the header's
  // notification bell isn't scoped to whichever site happens to be
  // selected (it's mounted once here, outside any single site's page), so
  // it needs the full set, not just the selected site's own devices.
  const allDeviceIds = sites.flatMap((s) => s.devices.map((d) => d.id));

  // Dashboard redesign Phase 1: SidebarProvider's own state defaults to
  // open every load unless told otherwise — reading its cookie here (the
  // exact cookie it writes on toggle, see sidebar.tsx's SIDEBAR_COOKIE_NAME)
  // is what makes a collapsed sidebar stay collapsed across a reload
  // instead of springing back open. Runs alongside the alerts fetch below
  // since neither depends on the other.
  const [cookieStore, initialAlerts, initialFaults] = await Promise.all([
    cookies(),
    createClient().then((supabase) => fetchCustomerAlerts(supabase, allDeviceIds)),
    createClient().then((supabase) => fetchActiveFaultCodes(supabase, allDeviceIds)),
  ]);
  const sidebarOpen = cookieStore.get("sidebar_state")?.value === "true";

  // Site is the dashboard's navigation root now — every site-scoped page
  // resolves its own selection via getSelectedSite() (same cookie,
  // re-fetched independently), matching this app's existing convention of
  // each page fetching its own gate/data rather than threading it down
  // from the layout. `sites` was already fetched above (in parallel with
  // `profile`) purely for the header switcher's list.
  const selectedSite = resolveSelectedSite(sites, cookieStore.get(SELECTED_SITE_COOKIE)?.value);

  // The sidebar lists the selected site's devices, each with a status dot: what the server knows of every device's connection
  // (the dots then follow the live channel themselves).
  const sidebarDevices = await Promise.all(
    (selectedSite?.devices ?? []).map(async (d) => {
      const { lastTs, agentSeenTs, deviceOnline, intervalS, heartbeatS } = await getLastSyncInfo(d.id);
      return { id: d.id, name: deviceDisplayId(d), category: d.deviceType?.category ?? null, sync: { lastTs, agentSeenTs, deviceOnline, intervalS, heartbeatS } };
    })
  );
  // The header's status icons: the inverters and EV chargers of the selected site.
  const statusDevices = sidebarDevices.flatMap((d) =>
    d.category === "solar_inverter" || d.category === "ev_charger" ? [{ id: d.id, name: d.name, kind: d.category === "ev_charger" ? ("ev" as const) : ("inverter" as const), sync: d.sync }] : []
  );

  return (
    <RealtimeProvider>
      <TelemetryProvider userId={profile?.id ?? "unknown"}>
      <SidebarProvider defaultOpen={sidebarOpen}>
      <ChartStyleProvider initial={parseChartStyle(cookieStore.get(CHART_STYLE_COOKIE)?.value)}>
      <HeaderSlotProvider>
        <SessionWatcher />
        <SidebarBrandToggle floating />
        <DashboardSidebar
          features={features}
          devices={sidebarDevices}
          account={{ fullName: profile?.full_name ?? null, email: profile?.email ?? null, avatarUrl: profile?.avatar_url ?? null, planName: customerPlan?.planName ?? null }}
        />
        {/* h-svh + overflow-clip caps this to the viewport instead of
            growing with page content (SidebarProvider's own wrapper is
            only min-h-svh) — that's what turns the <main> below into an
            independent scroll region instead of the whole document
            scrolling, so the header stays fixed in place above it.
            overflow-clip, not overflow-hidden: `hidden` only blocks
            user-driven wheel/drag scroll — it still lets the browser's own
            focus-into-view behavior set a nonzero scrollTop on this
            element (e.g. a Radix tab trigger or a submit button
            auto-focusing after a Server Action's redirect), which quietly
            pushed the header itself off-screen above the viewport since it
            lives inside this same container. `clip` never becomes a
            scroll container at all, so no scrollTop can land on it by any
            path. */}
        <SidebarInset className="h-svh overflow-clip">
          <DashboardHeader
            sites={sites.map((s) => ({ id: s.id, name: s.name, deviceCount: s.devices.length }))}
            selectedSiteId={selectedSite?.id ?? null}
            alertDeviceIds={allDeviceIds}
            devices={sites.flatMap((s) => s.devices.map((d) => ({ id: d.id, name: deviceDisplayId(d) })))}
            statusDevices={statusDevices}
            selectedDeviceId={cookieStore.get(SELECTED_DEVICE_COOKIE)?.value ?? null}
            initialAlerts={initialAlerts}
            initialFaults={initialFaults}
          />
          {/* The header floats over this scroll region (transparent, fading what scrolls under it), so the content starts below it. */}
          <main className="flex-1 overflow-y-auto pt-[clamp(3.5rem,4.5vw,4.25rem)]">
            <div className="p-6 pt-3">{children}</div>
          </main>
        </SidebarInset>
      </HeaderSlotProvider>
      </ChartStyleProvider>
      </SidebarProvider>
      </TelemetryProvider>
    </RealtimeProvider>
  );
}
