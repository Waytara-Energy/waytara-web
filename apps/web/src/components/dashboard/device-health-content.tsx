import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { getConnectorStatusLabel, getErrorCodeLabel } from "@/lib/ev-charger-catalog";
import { fetchEnumOptions } from "@/lib/instrument-catalog-data";
import { fetchDashboardFields, fetchFieldValues, type FieldValue } from "@/lib/template-fields";
import { LiveDynamicFieldGroup } from "./live-field-group";
import { hasRecord, valuesFor } from "@/lib/field-values";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import { StatusPill } from "./status-pill";
import { TroubleshootingGuide } from "./troubleshooting-guide";
import { evChargerGuide } from "@/lib/troubleshooting-guide";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;


function groupTitle(category: string, groupName: string | null): string {
  return groupName ? `${category} — ${groupName}` : category;
}

/** The Health tab for a device that is not a solar inverter. A solar inverter's health (live checks, temperatures, fault history, the
 *  guide) is built by the Maintenance board itself; an EV charger gets its own view here, and any other category has none yet. */
export async function DeviceHealthContent({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const category = device.deviceType?.category;

  if (category === "ev_charger") {
    return <EvChargerHealth supabase={supabase} device={device} />;
  }

  return null;
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

  const [rawValues, enumOptions] = await Promise.all([
    fetchFieldValues(supabase, device.id, [...dynamicKeys, ...CROSSREF_KEYS]),
    fetchEnumOptions(supabase, ["connector_status", "error_code"]),
  ]);

  const getValue = (key: string): FieldValue => rawValues.get(key) ?? null;
  const status = getConnectorStatusLabel(getValue("connector_status") as number | null, enumOptions.get("connector_status") ?? []);
  const errorLabel = getErrorCodeLabel(getValue("error_code") as number | null, enumOptions.get("error_code") ?? []);
  const temperature = getValue("connector_temperature_c") as number | null;
  // Only the readings that hold a record (not empty, not zero) are listed; the guide below says what a code means.
  const recordGroups = sections.flatMap((section) =>
    section.groups.map((group) => ({ section, group, fields: group.fields.filter((f) => hasRecord(getValue(f.key))) })).filter((g) => g.fields.length > 0)
  );

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
        <div className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-muted">
          Connector temperature: <span className="font-medium text-theme-primary">{temperature !== null ? `${temperature.toFixed(1)} °C` : "—"}</span>
        </div>
      </div>

      <TroubleshootingGuide title="Troubleshooting guide" sections={evChargerGuide()} active={[errorLabel, status.label].filter((x): x is string => !!x).map((x) => x.replace(/[^A-Za-z0-9_]/g, ""))} />

      {recordGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-theme-primary">Records</h2>
          {recordGroups.map(({ section, group, fields }) => (
            <LiveDynamicFieldGroup deviceId={device.id} key={`${section.category}-${group.groupName ?? ""}`} title={groupTitle(section.category, group.groupName)} fields={fields} initial={valuesFor(fields, getValue)} />
          ))}
        </div>
      )}
    </>
  );
}
