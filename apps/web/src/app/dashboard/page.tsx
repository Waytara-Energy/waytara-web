import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";

// Same query shape Task 8.5's employee test panel is meant to reuse
// (device_readings/alerts scoped by RLS, not a manual customer_id filter).
export default async function DashboardOverviewPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: devices } = await supabase
    .from("devices")
    .select("id, status, device_type:device_types(name)");

  // Simplification: takes the most recent readings within a bounded window
  // rather than a true "latest value per device+instrument" query (which
  // needs a DISTINCT ON not easily expressed through the query builder).
  // Fine for an overview snapshot; expected to come back empty until
  // Task 8.5's connection test actually produces readings.
  const { data: recentReadings } = await supabase
    .from("device_readings")
    .select("instrument_key, value, unit, ts")
    .order("ts", { ascending: false })
    .limit(50);

  const { data: recentAlerts } = await supabase
    .from("alerts")
    .select("id, severity, message, ts")
    .order("ts", { ascending: false })
    .limit(5);

  const currentOutput = recentReadings?.find((r) => r.instrument_key === "ac_output_power_w");
  const todaysYield = recentReadings?.find((r) => r.instrument_key === "daily_yield_kwh");

  const deviceCounts = (devices ?? []).reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-theme-muted">{profile?.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SnapshotCard
          label="Current Output"
          value={currentOutput ? `${currentOutput.value} ${currentOutput.unit ?? "W"}` : "No data yet"}
        />
        <SnapshotCard
          label="Today's Energy"
          value={todaysYield ? `${todaysYield.value} ${todaysYield.unit ?? "kWh"}` : "No data yet"}
        />
        <SnapshotCard
          label="Devices"
          value={
            devices && devices.length > 0
              ? Object.entries(deviceCounts)
                  .map(([status, count]) => `${count} ${status}`)
                  .join(", ")
              : "None yet"
          }
        />
        <SnapshotCard label="Recent Alerts" value={String(recentAlerts?.length ?? 0)} />
      </div>

      <div className="rounded-xl border border-theme-border bg-theme-surface p-6">
        <h2 className="mb-3 text-sm font-semibold text-theme-primary">Recent Alerts</h2>
        {recentAlerts && recentAlerts.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {recentAlerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-theme-secondary">
                <span className="capitalize">
                  {a.severity}: {a.message}
                </span>
                <span className="text-xs text-theme-muted">
                  {new Date(a.ts).toLocaleDateString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-theme-muted">No alerts.</p>
        )}
      </div>
    </div>
  );
}

function SnapshotCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-theme-border bg-theme-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-theme-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-theme-primary">{value}</p>
    </div>
  );
}
