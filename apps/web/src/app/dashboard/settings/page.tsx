import { getCurrentProfile } from "@waytara/supabase/auth";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { AppearanceSetting } from "@/components/dashboard/appearance-setting";
import { ChartStyleSetting } from "@/components/dashboard/chart-style-setting";

export default async function SettingsPage() {
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

      <SettingsForm
        fullName={profile?.full_name ?? ""}
        phone={profile?.phone ?? ""}
        email={profile?.email ?? ""}
        emailAlerts={prefs.email_alerts ?? true}
        emailMaintenanceUpdates={prefs.email_maintenance_updates ?? true}
      />

      <AppearanceSetting />

      <ChartStyleSetting />
    </div>
  );
}
