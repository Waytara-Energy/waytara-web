import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, type CustomerDevice } from "@/lib/selected-site";
import { getCustomerPlan } from "@/lib/customer-plan";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import { fetchEnumOptions } from "@/lib/instrument-catalog-data";
import { fetchTodayChargingSessions, fetchRecentChargingStats, FAULT_BITMASK_KEYS } from "@/lib/device-overview";
import { getLastSyncInfo } from "@/lib/device-sync";
import { getConnectorStatusLabel, getErrorCodeLabel } from "@/lib/ev-charger-catalog";
import {
  fetchDashboardFields,
  fetchFieldValues,
  resolveComputedValues,
  type FieldValue,
  type FieldGroup,
  type CategorySection,
} from "@/lib/template-fields";
import { TEMPERATURE_MAX_C } from "@/lib/temperature-thresholds";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  TriangleAlert,
  Plug,
  History,
} from "lucide-react";
import { ChargerTrendGroup } from "./lazy-charts";
import { SolarMonitoringView } from "./solar-monitoring-view";
import { TabButtonContent } from "./monitoring-shared";
import { EvHubCards, EvHubGroups } from "./ev-hub-live";
import { temperatureRowsFor } from "@/lib/temperature-rows";
import { valuesFor, enumToObject } from "@/lib/field-values";
import { SessionReceiptCard, type ReceiptSection } from "./session-receipt-card";
import { StatusPill } from "./status-pill";
import { DeviceParameterCards } from "./device-parameter-cards";
import { ChargingSessionsCarousel } from "./charging-sessions-carousel";
import { MonitoringTabs } from "./monitoring-tabs";
import { LiveSyncedAgo } from "./live-synced-ago";
import { DeviceSwitcher } from "./device-switcher";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Cross-page reads — real keys, but their own equipment_templates row is
// tagged dashboard_section: "Overview" (state-of-the-system totals like
// SOC/site power flow), not "Monitoring". Reused here the same way
// EnergyFlowDiagram/TodaySoFar already reuse them on Overview — a field's
// dashboard_section says which screen renders its own full detail, it
// doesn't forbid a different screen's headline tile from reading the same
// real value.
const OVERVIEW_CROSSREF_KEYS = [
  "battery_power_w",
  "battery_soc_pct",
  "grid_total_power_w",
  "load_total_power_w",
  "inverter_run_state",
  "day_pv_energy_kwh",
  "day_grid_import_energy_kwh",
  "day_grid_export_energy_kwh",
  "day_load_energy_kwh",
  ...FAULT_BITMASK_KEYS,
];

/** Picks the right category-specific live Monitoring body — mirrors
 *  DeviceOverviewContent's dispatch pattern (Phase 1), applied to
 *  Monitoring's live-polling charts instead of the static Overview
 *  snapshot. A category without one yet falls back to the same generic
 *  parameter cards every other unhandled category gets elsewhere. */
export async function MonitoringContent({
  supabase,
  device,
  devices,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  devices: CustomerDevice[];
}) {
  const category = device.deviceType?.category;

  if (category === "solar_inverter") {
    return <SolarInverterMonitoring supabase={supabase} device={device} devices={devices} />;
  }
  if (category === "ev_charger") {
    return <EvChargerMonitoring supabase={supabase} device={device} devices={devices} />;
  }

  const parameters = await fetchDeviceParameterReadings(supabase, device);
  return <DeviceParameterCards parameters={parameters} />;
}

// EV's own top-level categories (each one group_name: null group) in
// display priority — safety-relevant state leads, capability/config info
// (Vehicle DC's ratings) trails, same "most urgent first" reasoning as
// GROUP_PRIORITY above, just one level up since these sit side by side as
// whole categories rather than named groups within one.
const EV_HUB_CATEGORY_PRIORITY = ["Connector & Safety", "DC Output", "Energy Meter", "Vehicle (EV) — DC", "Temperature & Cooling"];

function sortSectionsByCategory(sections: CategorySection[], order: string[]): { category: string; group: FieldGroup }[] {
  const flat = sections.flatMap((s) => s.groups.map((group) => ({ category: s.category, group })));
  return flat.sort((a, b) => {
    const ai = order.indexOf(a.category);
    const bi = order.indexOf(b.category);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

async function SolarInverterMonitoring({
  supabase,
  device,
  devices,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  devices: CustomerDevice[];
}) {
  // sections is this device's own real, DB-driven Monitoring field list - every group here is something this
  // specific installation's own equipment_metrics rows confirm exist.
  const sections = await fetchDashboardFields(supabase, device, "Monitoring");
  const byCategory = new Map(sections.map((s) => [s.category, s.groups]));

  // The "Temperature" group's own fields are shown exclusively via the Temperature Today heatmap (a time-series
  // view suits a sensor reading far better than one more flat current-value row).
  const inverterGroups = (byCategory.get("Inverter") ?? []).filter((g) => g.groupName !== "Temperature");
  const inverterTemperatureRows = temperatureRowsFor((byCategory.get("Inverter") ?? []).find((g) => g.groupName === "Temperature")?.fields ?? []);
  // Battery > Live carries battery_temperature_c alongside unrelated fields, so only that one field is dropped.
  const batteryGroups = (byCategory.get("Battery") ?? []).map((g) =>
    g.groupName === "Live" ? { ...g, fields: g.fields.filter((f) => f.key !== "battery_temperature_c") } : g
  );
  const batteryTemperatureRows = temperatureRowsFor((byCategory.get("Battery") ?? []).find((g) => g.groupName === "Live")?.fields ?? []);

  const dynamicFields = sections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const monitoringKeys = dynamicFields.map((f) => f.key);
  const enumRefs = Array.from(new Set(dynamicFields.map((f) => f.enumRef).filter((r): r is string => r !== null)));

  const [rawValues, lastSync, enumOptions] = await Promise.all([
    fetchFieldValues(supabase, device.id, [...monitoringKeys, ...OVERVIEW_CROSSREF_KEYS]),
    getLastSyncInfo(device.id),
    fetchEnumOptions(supabase, [...enumRefs, "inverter_state"]),
  ]);
  const values = resolveComputedValues(dynamicFields, rawValues, device);

  // Everything below is handed to the client view as plain data: the server renders the first numbers, the view
  // keeps them live (see SolarMonitoringView).
  const initialValues: Record<string, FieldValue> = {};
  for (const k of [...monitoringKeys, ...OVERVIEW_CROSSREF_KEYS, ...MONITORING_EXTRA_KEYS]) initialValues[k] = values.get(k) ?? rawValues.get(k) ?? null;
  const computedKeys = new Set(dynamicFields.filter((f) => f.source === "computed").map((f) => f.key));
  const liveKeys = Object.keys(initialValues).filter((k) => !computedKeys.has(k));

  return (
    <SolarMonitoringView
      deviceId={device.id}
      devices={devices}
      initialValues={initialValues}
      liveKeys={liveKeys}
      categories={Object.fromEntries(byCategory)}
      inverterGroups={inverterGroups}
      batteryGroups={batteryGroups}
      inverterTemperatureRows={inverterTemperatureRows}
      batteryTemperatureRows={batteryTemperatureRows}
      enumOptions={Object.fromEntries(enumOptions)}
      sync={lastSync}
    />
  );
}

// Keys the solar view reads directly (headline cards) that are not necessarily Monitoring-section fields.
const MONITORING_EXTRA_KEYS = [
  "grid_relay_status",
  "day_active_energy_kwh",
  "day_reactive_energy_kvarh",
  "inverter_l1_voltage_v",
  "inverter_l1_current_a",
  "inverter_output_frequency_hz",
  "inverter_output_power_w",
  "total_pv_energy_kwh",
  "day_battery_charge_energy_kwh",
  "day_battery_discharge_energy_kwh",
  "load_l1_power_w",
  "load_l2_power_w",
  "load_frequency_hz",
  "grid_l1_voltage_v",
  "grid_l1_current_a",
  "grid_frequency_hz",
  "generator_power_w",
  "generator_voltage_v",
  "generator_frequency_hz",
];

async function EvChargerMonitoring({
  supabase,
  device,
  devices,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  devices: CustomerDevice[];
}) {
  const rawSections = await fetchDashboardFields(supabase, device, "Monitoring");
  const dynamicFields = rawSections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const monitoringKeys = dynamicFields.map((f) => f.key);
  const enumRefs = Array.from(new Set(dynamicFields.map((f) => f.enumRef).filter((r): r is string => r !== null)));

  // connector_temperature_c and current_import_l1_a are each shown
  // exclusively via a purpose-built chart below (the Temperature Today
  // heatmap, ChargerTrendGroup's own Current series — same reasoning as the
  // solar branch's Inverter > Temperature group) — dropped from their
  // category's generic field list so neither also renders a second time as
  // a plain stat row.
  const connectorTemperatureRows = temperatureRowsFor(dynamicFields);
  const chartedElsewhereKeys = new Set(["current_import_l1_a"]);
  const sections = rawSections.map((s) => ({
    ...s,
    groups: s.groups
      .map((g) => ({ ...g, fields: g.fields.filter((f) => !(f.key in TEMPERATURE_MAX_C) && !chartedElsewhereKeys.has(f.key)) }))
      .filter((g) => g.fields.length > 0),
  }));
  const currentL1Field = dynamicFields.find((f) => f.key === "current_import_l1_a");

  // "Live Session" is its own dashboard_section (Authorization/Billing/
  // Session/Vehicle (EV) — DC, 26 fields) — brand new, no existing screen
  // rendered it before. Its natural home is this same tab's own
  // "Charging Session" panel, right alongside ChargingSessionsCarousel,
  // rather than a whole new nav destination for one EV-only section.
  const liveSessionSections = await fetchDashboardFields(supabase, device, "Live Session");
  const liveSessionFields = liveSessionSections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const liveSessionKeys = liveSessionFields.map((f) => f.key);

  // What's happening right now (Session) leads; who/how it was authorized
  // and what it's costing trail — same "most urgent/actionable first"
  // ordering as the Hub tab's own category priority, just for the receipt
  // card's own sections instead of a row of group cards.
  const liveSessionByCategory = new Map(liveSessionSections.map((s) => [s.category, s.groups.flatMap((g) => g.fields)]));
  const LIVE_SESSION_CATEGORY_PRIORITY = ["Session", "Vehicle (EV) — DC", "Authorization", "Billing"];
  const receiptSections: ReceiptSection[] = LIVE_SESSION_CATEGORY_PRIORITY.map((category) => ({
    title: category,
    fields: liveSessionByCategory.get(category) ?? [],
  })).filter((s) => s.fields.length > 0);
  for (const s of liveSessionSections) {
    if (!LIVE_SESSION_CATEGORY_PRIORITY.includes(s.category)) {
      receiptSections.push({ title: s.category, fields: s.groups.flatMap((g) => g.fields) });
    }
  }

  // connector_status/error_code are Overview-owned fields, reused here for
  // the same charger-hub status pill/fault banner the Overview page shows —
  // same cross-page reuse convention as the solar branch's
  // OVERVIEW_CROSSREF_KEYS above.
  const [{ data: snapshotReadings }, lastSync, chargingSummary, recentChargingStats, customerPlan, site, enumOptions] = await Promise.all([
    supabase
      .from("equipment_latest")
      .select("key_name, value, ts")
      .eq("equipment_id", device.id)
      .in("key_name", [...monitoringKeys, ...liveSessionKeys, "connector_status", "error_code"]),
    getLastSyncInfo(device.id),
    fetchTodayChargingSessions(supabase, device.id),
    fetchRecentChargingStats(supabase, device.id),
    getCustomerPlan(),
    getSelectedSite(),
    fetchEnumOptions(supabase, [...enumRefs, "connector_status", "error_code"]),
  ]);

  const latest = new Map<string, number | null>();
  for (const r of snapshotReadings ?? []) {
    if (!latest.has(r.key_name)) latest.set(r.key_name, r.value);
  }
  const getValue = (key: string): FieldValue => latest.get(key) ?? null;
  const status = getConnectorStatusLabel(getValue("connector_status") as number | null, enumOptions.get("connector_status") ?? []);
  const errorLabel = getErrorCodeLabel(getValue("error_code") as number | null, enumOptions.get("error_code") ?? []);

  const powerKw = getValue("power_active_import_kw") as number | null;
  const offeredKw = getValue("power_offered_kw") as number | null;

  const tariffRate = customerPlan?.tariffRatePerKwh ?? 8;
  const showCost = site?.propertyType !== "residential_independent_villas";

  const sessionsToday = chargingSummary.sessions.length;
  const energyTodayKwh = chargingSummary.sessions.reduce((sum, s) => sum + (s.energyKwh ?? 0), 0);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <DeviceSwitcher devices={devices} selectedId={device.id} />
          <p className="mt-1 text-sm text-theme-muted">Live readings for this charger, updated in real time.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill label={status.label} tone={status.tone} variant="text" />
          <LiveSyncedAgo lastTs={lastSync.lastTs} />
        </div>
      </div>

      {/* Two panels rather than one long scroll: the charger's own live
          detail (power/current/temperature/OCPP fields) versus its
          session history — different questions ("is it healthy right
          now?" vs. "what did it actually deliver?"), so they get their
          own tabs instead of being stacked on one page. */}
      <MonitoringTabs key={device.id} defaultValue="hub" headlines={{}} hasLiveData={lastSync.lastTs !== null}>
        <TabsList variant="line">
          <TabsTrigger value="hub" variant="line">
            <TabButtonContent icon={Plug} label="Charger Hub" />
          </TabsTrigger>
          <TabsTrigger value="sessions" variant="line">
            <TabButtonContent icon={History} label="Charging Session" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hub" className="space-y-4">
          {errorLabel ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Charger fault</AlertTitle>
              <AlertDescription>{errorLabel}</AlertDescription>
            </Alert>
          ) : null}

          <EvHubCards
            deviceId={device.id}
            initial={{ power_active_import_kw: powerKw, power_offered_kw: offeredKw }}
            sessionsToday={sessionsToday}
            energyTodayKwh={energyTodayKwh}
          />

          <ChargerTrendGroup
            deviceId={device.id}
            powerSeries={[
              {
                key: "power_active_import_kw",
                label: "Power",
                color: "var(--chart-1)",
                scale: 1,
                unit: "kW",
                footerMode: "sum",
                footerUnit: "kWh",
              },
              {
                key: "current_import_l1_a",
                label: currentL1Field?.label ?? "Current",
                color: "var(--chart-2)",
                scale: 1,
                unit: "A",
                footerMode: "average",
              },
            ]}
            sessionMarkers={chargingSummary.sessions.map((sess) => ({
              startedAt: sess.startedAt,
              endedAt: sess.endedAt,
              energyKwh: sess.energyKwh,
            }))}
            temperatureRows={connectorTemperatureRows}
          />

          <EvHubGroups
            deviceId={device.id}
            groups={sortSectionsByCategory(sections, EV_HUB_CATEGORY_PRIORITY)}
            initial={valuesFor(sections.flatMap((x) => x.groups.flatMap((g) => g.fields)), getValue)}
            enumOptions={enumToObject(enumOptions) ?? {}}
          />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <ChargingSessionsCarousel
            deviceId={device.id}
            sessions={chargingSummary.sessions}
            ratedPowerW={chargingSummary.ratedPowerW}
            currentPowerW={chargingSummary.currentPowerW}
            currentA={chargingSummary.currentA}
            voltageV={chargingSummary.voltageV}
            temperatureC={chargingSummary.temperatureC}
            connectorStatus={chargingSummary.connectorStatus}
            connectorStatusOptions={enumOptions.get("connector_status") ?? []}
            tariffRate={tariffRate}
            showCost={showCost}
            recentStats={recentChargingStats}
          />

          <SessionReceiptCard title="Charging Session Detail" sections={receiptSections} getValue={getValue} enumOptionsByRef={enumOptions} />
        </TabsContent>
      </MonitoringTabs>
    </>
  );
}
