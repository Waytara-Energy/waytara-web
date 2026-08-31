import { getCurrentProfile } from "@waytara/supabase/auth";
import { Button } from "@/components/ui/button";
import { logout } from "./actions";

// Reachable only as a `customer` profile — middleware.ts enforces that.
export default async function DashboardPage() {
  const profile = await getCurrentProfile();

  return (
    <div className="fluid-container section-padding">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-theme-muted">{profile?.email}</p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>

      <div className="mt-8 rounded-xl border border-theme-border bg-theme-surface p-6 text-sm text-theme-muted">
        Customer dashboard — auth is wired up, real content isn&apos;t built
        yet.
      </div>
    </div>
  );
}
