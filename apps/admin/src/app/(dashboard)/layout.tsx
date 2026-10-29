import { cookies } from "next/headers";
import { RealtimeProvider } from "@waytara/ui/realtime-provider";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { AdminSidebar } from "@/components/admin-sidebar";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SessionWatcher } from "@/components/session-watcher";
import { SidebarBrandToggle } from "@/components/sidebar-brand-toggle";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { loadAdminAlerts } from "@/lib/admin-alerts";

// Every route under this group is gated by proxy.ts (session +
// staff role, with the admin-only pages further restricted) —
// this layout can assume a valid staff profile by the time it renders.
//
// No header bar: the sidebar carries the logo, search, the notification bell and the account, and the page starts at the top. The sidebar is open
// the first time and then stays as the person left it (a cookie the sidebar writes). What needs attention (new leads, tickets with unread
// messages, device alerts) is read here, so it is fresh on every navigation, and refreshed live when those tables change.
export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [profile, cookieStore, supabase] = await Promise.all([getCurrentProfile(), cookies(), createClient()]);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const alerts = await loadAdminAlerts(supabase, profile?.role);
  const total = alerts.counts.leads + alerts.counts.support + alerts.counts.alerts;

  return (
    <RealtimeProvider>
      <SessionWatcher />
      <RealtimeRefresh table="leads" event="INSERT" />
      <RealtimeRefresh table="support_tickets" event="INSERT" />
      <RealtimeRefresh table="support_tickets" event="UPDATE" />
      <RealtimeRefresh table="alerts" event="INSERT" />
      <RealtimeRefresh table="alerts" event="UPDATE" />
      <SidebarProvider defaultOpen={defaultOpen}>
        <AdminSidebar
          role={profile?.role}
          alerts={alerts}
          account={{ fullName: profile?.full_name ?? null, email: profile?.email ?? null, avatarUrl: profile?.avatar_url ?? null, role: profile?.role ?? null }}
        />
        <SidebarBrandToggle alerts={total} />
        <SidebarInset className="min-w-0">
          <main className="flex-1 px-4 pb-10 pt-14 sm:px-6 md:pt-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </RealtimeProvider>
  );
}
