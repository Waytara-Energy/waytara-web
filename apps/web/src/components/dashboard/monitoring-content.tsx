import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, type CustomerDevice } from "@/lib/selected-site";
import { getCustomerPlan } from "@/lib/customer-plan";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import { fetchEnumOptions } from "@/lib/instrument-catalog-data";
import { fetchTodayChargingSessions, fetchRecentChargingStats, deriveFaultCode, FAULT_BITMASK_KEYS } from "@/lib/device-overview";
import { getLastSyncInfo } from "@/lib/device-sync";
import { co2AvoidedKg, treesEquivalent } from "@/lib/environmental-impact";
import { getConnectorStatusLabel, getErrorCodeLabel } from "@/lib/ev-charger-catalog";
import {
  fetchDashboardFields,
  fetchFieldValues,
  resolveComputedValues,
  type FieldValue,
  type TemplateField,
  type FieldGroup,
  type CategorySection,
} from "@/lib/template-fields";
import { TEMPERATURE_MAX_C } from "@/lib/temperature-thresholds";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  TriangleAlert,
  Server,
  Sun,
  BatteryCharging,
  Home,
  Zap,
  Activity,
  Gauge,
  Leaf,
  TreePine,
  ArrowDownToLine,
  ArrowUpFromLine,
  Plug,
  History,
  Fuel,
  type LucideIcon,
} from "lucide-react";
import { BarTrendChart, MainHubTrendGroup, BatteryTrendGroup, ChargerTrendGroup } from "./lazy-charts";
import type { HeatmapRow } from "./temperature-heatmap";
import { DynamicFieldGroup } from "./dynamic-field-group";
import { groupByPhase } from "./phase-meter-card";
import { groupByIndex } from "./indexed-group-card";
import { LiveReadingsCard } from "./live-readings-card";
import { EnergyStatCard } from "./energy-stat-card";
import { SessionReceiptCard, type ReceiptSection } from "./session-receipt-card";
import type { EnumOption } from "@/lib/instrument-catalog-data";
import { LiveStatusCard } from "./live-status-card";
import { StatusPill } from "./status-pill";
import { DeviceStatusPill } from "./device-status-pill";
import { FaultBanner } from "./fault-banner";
import { DeviceParameterCards } from "./device-parameter-cards";
import { ChargingSessionsCarousel } from "./charging-sessions-carousel";
import { MonitoringTabs, type TabHeadlineInfo } from "./monitoring-tabs";
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

/** Builds a TemperatureHeatmap's `rows` from a CategorySection's own
 *  fetched fields instead of a hardcoded key/label pair — the label is
 *  always this device's real equipment_templates.display_name, never
 *  invented copy that can drift from (or just plain not match) what the
 *  field actually is. Only picks fields this lookup has a ceiling for, so
 *  a group with non-temperature fields mixed in (e.g. Battery > Live)
 *  can't accidentally feed something else into a °C color scale. */
function temperatureRowsFor(fields: TemplateField[]): HeatmapRow[] {
  return fields
    .filter((f) => f.key in TEMPERATURE_MAX_C)
    .map((f) => ({ key: f.key, label: f.label, maxC: TEMPERATURE_MAX_C[f.key] }));
}

/** A tab button's own content — icon + label at rest. The active tab
 *  drops its icon (`group-data-[state=active]:hidden`, keyed off the
 *  parent TabsTrigger's own Radix `data-state` via its `group` class) —
 *  that icon, in color, reappears in MonitoringTabs' headline above the
 *  strip instead (see TabHeadlineBar), alongside the live number a tab
 *  button never needs to hold itself. The label's own color comes from
 *  the parent trigger's per-tab active className, not from here. */
function TabButtonContent({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <>
      <Icon className="size-4 shrink-0 group-data-[state=active]:hidden" />
      <span className="text-sm font-medium">{label}</span>
    </>
  );
}

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

function groupTitle(category: string, groupName: string | null): string {
  return groupName ? `${category} — ${groupName}` : category;
}

// Within-tab ordering — the most urgent/actionable group first, the most
// reference-y one last (a lifetime energy total can wait; a fault status
// can't). Only categories whose natural DB order (alphabetical by
// group_name) doesn't already read that way need an entry here; a
// category with one group, or already in the right order, is left out.
const GROUP_PRIORITY: Record<string, string[]> = {
  Inverter: ["Status", "AC output", "Energy"],
  "Solar Array": ["Per input (MPPT)", "Energy"],
  Battery: ["Live", "Battery management system (BMS)", "Battery packs", "Energy"],
  Grid: ["Status", "Per phase", "Energy meter / CT"],
  Generator: ["Live", "Energy"],
};

function sortGroups<T extends { groupName: string | null }>(category: string, groups: T[]): T[] {
  const order = GROUP_PRIORITY[category];
  if (!order) return groups;
  return [...groups].sort((a, b) => {
    const ai = order.indexOf(a.groupName ?? "");
    const bi = order.indexOf(b.groupName ?? "");
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// Pure today/lifetime energy totals (Inverter/Solar Array/Battery/
// Generator Energy) get the KPI-tile treatment by name, since "every field
// is a kWh/h figure" is as much a *purpose* match as a shape one. Every
// other group picks its presentation by field shape: PhaseMeterCard or
// ComparisonStripCard when DynamicFieldGroup's own shape detection fires
// (per-phase electrical data, a repeating numbered item), LiveReadingsCard
// otherwise — the status-chip/meter/stat-tile catch-all for everything
// that's neither (a fault/connection status, a cluster of live readings,
// or both at once).
const ENERGY_GROUP_NAMES = new Set(["Energy"]);

function renderGroup(
  category: string,
  group: FieldGroup,
  getValue: (key: string) => FieldValue,
  enumOptionsByRef?: Map<string, EnumOption[]>
) {
  const title = groupTitle(category, group.groupName);
  const key = `${category}-${group.groupName ?? ""}`;

  if (group.groupName && ENERGY_GROUP_NAMES.has(group.groupName)) {
    return <EnergyStatCard key={key} title={title} fields={group.fields} getValue={getValue} />;
  }
  if (groupByPhase(group.fields) || (groupByIndex(group.fields)?.items.size ?? 0) > 1) {
    return <DynamicFieldGroup key={key} title={title} fields={group.fields} getValue={getValue} enumOptionsByRef={enumOptionsByRef} />;
  }
  return <LiveReadingsCard key={key} title={title} fields={group.fields} getValue={getValue} enumOptionsByRef={enumOptionsByRef} />;
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
  // sections is this device's own real, DB-driven Monitoring field list —
  // every group here is something this specific installation's own
  // equipment_metrics rows confirm exist, replacing the old readKeys-
  // filtered hardcoded telemetry-catalog.ts constants entirely. Tab
  // visibility is derived from category presence instead of a separate
  // key-list "does this tab have anything" check.
  const sections = await fetchDashboardFields(supabase, device, "Monitoring");
  const byCategory = new Map(sections.map((s) => [s.category, s.groups]));

  // The "Temperature" group's own fields are shown exclusively via the
  // Temperature Today heatmap below (a time-series view suits a sensor
  // reading far better than one more flat current-value row) — dropped
  // from the generic group list so they don't also render a second time
  // as plain stat rows right underneath it.
  const inverterGroups = (byCategory.get("Inverter") ?? []).filter((g) => g.groupName !== "Temperature");
  const inverterTemperatureRows = temperatureRowsFor(
    (byCategory.get("Inverter") ?? []).find((g) => g.groupName === "Temperature")?.fields ?? []
  );
  // Battery > Live carries battery_temperature_c alongside unrelated
  // fields (voltage, current, charge status...), so unlike Inverter >
  // Temperature this can't drop the whole group — just the one field the
  // heatmap below already shows.
  const batteryGroups = (byCategory.get("Battery") ?? []).map((g) =>
    g.groupName === "Live" ? { ...g, fields: g.fields.filter((f) => f.key !== "battery_temperature_c") } : g
  );
  const batteryTemperatureRows = temperatureRowsFor(
    (byCategory.get("Battery") ?? []).find((g) => g.groupName === "Live")?.fields ?? []
  );
  const solarEnabled = byCategory.has("Solar Array");
  const batteryEnabled = byCategory.has("Battery");
  const loadEnabled = byCategory.has("Home Load");
  const gridEnabled = byCategory.has("Grid");
  const generatorEnabled = byCategory.has("Generator");

  const dynamicFields = sections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const monitoringKeys = dynamicFields.map((f) => f.key);
  const enumRefs = Array.from(new Set(dynamicFields.map((f) => f.enumRef).filter((r): r is string => r !== null)));

  const [rawValues, lastSync, enumOptions] = await Promise.all([
    fetchFieldValues(supabase, device.id, [...monitoringKeys, ...OVERVIEW_CROSSREF_KEYS]),
    getLastSyncInfo(device.id),
    fetchEnumOptions(supabase, [...enumRefs, "inverter_state"]),
  ]);
  const values = resolveComputedValues(dynamicFields, rawValues, device);
  const inverterStateOptions = enumOptions.get("inverter_state") ?? [];

  const getValue = (key: string): FieldValue => values.get(key) ?? null;
  const getNum = (key: string): number | null => {
    const v = getValue(key);
    return typeof v === "number" ? v : null;
  };
  const activeFaultCode = deriveFaultCode(getNum);

  const gridConnected = getNum("grid_relay_status");

  const activeEnergyKwh = getNum("day_active_energy_kwh");
  const reactiveEnergyKvarh = getNum("day_reactive_energy_kvarh");
  const activeEnergyText = activeEnergyKwh !== null ? `${activeEnergyKwh.toFixed(1)} kWh` : "—";
  const reactiveEnergyText = reactiveEnergyKvarh !== null ? `${reactiveEnergyKvarh.toFixed(1)} kVarh` : "—";

  const voltageV = getNum("inverter_l1_voltage_v");
  const currentA = getNum("inverter_l1_current_a");
  const frequencyHz = getNum("inverter_output_frequency_hz");
  const voltageText = voltageV !== null ? `${voltageV.toFixed(1)} V` : "—";
  const currentText = currentA !== null ? `${currentA.toFixed(2)} A` : "—";
  const frequencyText = frequencyHz !== null ? `${frequencyHz.toFixed(2)} Hz` : "—";

  const lifetimePvKwh = getNum("total_pv_energy_kwh");
  const co2Kg = lifetimePvKwh !== null ? co2AvoidedKg(lifetimePvKwh) : null;
  const trees = co2Kg !== null ? treesEquivalent(co2Kg) : null;

  // One headline figure per tab — shown only on the active card (see
  // TabsTrigger's `card` variant, which reveals this block via
  // group-data-[state=active]) so switching tabs surfaces that node's own
  // live number at a glance, the same way the reference dashboard's
  // expanded tab does.
  const liveOutputKw = (() => {
    const v = getNum("inverter_output_power_w");
    return v !== null ? `${(v / 1000).toFixed(2)} kW` : "—";
  })();
  const socPctText = (() => {
    const v = getNum("battery_soc_pct");
    return v !== null ? `${Math.round(v)}%` : "—";
  })();
  const solarToday = getNum("day_pv_energy_kwh");
  const solarTodayText = solarToday !== null ? `${solarToday.toFixed(1)} kWh` : "—";
  const loadTodayText = (() => {
    const v = getNum("day_load_energy_kwh");
    return v !== null ? `${v.toFixed(1)} kWh` : "—";
  })();
  const gridImportedTodayText = (() => {
    const v = getNum("day_grid_import_energy_kwh");
    return v !== null ? `${v.toFixed(1)} kWh` : "—";
  })();
  const co2Text = co2Kg !== null ? `${co2Kg.toFixed(0)} kg` : "—";
  const treesText = trees !== null ? `${trees.toFixed(1)}/yr` : "—";

  // Battery Pack's own 4 cards — live charge/discharge power plus today's
  // two energy totals.
  const batteryPowerW = getNum("battery_power_w");
  const batteryPowerText = batteryPowerW !== null ? `${(Math.abs(batteryPowerW) / 1000).toFixed(2)} kW` : "—";
  const batteryDirection = batteryPowerW === null || batteryPowerW === 0 ? "Idle" : batteryPowerW > 0 ? "Charging" : "Discharging";
  const batteryDirectionTone = batteryPowerW !== null && batteryPowerW > 0 ? "good" : "neutral";
  const dayBatteryChargeText = (() => {
    const v = getNum("day_battery_charge_energy_kwh");
    return v !== null ? `${v.toFixed(1)} kWh` : "—";
  })();
  const dayBatteryDischargeText = (() => {
    const v = getNum("day_battery_discharge_energy_kwh");
    return v !== null ? `${v.toFixed(1)} kWh` : "—";
  })();

  // Home Load's own 4 cards — live draw plus the L1/L2 split (frequency
  // rides along in the L1 card's subtitle instead of its own card).
  const loadPowerW = getNum("load_total_power_w");
  const loadLiveText = loadPowerW !== null ? `${(loadPowerW / 1000).toFixed(2)} kW` : "—";
  const load1Text = (() => {
    const v = getNum("load_l1_power_w");
    return v !== null ? `${v.toFixed(0)} W` : "—";
  })();
  const load2Text = (() => {
    const v = getNum("load_l2_power_w");
    return v !== null ? `${v.toFixed(0)} W` : "—";
  })();
  const loadFrequencyText = (() => {
    const v = getNum("load_frequency_hz");
    return v !== null ? `${v.toFixed(2)} Hz` : "—";
  })();

  // Grid Interface's own 4 cards — live flow (signed, so it doubles as
  // import/export direction), today's two totals, and the same
  // Voltage/Current/Frequency "Electrical" pattern Main Hub uses.
  const gridPowerW = getNum("grid_total_power_w");
  const gridLiveText = gridPowerW !== null ? `${(Math.abs(gridPowerW) / 1000).toFixed(2)} kW` : "—";
  const gridDirection = gridPowerW === null || gridPowerW === 0 ? "Idle" : gridPowerW > 0 ? "Importing" : "Exporting";
  const gridDirectionTone = gridPowerW !== null && gridPowerW > 0 ? "warn" : gridPowerW !== null && gridPowerW < 0 ? "good" : "neutral";
  const gridExportedTodayText = (() => {
    const v = getNum("day_grid_export_energy_kwh");
    return v !== null ? `${v.toFixed(1)} kWh` : "—";
  })();
  const gridVoltageV = getNum("grid_l1_voltage_v");
  const gridVoltageText = gridVoltageV !== null ? `${gridVoltageV.toFixed(1)} V` : "—";
  const gridCurrentText = (() => {
    const v = getNum("grid_l1_current_a");
    return v !== null ? `${v.toFixed(2)} A` : "—";
  })();
  const gridFrequencyText = (() => {
    const v = getNum("grid_frequency_hz");
    return v !== null ? `${v.toFixed(2)} Hz` : "—";
  })();

  // Generator tab — only ever populated (and only ever fetched) when this
  // specific install has one connected (generatorEnabled).
  const genPowerW = getNum("generator_power_w");
  const genLiveText = genPowerW !== null ? `${(genPowerW / 1000).toFixed(2)} kW` : "—";
  const genVoltageV = getNum("generator_voltage_v");
  const genVoltageText = genVoltageV !== null ? `${genVoltageV.toFixed(1)} V` : "—";
  const genFrequencyText = (() => {
    const v = getNum("generator_frequency_hz");
    return v !== null ? `${v.toFixed(2)} Hz` : "—";
  })();

  // One live number per tab, shown above the tab strip by MonitoringTabs
  // itself (keyed by the currently selected tab's value) rather than
  // repeated inside each tab button or each panel's own content.
  const tabHeadlines: Record<string, TabHeadlineInfo> = {
    hub: { value: liveOutputKw, label: "Live Output" },
    ...(solarEnabled ? { solar: { value: solarTodayText, label: "Power Generated" } } : {}),
    ...(batteryEnabled ? { battery: { value: socPctText, label: "Charge Level" } } : {}),
    ...(loadEnabled ? { load: { value: loadTodayText, label: "Consumed Today" } } : {}),
    ...(gridEnabled ? { grid: { value: gridImportedTodayText, label: "Imported Today" } } : {}),
    ...(generatorEnabled ? { generator: { value: genLiveText, label: "Generator Output" } } : {}),
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <DeviceSwitcher devices={devices} selectedId={device.id} />
          <p className="mt-1 text-sm text-theme-muted">Live readings for this inverter, updated in real time.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <DeviceStatusPill
            inverterState={getNum("inverter_run_state")}
            activeFaultCode={activeFaultCode}
            inverterStateOptions={inverterStateOptions}
            variant="text"
          />
          <LiveSyncedAgo lastTs={lastSync.lastTs} />
        </div>
      </div>

      {/* Real tab panels — each node's content only exists in the DOM while
          its own tab is selected (Radix Tabs unmounts inactive
          TabsContent), rather than every section's charts/queries all
          living on one long scrolled page at once. */}
      {/* Keyed on the device so switching via DeviceSwitcher remounts this
          fresh (back to the "hub" tab) instead of React reusing the same
          instance's internal tab-selection state — without this, picking
          a device that doesn't share the previous one's node (e.g. no
          "battery" tab) left the panel on a tab that no longer had a
          trigger to select it. */}
      <MonitoringTabs key={device.id} defaultValue="hub" headlines={tabHeadlines} hasLiveData={lastSync.lastTs !== null}>
        <TabsList variant="line">
          <TabsTrigger value="hub" variant="line" className="data-[state=active]:border-primary data-[state=active]:text-primary">
            <TabButtonContent icon={Server} label="Main Hub" />
          </TabsTrigger>
          {solarEnabled && (
            <TabsTrigger
              value="solar"
              variant="line"
              className="data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400"
            >
              <TabButtonContent icon={Sun} label="Solar Array" />
            </TabsTrigger>
          )}
          {batteryEnabled && (
            <TabsTrigger
              value="battery"
              variant="line"
              className="data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400"
            >
              <TabButtonContent icon={BatteryCharging} label="Battery Pack" />
            </TabsTrigger>
          )}
          {loadEnabled && (
            <TabsTrigger
              value="load"
              variant="line"
              className="data-[state=active]:border-sky-500 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400"
            >
              <TabButtonContent icon={Home} label="Home Load" />
            </TabsTrigger>
          )}
          {gridEnabled && (
            <TabsTrigger
              value="grid"
              variant="line"
              className="data-[state=active]:border-violet-500 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400"
            >
              <TabButtonContent icon={Zap} label="Grid Interface" />
            </TabsTrigger>
          )}
          {generatorEnabled && (
            <TabsTrigger
              value="generator"
              variant="line"
              className="data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400"
            >
              <TabButtonContent icon={Fuel} label="Generator" />
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="hub" className="space-y-4">
          <FaultBanner faultCode={activeFaultCode} />

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <LiveStatusCard
              icon={Zap}
              title="Active Energy"
              subtitle="Real energy used"
              value={activeEnergyText}
              liveValue={activeEnergyKwh}
              statusLabel="Status"
              badgeLabel="Today"
              badgeTone="neutral"
              sparkline={[]}
            />
            <LiveStatusCard
              icon={Activity}
              title="Reactive Energy"
              subtitle="Non-working energy"
              value={reactiveEnergyText}
              liveValue={reactiveEnergyKvarh}
              statusLabel="Status"
              badgeLabel="Today"
              badgeTone="neutral"
              sparkline={[]}
            />
            <LiveStatusCard
              icon={Gauge}
              title="Electrical"
              subtitle={`Current · ${currentText}`}
              value={voltageText}
              liveValue={voltageV}
              statusLabel="Frequency"
              badgeLabel={frequencyText}
              badgeTone="neutral"
              sparkline={[]}
            />
            <LiveStatusCard
              icon={Sun}
              title="Live Output"
              subtitle="Current power"
              value={liveOutputKw}
              liveValue={getNum("inverter_output_power_w")}
              statusLabel="Status"
              badgeLabel="Live"
              badgeTone="neutral"
              sparkline={[]}
            />
          </div>

          <MainHubTrendGroup
            deviceId={device.id}
            powerSeries={[
              { key: "inverter_output_power_w", label: "Solar", color: "var(--chart-3)" },
              { key: "battery_power_w", label: "Battery", color: "var(--chart-1)" },
              { key: "grid_total_power_w", label: "Grid", color: "var(--chart-4)" },
              { key: "load_total_power_w", label: "Load", color: "var(--chart-2)" },
            ]}
            temperatureRows={inverterTemperatureRows}
          />

          {sortGroups("Inverter", inverterGroups).map((group) => renderGroup("Inverter", group, getValue, enumOptions))}
        </TabsContent>

        {solarEnabled && (
          <TabsContent value="solar" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <LiveStatusCard
                icon={Sun}
                title="Live Output"
                subtitle="Current power"
                value={liveOutputKw}
                liveValue={getNum("inverter_output_power_w")}
                statusLabel="Status"
                badgeLabel="Live"
                badgeTone="neutral"
                sparkline={[]}
              />
              <LiveStatusCard
                icon={Zap}
                title="Generated Today"
                subtitle="So far today"
                value={solarTodayText}
                liveValue={solarToday}
                statusLabel="Status"
                badgeLabel="Today"
                badgeTone="neutral"
                sparkline={[]}
              />
              <LiveStatusCard
                icon={Leaf}
                title="CO2 Avoided"
                subtitle="Lifetime estimate"
                value={co2Text}
                liveValue={co2Kg}
                statusLabel="Status"
                badgeLabel={co2Kg !== null ? "Lifetime" : "No data"}
                badgeTone={co2Kg !== null ? "good" : "neutral"}
                sparkline={[]}
              />
              <LiveStatusCard
                icon={TreePine}
                title="Trees Equivalent"
                subtitle="Same CO2 absorbed"
                value={treesText}
                liveValue={trees}
                statusLabel="Status"
                badgeLabel={trees !== null ? "Lifetime" : "No data"}
                badgeTone={trees !== null ? "good" : "neutral"}
                sparkline={[]}
              />
            </div>

            <BarTrendChart
              deviceId={device.id}
              title="Solar Power"
              series={[{ key: "inverter_output_power_w", label: "Solar", color: "var(--chart-3)" }]}
            />

            {sortGroups("Solar Array", byCategory.get("Solar Array") ?? []).map((group) =>
              renderGroup("Solar Array", group, getValue, enumOptions)
            )}
          </TabsContent>
        )}

        {batteryEnabled && (
          <TabsContent value="battery" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <LiveStatusCard
                icon={BatteryCharging}
                title="Charge Level"
                subtitle="State of charge"
                value={socPctText}
                liveValue={getNum("battery_soc_pct")}
                statusLabel="Status"
                badgeLabel="Live"
                badgeTone="neutral"
                sparkline={[]}
              />
              <LiveStatusCard
                icon={Zap}
                title="Battery Power"
                subtitle={batteryDirection}
                value={batteryPowerText}
                liveValue={batteryPowerW}
                statusLabel="Status"
                badgeLabel={batteryDirection}
                badgeTone={batteryDirectionTone}
                sparkline={[]}
              />
              <LiveStatusCard
                icon={ArrowDownToLine}
                title="Charged Today"
                subtitle="Into the battery"
                value={dayBatteryChargeText}
                liveValue={getNum("day_battery_charge_energy_kwh")}
                statusLabel="Status"
                badgeLabel="Today"
                badgeTone="neutral"
                sparkline={[]}
              />
              <LiveStatusCard
                icon={ArrowUpFromLine}
                title="Discharged Today"
                subtitle="Out of the battery"
                value={dayBatteryDischargeText}
                liveValue={getNum("day_battery_discharge_energy_kwh")}
                statusLabel="Status"
                badgeLabel="Today"
                badgeTone="neutral"
                sparkline={[]}
              />
            </div>

            <BatteryTrendGroup
              deviceId={device.id}
              socSeries={[{ key: "battery_soc_pct", label: "SOC", color: "var(--chart-1)" }]}
              temperatureRows={batteryTemperatureRows}
            />

            {sortGroups("Battery", batteryGroups).map((group) => renderGroup("Battery", group, getValue, enumOptions))}
          </TabsContent>
        )}

        {loadEnabled && (
          <TabsContent value="load" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <LiveStatusCard
                icon={Home}
                title="Live Draw"
                subtitle="Current draw"
                value={loadLiveText}
                liveValue={loadPowerW}
                statusLabel="Status"
                badgeLabel="Live"
                badgeTone="neutral"
                sparkline={[]}
              />
              <LiveStatusCard
                icon={Zap}
                title="Consumed Today"
                subtitle="So far today"
                value={loadTodayText}
                liveValue={getNum("day_load_energy_kwh")}
                statusLabel="Status"
                badgeLabel="Today"
                badgeTone="neutral"
                sparkline={[]}
              />
              <LiveStatusCard
                icon={Activity}
                title="L1 Power"
                subtitle={`Frequency · ${loadFrequencyText}`}
                value={load1Text}
                liveValue={getNum("load_l1_power_w")}
                statusLabel="Status"
                badgeLabel="Live"
                badgeTone="neutral"
                sparkline={[]}
              />
              <LiveStatusCard
                icon={Activity}
                title="L2 Power"
                subtitle="Live reading"
                value={load2Text}
                liveValue={getNum("load_l2_power_w")}
                statusLabel="Status"
                badgeLabel="Live"
                badgeTone="neutral"
                sparkline={[]}
              />
            </div>

            <BarTrendChart
              deviceId={device.id}
              title="Load Power"
              series={[{ key: "load_total_power_w", label: "Load", color: "var(--chart-2)" }]}
            />

            {(byCategory.get("Home Load") ?? []).map((group) => renderGroup("Home Load", group, getValue, enumOptions))}
          </TabsContent>
        )}

        {gridEnabled && (
          <TabsContent value="grid" className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={gridConnected === 1 ? "default" : gridConnected === 0 ? "alert" : "secondary"}>
                {gridConnected === 1 ? "Grid Connected" : gridConnected === 0 ? "Grid Disconnected" : "Grid status: No data"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <LiveStatusCard
                icon={Zap}
                title="Live Flow"
                subtitle={gridDirection}
                value={gridLiveText}
                liveValue={gridPowerW}
                statusLabel="Status"
                badgeLabel={gridDirection}
                badgeTone={gridDirectionTone}
                sparkline={[]}
              />
              <LiveStatusCard
                icon={ArrowDownToLine}
                title="Imported Today"
                subtitle="From the grid"
                value={gridImportedTodayText}
                liveValue={getNum("day_grid_import_energy_kwh")}
                statusLabel="Status"
                badgeLabel="Today"
                badgeTone="neutral"
                sparkline={[]}
              />
              <LiveStatusCard
                icon={ArrowUpFromLine}
                title="Exported Today"
                subtitle="Back to the grid"
                value={gridExportedTodayText}
                liveValue={getNum("day_grid_export_energy_kwh")}
                statusLabel="Status"
                badgeLabel="Today"
                badgeTone="neutral"
                sparkline={[]}
              />
              <LiveStatusCard
                icon={Gauge}
                title="Electrical"
                subtitle={`Current · ${gridCurrentText}`}
                value={gridVoltageText}
                liveValue={gridVoltageV}
                statusLabel="Frequency"
                badgeLabel={gridFrequencyText}
                badgeTone="neutral"
                sparkline={[]}
              />
            </div>

            <BarTrendChart
              deviceId={device.id}
              title="Grid Power"
              series={[{ key: "grid_total_power_w", label: "Grid", color: "var(--chart-4)" }]}
            />

            {sortGroups("Grid", byCategory.get("Grid") ?? []).map((group) => renderGroup("Grid", group, getValue, enumOptions))}
          </TabsContent>
        )}

        {generatorEnabled && (
          <TabsContent value="generator" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <LiveStatusCard
                icon={Fuel}
                title="Live Output"
                subtitle="Generator power"
                value={genLiveText}
                liveValue={genPowerW}
                statusLabel="Status"
                badgeLabel={genPowerW && genPowerW > 0 ? "Running" : "Idle"}
                badgeTone={genPowerW && genPowerW > 0 ? "good" : "neutral"}
                sparkline={[]}
              />
              <LiveStatusCard
                icon={Gauge}
                title="Voltage"
                subtitle="Output voltage"
                value={genVoltageText}
                liveValue={genVoltageV}
                statusLabel="Frequency"
                badgeLabel={genFrequencyText}
                badgeTone="neutral"
                sparkline={[]}
              />
              <LiveStatusCard
                icon={Activity}
                title="Frequency"
                subtitle="Output frequency"
                value={genFrequencyText}
                liveValue={getNum("generator_frequency_hz")}
                statusLabel="Status"
                badgeLabel="Live"
                badgeTone="neutral"
                sparkline={[]}
              />
            </div>

            <BarTrendChart
              deviceId={device.id}
              title="Generator Power"
              series={[{ key: "generator_power_w", label: "Generator", color: "var(--chart-5)" }]}
            />

            {sortGroups("Generator", byCategory.get("Generator") ?? []).map((group) =>
              renderGroup("Generator", group, getValue, enumOptions)
            )}
          </TabsContent>
        )}
      </MonitoringTabs>
    </>
  );
}

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
  const utilizationPct = powerKw !== null && offeredKw !== null && offeredKw > 0 ? Math.max(0, Math.min(100, (powerKw / offeredKw) * 100)) : null;

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

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <LiveStatusCard
              icon={Zap}
              title="Power Offered"
              subtitle="Max charger output"
              value={offeredKw !== null ? `${offeredKw.toFixed(1)} kW` : "—"}
              liveValue={offeredKw}
              statusLabel="Status"
              badgeLabel="Live"
              badgeTone="neutral"
              sparkline={[]}
            />
            <LiveStatusCard
              icon={Plug}
              title="Sessions"
              subtitle="Started today"
              value={String(sessionsToday)}
              liveValue={sessionsToday}
              statusLabel="Status"
              badgeLabel="Today"
              badgeTone="neutral"
              sparkline={[]}
            />
            <LiveStatusCard
              icon={ArrowDownToLine}
              title="Energy Delivered"
              subtitle="Total today"
              value={`${energyTodayKwh.toFixed(1)} kWh`}
              liveValue={energyTodayKwh}
              statusLabel="Status"
              badgeLabel="Today"
              badgeTone={energyTodayKwh > 0 ? "good" : "neutral"}
              sparkline={[]}
            />
            <LiveStatusCard
              icon={Gauge}
              title="Power Utilization"
              subtitle="Of max output"
              value={utilizationPct !== null ? `${utilizationPct.toFixed(0)}%` : "—"}
              liveValue={utilizationPct}
              statusLabel="Status"
              badgeLabel="Live"
              badgeTone="neutral"
              sparkline={[]}
            />
          </div>

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

          {sortSectionsByCategory(sections, EV_HUB_CATEGORY_PRIORITY).map(({ category, group }) =>
            renderGroup(category, group, getValue, enumOptions)
          )}
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
