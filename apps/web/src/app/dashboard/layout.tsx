import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Button } from "@/components/ui/button";
import { logout } from "./actions";

// Reachable only as a `customer` profile — middleware.ts enforces that.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: customer } = profile
    ? await supabase
        .from("customers")
        .select("plan_id, plan:plans(name, features)")
        .eq("id", profile.id)
        .maybeSingle()
    : { data: null };

  // Onboarding pipeline redesign, Phase 6: proxy.ts already redirects any
  // not-yet-onboarded customer to /dashboard/onboarding-status for every
  // other /dashboard/* route, so by the time this renders, `children` is
  // guaranteed to be that page alone — this only decides whether the real
  // dashboard's sidebar nav shows around it. Same "missing row = onboarded"
  // default as proxy.ts, for the same reason.
  const { data: onboarding } = profile
    ? await supabase
        .from("customer_onboarding")
        .select("current_stage")
        .eq("customer_id", profile.id)
        .maybeSingle()
    : { data: null };

  const isOnboarded = !onboarding || onboarding.current_stage === "install_completed";

  if (!isOnboarded) {
    return (
      <div className="flex min-h-screen flex-col bg-theme-bg text-theme-primary">
        <header className="flex h-16 items-center justify-between border-b border-theme-border px-6">
          <span className="text-sm font-semibold text-theme-primary">WayTara Energy</span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-theme-bg text-theme-primary">
      <DashboardNav
        planName={customer?.plan?.name}
        features={(customer?.plan?.features as Record<string, boolean>) ?? {}}
      />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-theme-border px-6">
          <span className="text-sm text-theme-muted">
            {profile?.full_name ?? profile?.email}
          </span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
