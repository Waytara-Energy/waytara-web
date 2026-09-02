import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { MonitoringPanel } from "@waytara/ui/monitoring-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getSelectedDevice } from "@/lib/selected-device";

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

  // Device-centric redesign: this panel is now the *selected* device only —
  // MonitoringPanel itself is untouched (still takes an array of devices,
  // shared with apps/admin's connection-test panel), just handed a
  // single-item array instead of every device the customer owns.
  const device = await getSelectedDevice();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Monitoring</h1>
        <p className="mt-1 text-sm text-theme-muted">
          {device
            ? `Live readings for ${device.label || device.deviceUid}, refreshed every few seconds.`
            : "Live per-device readings, refreshed every few seconds."}
        </p>
      </div>

      {!device ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Activity />
            </EmptyMedia>
            <EmptyTitle>No devices yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{device.deviceType?.name ?? "Device"}</CardTitle>
            <CardDescription>Hover an instrument label for its last-updated time.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonitoringPanel
              devices={[
                {
                  id: device.id,
                  deviceUid: device.deviceUid,
                  label: device.label,
                  typeName: device.deviceType?.name ?? null,
                },
              ]}
              emptyMessage="No readings for this device yet."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
