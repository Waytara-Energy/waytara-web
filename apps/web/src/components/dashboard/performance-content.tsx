import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import { fetchDailyMaxReadings } from "@/lib/device-readings-fetch";
import { fetchDashboardFields, fetchFieldValues, resolveComputedValues, type FieldValue } from "@/lib/template-fields";
import { LiveDynamicFieldGroup } from "./live-field-group";
import { PerformanceBoard, type PerformanceSectionId } from "./performance-board";
import { PERFORMANCE_LIVE_KEYS, pvInputKeys } from "@/lib/performance-metrics";
import { batteryProfileFromUnits, type BatteryProfile, type BatteryUnit } from "@/lib/battery-health";
import { solarKwp, type ChildEquipment } from "@/lib/equipment-children";
import { pvPowerKeys } from "@/lib/solar-generation";
import { fetchReadKeys } from "@/lib/instrument-catalog-data";
import { enumToObject, valuesFor } from "@/lib/field-values";
import { EvPerformanceBoard } from "./ev-performance-board";
import { EV_PERF_COLUMNS, type EvPerfSession } from "@/lib/ev-perf-stats";
import { getSelectedSite } from "@/lib/selected-site";
import { DAY_KEYS } from "@/lib/performance-metrics";
import { DeviceParameterCards } from "./device-parameter-cards";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const HISTORY_DAYS = 180;

// The daily-history chart's own 5 keys — real, but each one's own
// equipment_templates row is tagged dashboard_section: "Overview"/
// "Monitoring" (today's totals), not "Performance". Same cross-page reuse
// convention as Monitoring's OVERVIEW_CROSSREF_KEYS: a field's
// dashboard_section says which screen renders its own full detail, not
// which screens may chart its history.

/** Picks the right category-specific Performance body — mirrors
 *  DeviceOverviewContent/MonitoringContent's dispatch pattern (Phases 1-3).
 *  A category without one yet falls back to the same generic parameter
 *  cards every other unhandled category gets elsewhere. */
export async function PerformanceContent({ supabase, device, tariffRate = 8 }: { supabase: SupabaseServerClient; device: CustomerDevice; tariffRate?: number }) {
  const category = device.deviceType?.category;

  if (category === "solar_inverter") {
    return <SolarInverterPerformance supabase={supabase} device={device} tariffRate={tariffRate} />;
  }
  if (category === "ev_charger") {
    return <EvChargerPerformance supabase={supabase} device={device} tariffRate={tariffRate} />;
  }

  const parameters = await fetchDeviceParameterReadings(supabase, device);
  return <DeviceParameterCards parameters={parameters} />;
}

function groupTitle(category: string, groupName: string | null): string {
  return groupName ? `${category} — ${groupName}` : category;
}

async function SolarInverterPerformance({ supabase, device, tariffRate }: { supabase: SupabaseServerClient; device: CustomerDevice; tariffRate: number }) {
  // The page itself is PerformanceBoard (lifetime cards, then the opened segment's detail). What is fetched here is only
  // its first numbers: the live figures stay current in the browser from there on.
  const sections = await fetchDashboardFields(supabase, device, "Performance");
  const dynamicFields = sections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const dynamicKeys = dynamicFields.map((f) => f.key);
  const enumRefs = Array.from(new Set(dynamicFields.map((f) => f.enumRef).filter((r): r is string => r !== null)));

  const readKeys = await fetchReadKeys(supabase, device);
  const pvKeys = pvPowerKeys(readKeys);
  // Child equipment under this inverter (panels, a battery ...): its stock record says what it is, its row says how many and
  // when it was installed. The Performance page reads them for the installed solar size and for the battery's cycles and health.
  const { data: childRows } = await supabase
    .from("equipment")
    .select("quantity, installed_at, discharged_baseline_kwh, device_type:equipment_inventory(category, power_capacity_value, power_capacity_unit, technical_specs, warranty_info)")
    .eq("parent_id", device.id)
    .is("retired_at", null);
  const children: (ChildEquipment & { baselineDischargedKwh: number | null })[] = (childRows ?? []).map((e) => ({
    category: e.device_type?.category ?? null,
    quantity: e.quantity,
    installedAt: e.installed_at,
    capacityValue: e.device_type?.power_capacity_value ?? null,
    capacityUnit: e.device_type?.power_capacity_unit ?? null,
    specs: (e.device_type?.technical_specs as Record<string, unknown> | null) ?? null,
    warranty: (e.device_type?.warranty_info as Record<string, unknown> | null) ?? null,
    baselineDischargedKwh: e.discharged_baseline_kwh,
  }));
  const batteryUnits: BatteryUnit[] = children.filter((c) => c.category === "Batteries");
  const batteryProfile: BatteryProfile | null = batteryProfileFromUnits(batteryUnits);

  const liveKeys = [...PERFORMANCE_LIVE_KEYS, ...pvInputKeys(pvKeys)];

  const [rawValues, enumOptions] = await Promise.all([
    fetchFieldValues(supabase, device.id, [...dynamicKeys, ...liveKeys]),
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
  const initial = Object.fromEntries(liveKeys.map((k) => [k, getNum(k)]));

  // The device's own Performance fields that actually have a reading appear under the segment they belong to.
  const SECTION_OF: Record<string, PerformanceSectionId> = {
    "Battery Health": "battery",
    Production: "inverter",
    "Self Use": "load",
    "Solar Array Comparison": "solar",
  };
  const extras: Partial<Record<PerformanceSectionId, React.ReactNode>> = {};
  for (const section of sections) {
    const target = SECTION_OF[section.category];
    if (!target) continue;
    const groups = section.groups.filter((g) => g.fields.some((f) => getValue(f.key) !== null));
    if (groups.length === 0) continue;
    extras[target] = (
      <>
        {extras[target]}
        {groups.map((group) => (
          <LiveDynamicFieldGroup
            deviceId={device.id}
            key={`${section.category}-${group.groupName ?? ""}`}
            title={groupTitle(section.category, group.groupName)}
            fields={group.fields}
            initial={valuesFor(group.fields, getValue)}
            enumOptions={enumToObject(enumOptions)}
          />
        ))}
      </>
    );
  }

  return <PerformanceBoard deviceId={device.id} initial={initial} pvKeys={pvKeys} tariff={tariffRate} batteryProfile={batteryProfile} solarKwp={solarKwp(children)} extras={extras} />;
}

async function EvChargerPerformance({ supabase, device, tariffRate }: { supabase: SupabaseServerClient; device: CustomerDevice; tariffRate: number }) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  // "Sessions & Billing" is its own dashboard_section (Billing's day/week/month/year/lifetime rollups + Tariff's rate configuration): it stays under
  // the board, as template fields.
  const billingSections = await fetchDashboardFields(supabase, device, "Sessions & Billing");
  const billingFields = billingSections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const billingKeys = billingFields.map((f) => f.key);

  // The home's energy use per day, from the site's inverter, to say how much of it went to the car (skipped when the site has none).
  const site = await getSelectedSite();
  const inverterId = site?.devices.find((d) => d.deviceType?.category === "solar_inverter")?.id ?? null;

  const [{ data: sessionRows }, billingValues, loadRows] = await Promise.all([
    supabase.from("ev_sessions").select(EV_PERF_COLUMNS).eq("equipment_id", device.id).gte("started_at", since.toISOString()).order("started_at", { ascending: false }).limit(2000),
    fetchFieldValues(supabase, device.id, billingKeys),
    inverterId ? fetchDailyMaxReadings(supabase, inverterId, [DAY_KEYS.load], since.toISOString()).catch(() => []) : Promise.resolve([]),
  ]);

  const sessions = (sessionRows ?? []) as unknown as EvPerfSession[];
  const loadDaily = loadRows.filter((r) => typeof r.value === "number").map((r) => ({ ts: r.ts, value: r.value as number }));
  const getValue = (key: string): FieldValue => billingValues.get(key) ?? null;

  return (
    <>
      <EvPerformanceBoard deviceId={device.id} sessions={sessions} loadDaily={loadDaily} tariff={tariffRate > 0 ? tariffRate : null} />

      {billingSections.map((section) =>
        section.groups.map((group) => (
          <LiveDynamicFieldGroup
            deviceId={device.id}
            key={`${section.category}-${group.groupName ?? ""}`}
            title={groupTitle(section.category, group.groupName)}
            fields={group.fields}
            initial={valuesFor(group.fields, getValue)}
          />
        ))
      )}
    </>
  );
}
