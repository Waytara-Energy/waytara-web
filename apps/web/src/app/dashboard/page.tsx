import { AlertTriangle, Bell, Zap } from "lucide-react";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { getSelectedDevice } from "@/lib/selected-device";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DeviceStatusPill } from "@/components/dashboard/device-status-pill";
import { FaultBanner } from "@/components/dashboard/fault-banner";
import { EnergyFlowDiagram } from "@/components/dashboard/energy-flow-diagram";
import { TODAY_ENERGY_FIELDS, formatValue } from "@/lib/telemetry-catalog";
import { acknowledgeAlert } from "./actions";

// Instruments this page actually needs — filtered explicitly rather than
// "most recent N readings across every instrument" (the old approach),
// since the catalog now has 29 instruments and a flat top-50 window could
// miss one that just hasn't reported as often as the others.
const OVERVIEW_KEYS = [
  "ac_output_power_w",
  "battery_power_w",
  "grid_power_w",
  "load_power_w",
  "battery_soc_pct",
  "inverter_state",
  "active_fault_code",
  ...TODAY_ENERGY_FIELDS.map((f) => f.key),
];

// Device-centric redesign: Overview is now the selected device's overview,
// not an account-wide rollup — same RLS-scoped query shape as before, just
// filtered to one device_id instead of every device this customer owns.
//
// Telemetry-driven redesign (Phase 8): the flat stat-card grid is replaced
// with the classic energy-flow diagram from the inverter's own LCD (solar /
// battery / grid / load, arrows showing direction), a status pill, a
// prominent fault banner when the device is actually reporting a fault, and
// a "today so far" totals row from the daily-reset energy counters.
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
  // (per the fixed key list above, not every instrument) rather than a
  // true "latest value per instrument" query (needs a DISTINCT ON not
  // easily expressed through the query builder). Fine for an overview
  // snapshot.
  const { data: recentReadings } = await supabase
    .from("device_readings")
    .select("instrument_key, value, unit, ts")
    .eq("device_id", device.id)
    .in("instrument_key", OVERVIEW_KEYS)
    .order("ts", { ascending: false })
    .limit(OVERVIEW_KEYS.length * 5);

  const { data: recentAlerts } = await supabase
    .from("alerts")
    .select("id, severity, message, ts")
    .eq("device_id", device.id)
    .is("acknowledged_at", null)
    .order("ts", { ascending: false })
    .limit(5);

  const latest = new Map<string, number | null>();
  for (const r of recentReadings ?? []) {
    if (!latest.has(r.instrument_key)) latest.set(r.instrument_key, r.value);
  }
  const get = (key: string) => latest.get(key) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <DeviceStatusPill inverterState={get("inverter_state")} activeFaultCode={get("active_fault_code")} />
      </div>

      <FaultBanner faultCode={get("active_fault_code")} />

      <Card>
        <CardContent className="p-6">
          <EnergyFlowDiagram
            solarW={get("ac_output_power_w")}
            batteryW={get("battery_power_w")}
            gridW={get("grid_power_w")}
            loadW={get("load_power_w")}
            batterySocPct={get("battery_soc_pct")}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Today so far</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {TODAY_ENERGY_FIELDS.map((field) => (
            <StatCard key={field.key} label={field.label} value={formatValue(get(field.key), field)} />
          ))}
        </div>
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
