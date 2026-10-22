import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { SessionWatcher } from "@/components/session-watcher";
import { RealtimeProvider } from "@waytara/ui/realtime-provider";
import { getCurrentProfile } from "@waytara/supabase/auth";

// Every route under this group is gated by middleware.ts (session +
// admin/employee role, with /employees further restricted to admin only) —
// this layout can assume a valid staff profile by the time it renders.
export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getCurrentProfile();
  return (
    <RealtimeProvider>
      <div className="flex">
        <SessionWatcher />
        <Sidebar role={profile?.role} />
        <div className="flex min-h-screen flex-1 flex-col">
          <Header />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </RealtimeProvider>
  );
}
