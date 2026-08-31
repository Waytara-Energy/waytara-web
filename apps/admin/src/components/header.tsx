import { getCurrentProfile } from "@waytara/supabase/auth";
import { Button } from "@waytara/ui/button";
import { logout } from "@/app/(dashboard)/actions";

// Reachable only for admin/employee profiles — middleware.ts enforces that,
// so this can assume a profile exists.
export async function Header() {
  const profile = await getCurrentProfile();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {profile ? `${profile.full_name ?? profile.email} · ${profile.role}` : "—"}
        </span>
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
