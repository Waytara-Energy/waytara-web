import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { AppearanceSetting } from "@/components/dashboard/appearance-setting";
import { ChartStyleSetting } from "@/components/dashboard/chart-style-setting";
import { DevicesSetting, type SignedInDevice } from "@/components/dashboard/devices-setting";

/** The server clock for "last active 5 min ago" (a function, so a render never reads the time itself). */
const serverNow = () => Date.now();

export default async function SettingsPage() {
  const supabase = await createClient();
  const [profile, { data: sessionRows }] = await Promise.all([getCurrentProfile(supabase), supabase.rpc("my_sessions")]);
  const devices: SignedInDevice[] = (sessionRows ?? []).map((s) => ({ id: s.id, lastActive: s.last_active, createdAt: s.created_at, userAgent: s.user_agent, ip: s.ip, isCurrent: s.is_current }));

  const prefs = (profile?.notification_preferences as {
    email_alerts?: boolean;
    email_maintenance_updates?: boolean;
  } | null) ?? {};

  return (
    <div className="max-w-2xl space-y-6">
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

      <DevicesSetting devices={devices} now={serverNow()} />
    </div>
  );
}
