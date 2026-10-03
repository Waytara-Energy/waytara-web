import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import { fetchDailyMaxReadings } from "@/lib/device-readings-fetch";
import { fetchDashboardFields, fetchFieldValues, resolveComputedValues, type FieldValue } from "@/lib/template-fields";
import { DynamicFieldGroup } from "./dynamic-field-group";
import { PerformanceChart, DivergingBarChart } from "./lazy-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aggregateDailyYield, zipDailySeries, type RawReading } from "@/lib/energy-aggregation";
import { formatDuration } from "@/lib/format-duration";
import { DeviceParameterCards } from "./device-parameter-cards";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const HISTORY_DAYS = 180;

// The daily-history chart's own 5 keys — real, but each one's own
// equipment_templates row is tagged dashboard_section: "Overview"/
// "Monitoring" (today's totals), not "Performance". Same cross-page reuse
// convention as Monitoring's OVERVIEW_CROSSREF_KEYS: a field's
// dashboard_section says which screen renders its own full detail, not
// which screens may chart its history.
const YIELD_KEY = "day_pv_energy_kwh";
const SOLAR_HISTORY_KEYS = [
  YIELD_KEY,
  "day_battery_charge_energy_kwh",
  "day_battery_discharge_energy_kwh",
  "day_grid_import_energy_kwh",
  "day_grid_export_energy_kwh",
];

/** Picks the right category-specific Performance body — mirrors
 *  DeviceOverviewContent/MonitoringContent's dispatch pattern (Phases 1-3).
 *  A category without one yet falls back to the same generic parameter
 *  cards every other unhandled category gets elsewhere. */
export async function PerformanceContent({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const category = device.deviceType?.category;

  if (category === "solar_inverter") {
    return <SolarInverterPerformance supabase={supabase} device={device} />;
  }
  if (category === "ev_charger") {
    return <EvChargerPerformance supabase={supabase} device={device} />;
  }

  const parameters = await fetchDeviceParameterReadings(supabase, device);
  return <DeviceParameterCards parameters={parameters} />;
}

function groupTitle(category: string, groupName: string | null): string {
  return groupName ? `${category} — ${groupName}` : category;
}

async function SolarInverterPerformance({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  // sections is this device's own real Performance field list (Battery
  // Health, Production, Self Use, Solar Array Comparison) — replaces the
  // old MONTH_TOTAL_FIELDS/YEAR_TOTAL_FIELDS/LIFETIME_TOTAL_FIELDS
  // telemetry-catalog.ts constants entirely; the new equipment_templates
  // inventory has no month/year/lifetime-rollup category under Performance
  // at all, so that old "Period & Lifetime Totals" card's concept has no
  // new-schema home and isn't recreated here.
  const sections = await fetchDashboardFields(supabase, device, "Performance");
  const dynamicFields = sections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const dynamicKeys = dynamicFields.map((f) => f.key);
  const enumRefs = Array.from(new Set(dynamicFields.map((f) => f.enumRef).filter((r): r is string => r !== null)));

  // self_consumption_pct/self_sufficiency_pct's own day_* inputs are
  // Overview-owned; battery_round_trip_efficiency_pct's day_battery_*
  // inputs are Monitoring-owned; total_pv_energy_kwh (lifetime tile) is
  // Monitoring-owned too — all real keys, cross-referenced the same way
  // Monitoring already reuses Overview's.
  const CROSSREF_KEYS = [
    "day_pv_energy_kwh",
    "day_grid_export_energy_kwh",
    "day_load_energy_kwh",
    "day_grid_import_energy_kwh",
    "day_battery_charge_energy_kwh",
    "day_battery_discharge_energy_kwh",
    "total_pv_energy_kwh",
  ];

  const [rawRows, rawValues, enumOptions] = await Promise.all([
    fetchDailyMaxReadings(supabase, device.id, SOLAR_HISTORY_KEYS, since.toISOString()),
    fetchFieldValues(supabase, device.id, [...dynamicKeys, ...CROSSREF_KEYS]),
    enumRefs.length > 0
      ? supabase
          .from("equipment_enum")
          .select("enum_ref, code, label")
          .in("enum_ref", enumRefs)
          .order("code")
          .then(({ data }) => {
            const m = new Map<string, { code: string; label: string }[]>();
            for (const row of data ?? []) {
              const list = m.get(row.enum_ref) ?? [];
              list.push({ code: row.code, label: row.label });
              m.set(row.enum_ref, list);
            }
            return m;
          })
      : Promise.resolve(new Map<string, { code: string; label: string }[]>()),
  ]);
  const values = resolveComputedValues(dynamicFields, rawValues, device);
  const getValue = (key: string): FieldValue => values.get(key) ?? null;
  const getNum = (key: string): number | null => {
    const v = getValue(key);
    return typeof v === "number" ? v : null;
  };

  const byKey = (key: string): RawReading[] =>
    rawRows.filter((r) => r.key_name === key).map((r) => ({ device_id: device.id, value: r.value, ts: r.ts }));

  const daily = aggregateDailyYield(byKey(YIELD_KEY));
  const batteryCharge = aggregateDailyYield(byKey("day_battery_charge_energy_kwh"));
  const batteryDischarge = aggregateDailyYield(byKey("day_battery_discharge_energy_kwh"));
  const gridImport = aggregateDailyYield(byKey("day_grid_import_energy_kwh"));
  const gridExport = aggregateDailyYield(byKey("day_grid_export_energy_kwh"));

  const batteryDiverging = zipDailySeries(batteryCharge, batteryDischarge);
  const gridDiverging = zipDailySeries(gridExport, gridImport);

  const selfConsumptionPct = getNum("self_consumption_pct");
  const lifetimePvKwh = getNum("total_pv_energy_kwh");

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Self-consumption (today)</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {selfConsumptionPct !== null ? `${selfConsumptionPct.toFixed(0)}%` : "No data yet"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total PV energy (lifetime)</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {lifetimePvKwh !== null ? `${lifetimePvKwh.toLocaleString("en-IN")} kWh` : "No data yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
        <PerformanceChart daily={daily} unit="kWh" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Battery: Charge vs. Discharge</CardTitle>
        </CardHeader>
        <CardContent>
          <DivergingBarChart data={batteryDiverging} positiveLabel="Charged" negativeLabel="Discharged" unit="kWh" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Grid: Export vs. Import</CardTitle>
        </CardHeader>
        <CardContent>
          <DivergingBarChart data={gridDiverging} positiveLabel="Exported" negativeLabel="Imported" unit="kWh" />
        </CardContent>
      </Card>

      {sections.map((section) =>
        section.groups.map((group) => (
          <DynamicFieldGroup
            key={`${section.category}-${group.groupName ?? ""}`}
            title={groupTitle(section.category, group.groupName)}
            fields={group.fields}
            getValue={getValue}
            enumOptionsByRef={enumOptions}
          />
        ))
      )}
    </>
  );
}

async function EvChargerPerformance({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  // EV Performance's real template rows are all category "Platform
  // Analytics", source: "platform" — every one of them is a session-
  // history aggregate, not a register, so nothing here comes from
  // equipment_telemetry/fetchFieldValues at all.
  const sections = await fetchDashboardFields(supabase, device, "Performance");

  // "Sessions & Billing" is its own dashboard_section (Billing's day/week/
  // month/year/lifetime rollups + Tariff's rate configuration, 20 fields)
  // — brand new, no existing screen rendered it before. Its natural home
  // is this same page, alongside the existing Charging Sessions table,
  // rather than a whole new nav destination for one EV-only section.
  const billingSections = await fetchDashboardFields(supabase, device, "Sessions & Billing");
  const billingFields = billingSections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const billingKeys = billingFields.map((f) => f.key);

  // energy_active_import_register_kwh is OCPP's lifetime meter register —
  // monotonically non-decreasing, so the "max seen per day" aggregateDailyYield
  // already computes is exactly the day's ending cumulative value (never
  // resets, so max == last within a day). aggregationMode="last" below
  // then makes weekly/monthly rollups take that latest value instead of
  // summing it (summing a cumulative series would double-count).
  const [energyRows, { data: sessions }, billingValues] = await Promise.all([
    fetchDailyMaxReadings(supabase, device.id, ["energy_active_import_register_kwh"], since.toISOString()),
    supabase
      .from("ev_sessions")
      .select("id, started_at, ended_at, start_energy_kwh, end_energy_kwh, stop_reason")
      .eq("equipment_id", device.id)
      .order("started_at", { ascending: false })
      .limit(30),
    fetchFieldValues(supabase, device.id, billingKeys),
  ]);

  const daily = aggregateDailyYield(energyRows.map((r) => ({ device_id: device.id, value: r.value, ts: r.ts })));

  // Only avg_session_energy_kwh/avg_session_duration_min have a clean,
  // honest definition from data this app already tracks (ev_sessions'
  // own energy/timestamp columns). The other 9 Platform Analytics fields
  // (per-connector split, SOC-at-plug-in/unplug, derating time, uptime,
  // success rate) have no tracked source yet — left as "no data" rather
  // than invented, same principle as EvChargerOverview's co2_saved_today_kg.
  const energyDeltas: number[] = [];
  const durationsMin: number[] = [];
  for (const s of sessions ?? []) {
    if (s.start_energy_kwh === null || s.end_energy_kwh === null || s.ended_at === null) continue;
    energyDeltas.push(s.end_energy_kwh - s.start_energy_kwh);
    durationsMin.push((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
  }
  const avgSessionEnergyKwh = energyDeltas.length > 0 ? energyDeltas.reduce((a, b) => a + b, 0) / energyDeltas.length : null;
  const avgSessionDurationMin = durationsMin.length > 0 ? durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length : null;

  const platformValues = new Map<string, FieldValue>(billingValues);
  if (avgSessionEnergyKwh !== null) platformValues.set("avg_session_energy_kwh", avgSessionEnergyKwh);
  if (avgSessionDurationMin !== null) platformValues.set("avg_session_duration_min", avgSessionDurationMin);
  const getValue = (key: string): FieldValue => platformValues.get(key) ?? null;

  return (
    <>
      <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
        <PerformanceChart daily={daily} unit="kWh" aggregationMode="last" totalLabel="Total energy delivered" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Charging Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {!sessions || sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No charging sessions recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Energy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => {
                  const energy =
                    s.end_energy_kwh !== null && s.start_energy_kwh !== null ? s.end_energy_kwh - s.start_energy_kwh : null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-foreground">
                        {new Date(s.started_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDuration(s.started_at, s.ended_at)}</TableCell>
                      <TableCell className="text-right text-foreground">{energy !== null ? `${energy.toFixed(1)} kWh` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {[...sections, ...billingSections].map((section) =>
        section.groups.map((group) => (
          <DynamicFieldGroup
            key={`${section.category}-${group.groupName ?? ""}`}
            title={groupTitle(section.category, group.groupName)}
            fields={group.fields}
            getValue={getValue}
          />
        ))
      )}
    </>
  );
}
