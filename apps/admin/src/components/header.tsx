import type { Profile } from "@waytara/supabase";

// Placeholder until real auth is wired up: `getCurrentProfile()` from
// `@waytara/supabase/auth` will replace this null once there's a login
// flow and `apps/admin/.env.local` has real Supabase values.
const currentProfile: Profile | null = null;

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div />
      <div className="text-sm text-muted-foreground">
        {currentProfile
          ? `Signed in as ${currentProfile.full_name ?? currentProfile.email} (${currentProfile.role})`
          : "Not signed in — auth not wired up yet"}
      </div>
    </header>
  );
}
