import { TriangleAlert } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { getConnectorStatusLabel, getErrorCodeLabel, EV_LIVE_FIELDS, EV_TOTAL_FIELDS, EV_TODAY_DETAIL_FIELDS } from "@/lib/ev-charger-catalog";
import { formatValue } from "@/lib/telemetry-catalog";
import { getCustomerPlan } from "@/lib/customer-plan";
import { fetchTodayEvEnergyKwh } from "@/lib/device-overview";
import { formatElapsedSince } from "@/lib/format-duration";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusPill } from "./status-pill";
import { RecentAlerts, type AlertRow } from "./recent-alerts";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const READ_KEYS = [...EV_LIVE_FIELDS, ...EV_TOTAL_FIELDS].map((f) => f.key).concat(["connector_status", "error_code"]);

/** The EV charger's own curated Overview — the charger-category
 *  counterpart to the solar inverter's status pill / fault banner / energy
 *  flow / today-so-far block, built from this device's own OCPP telemetry
 *  (device_parameters + device_readings), not the inverter's fixed key
 *  list. Settings live in their own section on the Devices detail page
 *  (see DeviceOverviewContent), not here — this is telemetry only. */
export async function EvChargerOverview({
  supabase,
  device,
  showAlerts = true,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  showAlerts?: boolean;
}) {
  const [{ data: readings }, { data: recentAlerts }, { data: openSession }, customerPlan, todayEnergyKwh] = await Promise.all([
    supabase
      .from("device_readings")
      .select("instrument_key, value, ts")
      .eq("device_id", device.id)
      .in("instrument_key", READ_KEYS)
      .order("ts", { ascending: false })
      .limit(READ_KEYS.length * 5),
    showAlerts
      ? supabase
          .from("alerts")
          .select("id, device_id, severity, message, ts, acknowledged_at")
          .eq("device_id", device.id)
          .is("acknowledged_at", null)
          .order("ts", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null }),
    supabase.from("charging_sessions").select("started_at").eq("device_id", device.id).is("ended_at", null).maybeSingle(),
    getCustomerPlan(),
    fetchTodayEvEnergyKwh(supabase, [device.id]),
  ]);

  const latest = new Map<string, number | null>();
  for (const r of readings ?? []) {
    if (!latest.has(r.instrument_key)) latest.set(r.instrument_key, r.value);
  }
  const get = (key: string) => latest.get(key) ?? null;

  const status = getConnectorStatusLabel(get("connector_status"));
  const errorLabel = getErrorCodeLabel(get("error_code"));
  const tariffRate = customerPlan?.tariffRatePerKwh ?? 8;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <StatusPill label={status.label} tone={status.tone} />
      </div>

      {errorLabel && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Charger fault</AlertTitle>
          <AlertDescription>{errorLabel}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {EV_LIVE_FIELDS.map((field) => (
          <Card key={field.key}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatValue(get(field.key), field)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {EV_TODAY_DETAIL_FIELDS.map((field) => (
          <Card key={field.key}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatValue(get(field.key), field)}</p>
            </CardContent>
          </Card>
        ))}
        {todayEnergyKwh !== null && (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Energy Delivered Today</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{todayEnergyKwh.toFixed(1)} kWh</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cost Today</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  ₹{(todayEnergyKwh * tariffRate).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
          </>
        )}
        {openSession && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Session</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatElapsedSince(openSession.started_at)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {showAlerts && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Recent Alerts</h3>
          <RecentAlerts deviceIds={[device.id]} initialAlerts={(recentAlerts ?? []) as AlertRow[]} />
        </div>
      )}
    </div>
  );
}
