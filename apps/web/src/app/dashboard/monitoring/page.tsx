import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { LiveMetricChart } from "@/components/dashboard/lazy-charts";
import { PvStringComparison } from "@/components/dashboard/pv-string-comparison";
import { TemperatureGauge } from "@/components/dashboard/temperature-gauge";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getSelectedDevice } from "@/lib/selected-device";
import { TEMPERATURE_FIELDS } from "@/lib/telemetry-catalog";

const SNAPSHOT_KEYS = [
  ...TEMPERATURE_FIELDS.map((f) => f.key),
  "pv1_voltage_v",
  "pv1_current_a",
  "pv1_power_w",
  "pv2_voltage_v",
  "pv2_current_a",
  "pv2_power_w",
  "grid_connected",
];

// Server-side gate, matching Overview/Performance/Analytics — a Basic-tier
// customer hitting this URL directly gets redirected, matching the
// RLS-not-UI enforcement pattern used everywhere else in this codebase.
//
// Telemetry-driven redesign (Phase 9): the old flat MonitoringPanel dump
// (still used untouched by apps/admin's onboarding connection-test panel)
// is replaced with two live-polling charts (power flows + battery SOC),
// a PV1-vs-PV2 comparison, temperature gauges, and a grid-connected
// indicator.
export default async function MonitoringPage() {
  const supabase = await createClient();
  // getSelectedDevice() doesn't depend on the plan check below, so it runs
  // alongside it instead of after. getCustomerPlan() is cache()-deduped
  // against the layout's own call (and every other page's), so this isn't
  // a second real query — same reasoning throughout this pass: independent
  // queries in one round trip, not a waterfall of them.
  const [customerPlan, device] = await Promise.all([getCustomerPlan(), getSelectedDevice()]);

  const features = customerPlan?.features ?? {};
  if (!features.monitoring) {
    redirect("/dashboard");
  }

  const { data: snapshotReadings } = device
    ? await supabase
        .from("device_readings")
        .select("instrument_key, value, ts")
        .eq("device_id", device.id)
        .in("instrument_key", SNAPSHOT_KEYS)
        .order("ts", { ascending: false })
        .limit(SNAPSHOT_KEYS.length * 5)
    : { data: null };

  const latest = new Map<string, number | null>();
  for (const r of snapshotReadings ?? []) {
    if (!latest.has(r.instrument_key)) latest.set(r.instrument_key, r.value);
  }
  const getValue = (key: string) => latest.get(key) ?? null;
  const gridConnected = getValue("grid_connected");

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Monitoring</h1>
          <p className="mt-1 text-sm text-theme-muted">
            {device
              ? `Live readings for ${device.label || device.deviceUid}, updated in real time.`
              : "Live per-device readings, updated in real time."}
          </p>
        </div>
        {device && (
          <Badge variant={gridConnected === 1 ? "default" : gridConnected === 0 ? "alert" : "secondary"}>
            Grid {gridConnected === 1 ? "Connected" : gridConnected === 0 ? "Disconnected" : "Unknown"}
          </Badge>
        )}
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
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Power Flows</CardTitle>
            </CardHeader>
            <CardContent>
              <LiveMetricChart
                deviceId={device.id}
                series={[
                  { key: "inverter_power_w", label: "Solar", color: "var(--chart-1)" },
                  { key: "battery_power_w", label: "Battery", color: "var(--chart-2)" },
                  { key: "grid_power_w", label: "Grid", color: "var(--chart-3)" },
                  { key: "load_power_w", label: "Load", color: "var(--chart-4)" },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Battery SOC Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <LiveMetricChart
                deviceId={device.id}
                series={[{ key: "battery_soc_pct", label: "SOC", color: "var(--chart-2)" }]}
              />
            </CardContent>
          </Card>

          <PvStringComparison getValue={getValue} />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Temperatures</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {TEMPERATURE_FIELDS.map((field) => (
                <TemperatureGauge key={field.key} label={field.label} valueC={getValue(field.key)} warnAboveC={field.warnAboveC} />
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
