import { cookies } from "next/headers";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SessionWatcher } from "@/components/dashboard/session-watcher";
import { SubmitButton } from "@/components/ui/submit-button";
import { getCustomerDevices, resolveSelectedDevice, SELECTED_DEVICE_COOKIE } from "@/lib/selected-device";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getRequestProfile, isRequestOnboarded } from "@/lib/request-profile";
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
  // profile and devices don't depend on each other at all.
  const [profile, devices] = await Promise.all([getRequestProfile(), getCustomerDevices()]);

  // Onboarding pipeline redesign, Phase 6: proxy.ts already redirects any
  // not-yet-onboarded customer to /dashboard/onboarding-status for every
  // other /dashboard/* route, so by the time this renders, `children` is
  // guaranteed to be that page alone — this only decides whether the real
  // dashboard's sidebar nav shows around it. Neither this nor the plan
  // lookup below depends on the other, so they run together too.
  const [customerPlan, isOnboarded] = await Promise.all([getCustomerPlan(), isRequestOnboarded()]);

  if (!isOnboarded) {
    return (
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
    );
  }

  const features = customerPlan?.features ?? {};

  // Dashboard redesign Phase 1: SidebarProvider's own state defaults to
  // open every load unless told otherwise — reading its cookie here (the
  // exact cookie it writes on toggle, see sidebar.tsx's SIDEBAR_COOKIE_NAME)
  // is what makes a collapsed sidebar stay collapsed across a reload
  // instead of springing back open.
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Device is the dashboard's navigation root now — every device-scoped
  // page resolves its own selection via getSelectedDevice() (same cookie,
  // re-fetched independently), matching this app's existing convention of
  // each page fetching its own gate/data rather than threading it down
  // from the layout. `devices` was already fetched above (in parallel
  // with `profile`) purely for the header switcher's list.
  const selectedDevice = resolveSelectedDevice(devices, cookieStore.get(SELECTED_DEVICE_COOKIE)?.value);

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <SessionWatcher />
      <DashboardSidebar features={features} />
      <SidebarInset>
        <DashboardHeader
          fullName={profile?.full_name ?? null}
          email={profile?.email ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          planName={customerPlan?.planName ?? null}
          features={features}
          devices={devices.map((d) => ({ id: d.id, label: d.label, deviceUid: d.deviceUid, siteName: d.site?.name ?? null }))}
          selectedDeviceId={selectedDevice?.id ?? null}
        />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
