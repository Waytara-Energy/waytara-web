import { cookies } from "next/headers";
import { createClient } from "@waytara/supabase/server";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SessionWatcher } from "@/components/dashboard/session-watcher";
import { RealtimeProvider } from "@waytara/ui/realtime-provider";
import { SubmitButton } from "@/components/ui/submit-button";
import { getCustomerSites, resolveSelectedSite, SELECTED_SITE_COOKIE } from "@/lib/selected-site";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getRequestProfile, isRequestOnboarded } from "@/lib/request-profile";
import { fetchCustomerAlerts } from "@/lib/device-overview";
import { logout } from "./actions";

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
  const [cookieStore, initialAlerts] = await Promise.all([
    cookies(),
    createClient().then((supabase) => fetchCustomerAlerts(supabase, allDeviceIds)),
  ]);
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Site is the dashboard's navigation root now — every site-scoped page
  // resolves its own selection via getSelectedSite() (same cookie,
  // re-fetched independently), matching this app's existing convention of
  // each page fetching its own gate/data rather than threading it down
  // from the layout. `sites` was already fetched above (in parallel with
  // `profile`) purely for the header switcher's list.
  const selectedSite = resolveSelectedSite(sites, cookieStore.get(SELECTED_SITE_COOKIE)?.value);

  return (
    <RealtimeProvider>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <SessionWatcher />
        <DashboardSidebar features={features} />
        {/* h-svh + overflow-hidden caps this to the viewport instead of
            growing with page content (SidebarProvider's own wrapper is
            only min-h-svh) — that's what turns the <main> below into an
            independent scroll region instead of the whole document
            scrolling, so the header stays fixed in place above it. */}
        <SidebarInset className="h-svh overflow-hidden">
          <DashboardHeader
            fullName={profile?.full_name ?? null}
            email={profile?.email ?? null}
            avatarUrl={profile?.avatar_url ?? null}
            planName={customerPlan?.planName ?? null}
            features={features}
            sites={sites.map((s) => ({ id: s.id, name: s.name, deviceCount: s.devices.length }))}
            selectedSiteId={selectedSite?.id ?? null}
            alertDeviceIds={allDeviceIds}
            initialAlerts={initialAlerts}
          />
          <main className="flex-1 overflow-y-auto">
            {/* Fades scrolled content as it passes under the header edge —
                sticky to the top of this scroll region (not the header
                itself, which is a separate element now that content and
                header no longer share a scroll context), painted in the
                page's own background color so content visibly dissolves
                rather than a shadow/line sitting in the gap. The `-mb-6`
                cancels its own flow height so the padded content below
                isn't pushed down by it. */}
            <div className="pointer-events-none sticky top-0 z-10 -mb-6 h-6 bg-gradient-to-b from-background to-transparent" />
            <div className="p-6">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RealtimeProvider>
  );
}
