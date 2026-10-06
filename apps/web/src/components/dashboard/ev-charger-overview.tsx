import { TriangleAlert } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { getConnectorStatusLabel, getErrorCodeLabel } from "@/lib/ev-charger-catalog";
import { fetchEnumOptions } from "@/lib/instrument-catalog-data";
import { fetchDashboardFields, fetchFieldValues } from "@/lib/template-fields";
import { getCustomerPlan } from "@/lib/customer-plan";
import { fetchTodayEvEnergyKwh, fetchTodayChargingSessions } from "@/lib/device-overview";
import { formatElapsedSince } from "@/lib/format-duration";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusPill } from "./status-pill";
import { LiveDynamicFieldGroup } from "./live-field-group";
import { enumToObject, valuesFor } from "@/lib/field-values";
import { RecentAlerts, type AlertRow } from "./recent-alerts";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** The EV charger's own curated Overview — the charger-category
 *  counterpart to the solar inverter's status pill / fault banner / energy
 *  flow / today-so-far block. Every `dashboard_section: "Overview"` field
 *  this device actually has mapped renders somewhere on this page now:
 *  "Charger Status"/"Connector"/"Energy Meter" (all real OCPP telemetry)
 *  render through the same DynamicFieldGroup every other dashboard page
 *  uses; "Platform Analytics" (today's session/revenue/CO2 figures — none
 *  of them a real register, all computed from ev_sessions) keeps its own
 *  hand-built tiles below, since that math needs session data + the
 *  customer's tariff rate, not just a value lookup. */
export async function EvChargerOverview({
  supabase,
  device,
  showAlerts = true,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  showAlerts?: boolean;
}) {
  const [sections, { data: recentAlerts }, { data: openSession }, customerPlan, todayEnergyKwh, chargingSummary, enumOptions] =
    await Promise.all([
      fetchDashboardFields(supabase, device, "Overview"),
      showAlerts
        ? supabase
            .from("alerts")
            .select("id, device_id, severity, message, ts, acknowledged_at")
            .eq("device_id", device.id)
            .is("acknowledged_at", null)
            .order("ts", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: null }),
      supabase.from("ev_sessions").select("started_at").eq("equipment_id", device.id).is("ended_at", null).maybeSingle(),
      getCustomerPlan(),
      fetchTodayEvEnergyKwh(supabase, [device.id]),
      fetchTodayChargingSessions(supabase, device.id),
      fetchEnumOptions(supabase, ["connector_status", "error_code"]),
    ]);

  // "Charger Status"/"Connector"/"Energy Meter" are real telemetry;
  // "Platform Analytics" is rendered separately below (see this
  // function's own doc comment) — never fetched from equipment_telemetry
  // at all, since nothing writes a register for it.
  const registerSections = sections.filter((s) => s.category !== "Platform Analytics");
  const registerKeys = registerSections.flatMap((s) => s.groups.flatMap((g) => g.fields.map((f) => f.key)));
  const values = await fetchFieldValues(supabase, device.id, registerKeys);
  const get = (key: string) => values.get(key) ?? null;

  const status = getConnectorStatusLabel(get("connector_status") as number | null, enumOptions.get("connector_status") ?? []);
  const errorLabel = getErrorCodeLabel(get("error_code") as number | null, enumOptions.get("error_code") ?? []);
  const tariffRate = customerPlan?.tariffRatePerKwh ?? 8;
  const sessionsToday = chargingSummary.sessions.length;

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

      {/* Columns, not a grid — see the Devices page's identical note on why
          (uneven card heights + grid's row-major placement leaves gaps a
          masonry-style column flow doesn't). */}
      <div className="columns-1 gap-4 sm:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {registerSections.map((section) =>
          section.groups.map((group) => (
            <LiveDynamicFieldGroup deviceId={device.id}
              key={`${section.category}-${group.groupName ?? ""}`}
              title={group.groupName ? `${section.category} — ${group.groupName}` : section.category}
              fields={group.fields}
              initial={valuesFor(group.fields, get)}
              enumOptions={enumToObject(enumOptions)}
            />
          ))
        )}
      </div>

      {/* Platform Analytics — today's session/billing figures, computed
          from ev_sessions rather than a register. active_sessions_count
          and sessions_today_count both come from data already fetched
          above; co2_saved_today_kg and utilization_today_pct have no
          established formula for a charging session yet (unlike solar's
          grid-displacement CO2 math) — left off rather than showing an
          invented number. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active Sessions</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{openSession ? "1" : "0"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sessions Today</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{sessionsToday}</p>
          </CardContent>
        </Card>
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
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Revenue Today</p>
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
