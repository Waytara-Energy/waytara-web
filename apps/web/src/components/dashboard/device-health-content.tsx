import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { getLastSyncInfo } from "@/lib/device-sync";
import { deriveFaultEvents } from "@/lib/deye-fault-codes";
import { getConnectorStatusLabel, getErrorCodeLabel } from "@/lib/ev-charger-catalog";
import { fetchEnumOptions } from "@/lib/instrument-catalog-data";
import { deriveFaultCode, FAULT_BITMASK_KEYS } from "@/lib/device-overview";
import { fetchDashboardFields, fetchFieldValues, type FieldValue, type TemplateField } from "@/lib/template-fields";
import { TEMPERATURE_MAX_C } from "@/lib/temperature-thresholds";
import { DynamicFieldGroup } from "./dynamic-field-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import { FaultBanner } from "./fault-banner";
import { FaultHistory } from "./fault-history";
import { LastSyncIndicator } from "./last-sync-indicator";
import { TemperatureGauge } from "./temperature-gauge";
import { StatusPill } from "./status-pill";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const FAULT_HISTORY_DAYS = 90;

// Same 3 real Monitoring > Inverter/Battery temperature registers Phase 3
// already keyed the Main Hub/Battery Pack trend charts to — reused here
// for this card's own trend-vs-24h-ago gauges, same cross-page pattern as
// device-overview.ts's OVERVIEW_CROSSREF_KEYS. Order here is display
// order; everything else (the real label, the warn ceiling) comes from
// temperatureGaugeFieldsFor below, never hardcoded — a hardcoded copy of
// "Battery"/"DC Transformer"/"Radiator" here once read confusingly close
// to duplicate temperature data, when what it actually was is a *wrong*
// label on two genuinely different sensors (Monitoring's own
// equipment_templates calls them "Heat-sink Temperature (DC)"/"(AC)").
const TEMPERATURE_GAUGE_KEYS = ["battery_temperature_c", "inverter_dc_temperature_c", "inverter_ac_temperature_c"];

/** Looks the 3 gauge keys' real display_name up via a Monitoring-section
 *  fetch (these keys are Monitoring-owned, not Maintenance's own field
 *  list) instead of hardcoding a label here that could drift from what
 *  Monitoring's own Temperature Today heatmap calls the same sensor. */
function temperatureGaugeFieldsFor(
  monitoringFields: TemplateField[]
): { key: string; label: string; warnAboveC: number }[] {
  const byKey = new Map(monitoringFields.map((f) => [f.key, f]));
  return TEMPERATURE_GAUGE_KEYS.map((key) => byKey.get(key))
    .filter((f): f is TemplateField => f !== undefined && f.key in TEMPERATURE_MAX_C)
    .map((f) => ({ key: f.key, label: f.label, warnAboveC: TEMPERATURE_MAX_C[f.key] }));
}

function groupTitle(category: string, groupName: string | null): string {
  return groupName ? `${category} — ${groupName}` : category;
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3600 * 1000);
}

/** Maintenance's "Device Health" section, category-aware — mirrors the
 *  other module dispatchers (Phases 1-4). Ticket list and service-contract
 *  status (the rest of Maintenance) are already device-agnostic — this is
 *  the one part of the page that was inverter-specific: fault status,
 *  temperature trends, and the fault-code lookup only mean anything for a
 *  solar_inverter's registers. A category without a curated health view
 *  yet just gets the connection sync indicator, which is genuinely
 *  device-agnostic (last reading received, regardless of category). */
export async function DeviceHealthContent({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const category = device.deviceType?.category;

  if (category === "solar_inverter") {
    return <SolarInverterHealth supabase={supabase} device={device} />;
  }
  if (category === "ev_charger") {
    return <EvChargerHealth supabase={supabase} device={device} />;
  }

  const lastSync = await getLastSyncInfo(device.id);
  return <LastSyncIndicator sync={lastSync} />;
}

async function SolarInverterHealth({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  // sections is this device's own real Maintenance field list (Alerts,
  // Battery Alerts, Service, System Checks) — replaces the old readKeys-
  // filtered TEMPERATURE_FIELDS/FAULT_WORD_FIELDS telemetry-catalog.ts
  // constants entirely. sd_status has no equivalent anywhere in the new
  // equipment_templates inventory (confirmed via direct query), so
  // SdStatusIndicator is dropped rather than shown against a fake key.
  const [sections, monitoringSections] = await Promise.all([
    fetchDashboardFields(supabase, device, "Maintenance"),
    // Monitoring-owned fields (see temperatureGaugeFieldsFor's own
    // comment) — fetched here purely for their real display_name, same
    // cross-section reuse as device-overview.ts's OVERVIEW_CROSSREF_KEYS.
    fetchDashboardFields(supabase, device, "Monitoring"),
  ]);
  const dynamicFields = sections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const dynamicKeys = dynamicFields.map((f) => f.key);
  const monitoringFields = monitoringSections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const temperatureGaugeFields = temperatureGaugeFieldsFor(monitoringFields);
  const tempKeys = temperatureGaugeFields.map((f) => f.key);

  // A day ago (±2h window), for the temperature trend arrows.
  const dayAgo = hoursAgo(24);
  const windowStart = new Date(dayAgo.getTime() - 2 * 3600 * 1000).toISOString();
  const windowEnd = new Date(dayAgo.getTime() + 2 * 3600 * 1000).toISOString();

  const faultSince = hoursAgo(0);
  faultSince.setUTCDate(faultSince.getUTCDate() - FAULT_HISTORY_DAYS);

  const [rawValues, { data: faultRows }, { data: pastRows }, lastSync] = await Promise.all([
    fetchFieldValues(supabase, device.id, [...dynamicKeys, ...tempKeys]),
    // Fault *history*, not just the current state. active_fault_code no
    // longer exists as its own register (see deriveFaultCode's own doc
    // comment) — every reading of any of the 6 raw bitmask registers in
    // the window stands in for it instead, merged into one chronological
    // stream and collapsed into discrete episodes (deriveFaultEvents) the
    // same way a single active_fault_code series used to be. Ascending
    // order: the collapse walk needs to see readings in the order they
    // actually happened.
    supabase
      .from("equipment_telemetry")
      .select("value, ts")
      .eq("equipment_id", device.id)
      .in("key_name", FAULT_BITMASK_KEYS)
      .gte("ts", faultSince.toISOString())
      .order("ts", { ascending: true })
      .limit(2000),
    supabase
      .from("equipment_telemetry")
      .select("key_name, value, ts")
      .eq("equipment_id", device.id)
      .in("key_name", tempKeys)
      .gte("ts", windowStart)
      .lte("ts", windowEnd)
      .order("ts", { ascending: true })
      .limit(50),
    getLastSyncInfo(device.id),
  ]);

  const getValue = (key: string): FieldValue => rawValues.get(key) ?? null;
  const getNum = (key: string): number | null => {
    const v = getValue(key);
    return typeof v === "number" ? v : null;
  };
  const activeFaultCode = deriveFaultCode(getNum);

  const previousTemps = new Map<string, number | null>();
  for (const r of pastRows ?? []) {
    if (!previousTemps.has(r.key_name)) previousTemps.set(r.key_name, r.value);
  }
  const faultEvents = deriveFaultEvents(faultRows ?? []);

  return (
    <>
      <FaultBanner faultCode={activeFaultCode} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fault History (last {FAULT_HISTORY_DAYS}d)</CardTitle>
        </CardHeader>
        <CardContent>
          <FaultHistory events={faultEvents} />
        </CardContent>
      </Card>

      <LastSyncIndicator sync={lastSync} />

      {temperatureGaugeFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Temperature Trends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {temperatureGaugeFields.map((field) => (
              <TemperatureGauge
                key={field.key}
                label={field.label}
                valueC={getNum(field.key)}
                warnAboveC={field.warnAboveC}
                previousValueC={previousTemps.get(field.key) ?? null}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {sections.map((section) =>
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

async function EvChargerHealth({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  // sections is this device's own real Maintenance field list
  // (Diagnostics & Alarms, Firmware & Logs, Remote Commands, Service
  // Record) — connector_status/error_code/connector_temperature_c are
  // Overview/Monitoring-owned, cross-referenced here the same way every
  // other page reuses them for its own status pill/fault banner.
  const sections = await fetchDashboardFields(supabase, device, "Maintenance");
  const dynamicFields = sections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const dynamicKeys = dynamicFields.map((f) => f.key);
  const CROSSREF_KEYS = ["connector_status", "error_code", "connector_temperature_c"];

  const [rawValues, lastSync, enumOptions] = await Promise.all([
    fetchFieldValues(supabase, device.id, [...dynamicKeys, ...CROSSREF_KEYS]),
    getLastSyncInfo(device.id),
    fetchEnumOptions(supabase, ["connector_status", "error_code"]),
  ]);

  const getValue = (key: string): FieldValue => rawValues.get(key) ?? null;
  const status = getConnectorStatusLabel(getValue("connector_status") as number | null, enumOptions.get("connector_status") ?? []);
  const errorLabel = getErrorCodeLabel(getValue("error_code") as number | null, enumOptions.get("error_code") ?? []);
  const temperature = getValue("connector_temperature_c") as number | null;

  return (
    <>
      <div className="flex justify-end">
        <StatusPill label={status.label} tone={status.tone} />
      </div>

      {errorLabel ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Charger fault</AlertTitle>
          <AlertDescription>{errorLabel}</AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertTitle>No active faults</AlertTitle>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LastSyncIndicator sync={lastSync} />
        <div className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-muted">
          Connector temperature: <span className="font-medium text-theme-primary">{temperature !== null ? `${temperature.toFixed(1)} °C` : "—"}</span>
        </div>
      </div>

      {sections.map((section) =>
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
