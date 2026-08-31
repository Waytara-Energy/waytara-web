import { getCurrentProfile } from "@waytara/supabase/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfile } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const profile = await getCurrentProfile();

  const prefs = (profile?.notification_preferences as {
    email_alerts?: boolean;
    email_maintenance_updates?: boolean;
  } | null) ?? {};

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Application Settings</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-theme-border bg-theme-alert-subtle px-4 py-3 text-sm text-theme-alert">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-theme-border bg-theme-highlight-subtle px-4 py-3 text-sm text-theme-highlight">
          Saved.
        </div>
      )}

      <form action={updateProfile} className="space-y-4 rounded-xl border border-theme-border bg-theme-surface p-5">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" defaultValue={profile?.full_name ?? ""} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <p className="text-sm text-theme-muted">{profile?.email} (contact support to change)</p>
        </div>

        <div className="space-y-2 border-t border-theme-border pt-4">
          <p className="text-sm font-medium text-theme-primary">Notification preferences</p>
          <label className="flex items-center gap-2 text-sm text-theme-secondary">
            <input
              type="checkbox"
              name="emailAlerts"
              defaultChecked={prefs.email_alerts ?? true}
              className="h-4 w-4"
            />
            Email me about device alerts
          </label>
          <label className="flex items-center gap-2 text-sm text-theme-secondary">
            <input
              type="checkbox"
              name="emailMaintenanceUpdates"
              defaultChecked={prefs.email_maintenance_updates ?? true}
              className="h-4 w-4"
            />
            Email me about maintenance request updates
          </label>
        </div>

        <Button type="submit" size="sm">
          Save Changes
        </Button>
      </form>
    </div>
  );
}
