import { CheckCircle2, TriangleAlert } from "lucide-react";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SettingsForm } from "@/components/dashboard/settings-form";

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
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Saved</AlertTitle>
        </Alert>
      )}

      <SettingsForm
        fullName={profile?.full_name ?? ""}
        phone={profile?.phone ?? ""}
        email={profile?.email ?? ""}
        emailAlerts={prefs.email_alerts ?? true}
        emailMaintenanceUpdates={prefs.email_maintenance_updates ?? true}
      />
    </div>
  );
}
