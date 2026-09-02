import { AlertTriangle, Bell, Zap } from "lucide-react";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { getSelectedDevice } from "@/lib/selected-device";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { acknowledgeAlert } from "./actions";

// Device-centric redesign: Overview is now the selected device's overview,
// not an account-wide rollup — same RLS-scoped query shape as before, just
// filtered to one device_id instead of every device this customer owns.
export default async function DashboardOverviewPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const device = await getSelectedDevice();

  if (!device) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{profile?.email}</p>
        </div>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Zap />
            </EmptyMedia>
            <EmptyTitle>No devices yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  // Simplification: takes the most recent readings within a bounded window
  // rather than a true "latest value per instrument" query (needs a
  // DISTINCT ON not easily expressed through the query builder). Fine for
  // an overview snapshot.
  const { data: recentReadings } = await supabase
    .from("device_readings")
    .select("instrument_key, value, unit, ts")
    .eq("device_id", device.id)
    .order("ts", { ascending: false })
    .limit(50);

  const { data: recentAlerts } = await supabase
    .from("alerts")
    .select("id, severity, message, ts")
    .eq("device_id", device.id)
    .is("acknowledged_at", null)
    .order("ts", { ascending: false })
    .limit(5);

  const currentOutput = recentReadings?.find((r) => r.instrument_key === "ac_output_power_w");
  const todaysYield = recentReadings?.find((r) => r.instrument_key === "daily_yield_kwh");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {device.label || device.deviceUid}
          {device.deviceType?.name ? ` · ${device.deviceType.name}` : ""}
          {device.site ? ` · ${device.site.name}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Current Output"
          value={currentOutput ? `${currentOutput.value} ${currentOutput.unit ?? "W"}` : "No data yet"}
        />
        <StatCard
          label="Today's Energy"
          value={todaysYield ? `${todaysYield.value} ${todaysYield.unit ?? "kWh"}` : "No data yet"}
        />
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Device Status</p>
            <div className="mt-1.5">
              <Badge variant={device.status === "active" ? "default" : "secondary"} className="capitalize">
                {device.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <StatCard label="Recent Alerts" value={String(recentAlerts?.length ?? 0)} />
      </div>

      <Separator />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Recent Alerts</h2>
        {recentAlerts && recentAlerts.length > 0 ? (
          <div className="space-y-2">
            {recentAlerts.map((a) => (
              <Alert key={a.id} variant={a.severity === "critical" ? "destructive" : "default"}>
                <AlertTriangle />
                <AlertTitle className="flex items-center justify-between gap-3 capitalize">
                  {a.severity}
                  <span className="text-xs font-normal normal-case text-muted-foreground">
                    {new Date(a.ts).toLocaleDateString("en-IN")}
                  </span>
                </AlertTitle>
                <AlertDescription>
                  <p>{a.message}</p>
                  <form action={acknowledgeAlert.bind(null, a.id)}>
                    <Button type="submit" variant="outline" size="sm" className="mt-1">
                      Acknowledge
                    </Button>
                  </form>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Bell />
              </EmptyMedia>
              <EmptyTitle>No alerts</EmptyTitle>
              <EmptyDescription>
                This device is running clean — we&apos;ll show anything that needs your attention here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
