import { redirect } from "next/navigation";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { MonitoringPanel } from "@waytara/ui/monitoring-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Server-side gate, not just a hidden nav link — a Basic-tier customer
// hitting this URL directly gets redirected, matching the RLS-not-UI
// enforcement pattern used everywhere else in this codebase.
export default async function MonitoringPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: customer } = profile
    ? await supabase.from("customers").select("plan:plans(features)").eq("id", profile.id).maybeSingle()
    : { data: null };

  const features = (customer?.plan?.features as Record<string, boolean>) ?? {};
  if (!features.monitoring) {
    redirect("/dashboard");
  }

  const { data: devices } = await supabase
    .from("devices")
    .select("id, device_uid, label, device_type:device_types(name)")
    .order("created_at", { ascending: false });

  const panelDevices = (devices ?? []).map((d) => ({
    id: d.id,
    deviceUid: d.device_uid,
    label: d.label,
    typeName: d.device_type?.name ?? null,
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Monitoring</h1>
        <p className="mt-1 text-sm text-theme-muted">Live per-device readings, refreshed every few seconds.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
          <CardDescription>Hover an instrument label for its last-updated time.</CardDescription>
        </CardHeader>
        <CardContent>
          <MonitoringPanel devices={panelDevices} emptyMessage="No readings for this device yet." />
        </CardContent>
      </Card>
    </div>
  );
}
