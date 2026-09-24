import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, type CustomerDevice } from "@/lib/selected-site";
import { getCustomerPlan } from "@/lib/customer-plan";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import { fetchReadKeys, fetchEnumOptions } from "@/lib/instrument-catalog-data";
import { fetchTodayChargingSessions, fetchRecentChargingStats } from "@/lib/device-overview";
import { getLastSyncInfo } from "@/lib/device-sync";
import { co2AvoidedKg, treesEquivalent } from "@/lib/environmental-impact";
import {
  getConnectorStatusLabel,
  getErrorCodeLabel,
  EV_LIVE_FIELDS,
  EV_TOTAL_FIELDS,
  EV_CONNECTOR_TEMP_WARN_C,
} from "@/lib/ev-charger-catalog";
import {
  TEMPERATURE_FIELDS,
  BATTERY_DETAIL_FIELDS,
  BATTERY_HEALTH_FIELDS,
  INVERTER_DETAIL_FIELDS,
  GRID_DETAIL_FIELDS,
  LOAD_DETAIL_FIELDS,
  TODAY_ENERGY_FIELDS,
} from "@/lib/telemetry-catalog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  TriangleAlert,
  Server,
  Sun,
  BatteryCharging,
  Home,
  Zap,
  Activity,
  Percent,
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
import { cn } from "@/lib/utils";
import { BarTrendChart, MainHubTrendGroup, BatteryTrendGroup, ChargerTrendGroup } from "./lazy-charts";
import { PvStringComparison } from "./pv-string-comparison";
import { TemperatureGauge } from "./temperature-gauge";
import { MetricListCard } from "./metric-list-card";
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

const SOLAR_SNAPSHOT_KEYS = [
  ...TEMPERATURE_FIELDS.map((f) => f.key),
  ...BATTERY_DETAIL_FIELDS.map((f) => f.key),
  ...BATTERY_HEALTH_FIELDS.map((f) => f.key),
  ...INVERTER_DETAIL_FIELDS.map((f) => f.key),
  ...GRID_DETAIL_FIELDS.map((f) => f.key),
  ...LOAD_DETAIL_FIELDS.map((f) => f.key),
  ...TODAY_ENERGY_FIELDS.map((f) => f.key),
  "pv1_voltage_v",
  "pv1_current_a",
  "pv1_power_w",
  "pv2_voltage_v",
  "pv2_current_a",
  "pv2_power_w",
  "grid_connected",
  "inverter_state",
  "active_fault_code",
  "total_pv_energy_kwh",
  "inverter_power_w",
  "battery_soc_pct",
  "battery_power_w",
  "grid_power_w",
  "load_power_w",
];

// This device's own generator readings — kept separate from
// SOLAR_SNAPSHOT_KEYS rather than folded in, since these are only ever
// fetched when device_feature_flags says this specific install actually
// has a generator connected (not every site does).
const GENERATOR_KEYS = ["gen_power_w", "gen_voltage_v", "gen_frequency_hz"];

// No warnAboveC is defined for environment_temp_c anywhere else in the app
// (it's an ambient reading, not a component with a manufacturer-stated
// safe ceiling) — 45°C is just a reasonable "hot day outdoors" reference
// point for this heatmap's own color scale, not a real alarm threshold.
const TEMPERATURE_HEATMAP_ROWS = [
  { key: "inverter_dc_temp_c", label: "DC Transformer", maxC: 75 },
  { key: "inverter_ac_temp_c", label: "Radiator", maxC: 85 },
  { key: "environment_temp_c", label: "Ambient", maxC: 45 },
];

// Voltage/Current/Frequency moved up into Grid Interface's own "Electrical"
// card, matching Main Hub's — this keeps the fields without a card home.
const GRID_DETAIL_REMAINING_FIELDS = GRID_DETAIL_FIELDS.filter(
  (f) => f.key !== "grid_voltage_v" && f.key !== "grid_current_a" && f.key !== "grid_frequency_hz"
);

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

async function SolarInverterMonitoring({
  supabase,
  device,
  devices,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  devices: CustomerDevice[];
}) {
  // readKeys is this device's own stock model + device_feature_flags —
  // both "is generator connected at all" (tab visibility) and "which
  // candidate keys actually exist for this device" (the fetch itself) are
  // derived from it, so a disabled category's registers are never fetched,
  // not just hidden after the fact. Same pattern already proven for
  // EvChargerMonitoring, now safe here too since the key vocabulary
  // mismatch between the Excel seed and the live simulator (grid_power_w
  // vs grid_total_power_w, etc.) has been reconciled.
  const readKeys = await fetchReadKeys(supabase, device);
  const generatorEnabled = GENERATOR_KEYS.some((k) => readKeys.has(k));
  // active_fault_code is deliberately excluded from readKeys' filter — it
  // has no instrument_catalog row at all (deye-fault-codes.ts's own
  // docstring: this app's fault model doesn't match the real register
  // structure yet), but FaultBanner and DeviceStatusPill's fault-override
  // both depend on it being fetched regardless. Everything else genuinely
  // needs a real register mapping to be worth fetching.
  const snapshotKeys = [...SOLAR_SNAPSHOT_KEYS, ...GENERATOR_KEYS].filter((k) => readKeys.has(k) || k === "active_fault_code");

  const [{ data: snapshotReadings }, lastSync, inverterStateOptions] = await Promise.all([
    supabase
      .from("device_readings")
      .select("instrument_key, value, ts")
      .eq("device_id", device.id)
      .in("instrument_key", snapshotKeys)
      .order("ts", { ascending: false })
      .limit(snapshotKeys.length * 5),
    getLastSyncInfo(device.id),
    fetchEnumOptions(supabase, ["inverter_state"]).then((m) => m.get("inverter_state") ?? []),
  ]);

  const latest = new Map<string, number | null>();
  for (const r of snapshotReadings ?? []) {
    if (!latest.has(r.instrument_key)) latest.set(r.instrument_key, r.value);
  }
  const getValue = (key: string) => latest.get(key) ?? null;
  const gridConnected = getValue("grid_connected");

  const solarToday = getValue("solar_energy_today_kwh");
  const gridSellToday = getValue("grid_sell_energy_today_kwh");
  const selfConsumptionPct =
    solarToday !== null && solarToday > 0
      ? Math.max(0, Math.min(100, ((solarToday - (gridSellToday ?? 0)) / solarToday) * 100))
      : null;
  const selfConsumptionText = selfConsumptionPct !== null ? `${selfConsumptionPct.toFixed(0)}%` : "—";
  const selfConsumptionTone =
    selfConsumptionPct === null ? "neutral" : selfConsumptionPct >= 70 ? "good" : selfConsumptionPct >= 40 ? "neutral" : "warn";
  const selfConsumptionBadge =
    selfConsumptionPct === null ? "—" : selfConsumptionPct >= 70 ? "Good" : selfConsumptionPct >= 40 ? "Moderate" : "Low";

  const activeEnergyKwh = getValue("day_active_energy_kwh");
  const reactiveEnergyKvarh = getValue("day_reactive_energy_kvarh");
  const activeEnergyText = activeEnergyKwh !== null ? `${activeEnergyKwh.toFixed(1)} kWh` : "—";
  const reactiveEnergyText = reactiveEnergyKvarh !== null ? `${reactiveEnergyKvarh.toFixed(1)} kVarh` : "—";

  const voltageV = getValue("inverter_voltage_v");
  const currentA = getValue("inverter_current_a");
  const frequencyHz = getValue("inverter_frequency_hz");
  const voltageText = voltageV !== null ? `${voltageV.toFixed(1)} V` : "—";
  const currentText = currentA !== null ? `${currentA.toFixed(2)} A` : "—";
  const frequencyText = frequencyHz !== null ? `${frequencyHz.toFixed(2)} Hz` : "—";

  const lifetimePvKwh = getValue("total_pv_energy_kwh");
  const co2Kg = lifetimePvKwh !== null ? co2AvoidedKg(lifetimePvKwh) : null;
  const trees = co2Kg !== null ? treesEquivalent(co2Kg) : null;

  // One headline figure per tab — shown only on the active card (see
  // TabsTrigger's `card` variant, which reveals this block via
  // group-data-[state=active]) so switching tabs surfaces that node's own
  // live number at a glance, the same way the reference dashboard's
  // expanded tab does.
  const liveOutputKw = (() => {
    const v = getValue("inverter_power_w");
    return v !== null ? `${(v / 1000).toFixed(2)} kW` : "—";
  })();
  const socPctText = (() => {
    const v = getValue("battery_soc_pct");
    return v !== null ? `${Math.round(v)}%` : "—";
  })();
  const loadTodayText = (() => {
    const v = getValue("load_energy_today_kwh");
    return v !== null ? `${v.toFixed(1)} kWh` : "—";
  })();
  const gridImportedTodayText = (() => {
    const v = getValue("grid_buy_energy_today_kwh");
    return v !== null ? `${v.toFixed(1)} kWh` : "—";
  })();
  const solarTodayText = solarToday !== null ? `${solarToday.toFixed(1)} kWh` : "—";
  const co2Text = co2Kg !== null ? `${co2Kg.toFixed(0)} kg` : "—";
  const treesText = trees !== null ? `${trees.toFixed(1)}/yr` : "—";

  // Battery Pack's own 4 cards — live charge/discharge power plus today's
  // two energy totals.
  const batteryPowerW = getValue("battery_power_w");
  const batteryPowerText = batteryPowerW !== null ? `${(Math.abs(batteryPowerW) / 1000).toFixed(2)} kW` : "—";
  const batteryDirection = batteryPowerW === null || batteryPowerW === 0 ? "Idle" : batteryPowerW > 0 ? "Charging" : "Discharging";
  const batteryDirectionTone = batteryPowerW !== null && batteryPowerW > 0 ? "good" : "neutral";
  const dayBatteryChargeText = (() => {
    const v = getValue("day_battery_charge_kwh");
    return v !== null ? `${v.toFixed(1)} kWh` : "—";
  })();
  const dayBatteryDischargeText = (() => {
    const v = getValue("day_battery_discharge_kwh");
    return v !== null ? `${v.toFixed(1)} kWh` : "—";
  })();

  // Home Load's own 4 cards — live draw plus the L1/L2 split (frequency
  // rides along in the L1 card's subtitle instead of its own card).
  const loadPowerW = getValue("load_power_w");
  const loadLiveText = loadPowerW !== null ? `${(loadPowerW / 1000).toFixed(2)} kW` : "—";
  const load1Text = (() => {
    const v = getValue("load_l1_power_w");
    return v !== null ? `${v.toFixed(0)} W` : "—";
  })();
  const load2Text = (() => {
    const v = getValue("load_l2_power_w");
    return v !== null ? `${v.toFixed(0)} W` : "—";
  })();
  const loadFrequencyText = (() => {
    const v = getValue("load_frequency_hz");
    return v !== null ? `${v.toFixed(2)} Hz` : "—";
  })();

  // Grid Interface's own 4 cards — live flow (signed, so it doubles as
  // import/export direction), today's two totals, and the same
  // Voltage/Current/Frequency "Electrical" pattern Main Hub uses.
  const gridPowerW = getValue("grid_power_w");
  const gridLiveText = gridPowerW !== null ? `${(Math.abs(gridPowerW) / 1000).toFixed(2)} kW` : "—";
  const gridDirection = gridPowerW === null || gridPowerW === 0 ? "Idle" : gridPowerW > 0 ? "Importing" : "Exporting";
  const gridDirectionTone = gridPowerW !== null && gridPowerW > 0 ? "warn" : gridPowerW !== null && gridPowerW < 0 ? "good" : "neutral";
  const gridExportedTodayText = (() => {
    const v = getValue("grid_sell_energy_today_kwh");
    return v !== null ? `${v.toFixed(1)} kWh` : "—";
  })();
  const gridVoltageV = getValue("grid_voltage_v");
  const gridVoltageText = gridVoltageV !== null ? `${gridVoltageV.toFixed(1)} V` : "—";
  const gridCurrentText = (() => {
    const v = getValue("grid_current_a");
    return v !== null ? `${v.toFixed(2)} A` : "—";
  })();
  const gridFrequencyText = (() => {
    const v = getValue("grid_frequency_hz");
    return v !== null ? `${v.toFixed(2)} Hz` : "—";
  })();

  // Generator tab — only ever populated (and only ever fetched, see
  // snapshotKeys above) when this specific install has one connected.
  const genPowerW = getValue("gen_power_w");
  const genLiveText = genPowerW !== null ? `${(genPowerW / 1000).toFixed(2)} kW` : "—";
  const genVoltageV = getValue("gen_voltage_v");
  const genVoltageText = genVoltageV !== null ? `${genVoltageV.toFixed(1)} V` : "—";
  const genFrequencyText = (() => {
    const v = getValue("gen_frequency_hz");
    return v !== null ? `${v.toFixed(2)} Hz` : "—";
  })();

  // One live number per tab, shown above the tab strip by MonitoringTabs
  // itself (keyed by the currently selected tab's value) rather than
  // repeated inside each tab button or each panel's own content.
  const tabHeadlines: Record<string, TabHeadlineInfo> = {
    hub: { value: liveOutputKw, label: "Live Output" },
    solar: { value: solarTodayText, label: "Power Generated" },
    battery: { value: socPctText, label: "Charge Level" },
    load: { value: loadTodayText, label: "Consumed Today" },
    grid: { value: gridImportedTodayText, label: "Imported Today" },
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
            inverterState={getValue("inverter_state")}
            activeFaultCode={getValue("active_fault_code")}
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
      <MonitoringTabs defaultValue="hub" headlines={tabHeadlines}>
        <TabsList variant="line">
          <TabsTrigger value="hub" variant="line" className="data-[state=active]:border-primary data-[state=active]:text-primary">
            <TabButtonContent icon={Server} label="Main Hub" />
          </TabsTrigger>
          <TabsTrigger
            value="solar"
            variant="line"
            className="data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400"
          >
            <TabButtonContent icon={Sun} label="Solar Array" />
          </TabsTrigger>
          <TabsTrigger
            value="battery"
            variant="line"
            className="data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400"
          >
            <TabButtonContent icon={BatteryCharging} label="Battery Pack" />
          </TabsTrigger>
          <TabsTrigger
            value="load"
            variant="line"
            className="data-[state=active]:border-sky-500 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400"
          >
            <TabButtonContent icon={Home} label="Home Load" />
          </TabsTrigger>
          <TabsTrigger
            value="grid"
            variant="line"
            className="data-[state=active]:border-violet-500 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400"
          >
            <TabButtonContent icon={Zap} label="Grid Interface" />
          </TabsTrigger>
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
          <FaultBanner faultCode={getValue("active_fault_code")} />

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
              icon={Percent}
              title="Self-Consumption"
              subtitle="Solar used on-site"
              value={selfConsumptionText}
              liveValue={selfConsumptionPct}
              statusLabel="Status"
              badgeLabel={selfConsumptionBadge}
              badgeTone={selfConsumptionTone}
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
          </div>

          <MainHubTrendGroup
            deviceId={device.id}
            powerSeries={[
              { key: "inverter_power_w", label: "Solar", color: "var(--chart-3)" },
              { key: "battery_power_w", label: "Battery", color: "var(--chart-1)" },
              { key: "grid_power_w", label: "Grid", color: "var(--chart-4)" },
              { key: "load_power_w", label: "Load", color: "var(--chart-2)" },
            ]}
            temperatureRows={TEMPERATURE_HEATMAP_ROWS}
          />

        </TabsContent>

        <TabsContent value="solar" className="space-y-4">

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <LiveStatusCard
              icon={Sun}
              title="Live Output"
              subtitle="Current power"
              value={liveOutputKw}
              liveValue={getValue("inverter_power_w")}
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
              badgeLabel="Lifetime"
              badgeTone="good"
              sparkline={[]}
            />
            <LiveStatusCard
              icon={TreePine}
              title="Trees Equivalent"
              subtitle="Same CO2 absorbed"
              value={treesText}
              liveValue={trees}
              statusLabel="Status"
              badgeLabel="Lifetime"
              badgeTone="good"
              sparkline={[]}
            />
          </div>

          <BarTrendChart
            deviceId={device.id}
            title="Solar Power"
            series={[{ key: "inverter_power_w", label: "Solar", color: "var(--chart-3)" }]}
          />

          <PvStringComparison getValue={getValue} />
        </TabsContent>

        <TabsContent value="battery" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <LiveStatusCard
              icon={BatteryCharging}
              title="Charge Level"
              subtitle="State of charge"
              value={socPctText}
              liveValue={getValue("battery_soc_pct")}
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
              liveValue={getValue("day_battery_charge_kwh")}
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
              liveValue={getValue("day_battery_discharge_kwh")}
              statusLabel="Status"
              badgeLabel="Today"
              badgeTone="neutral"
              sparkline={[]}
            />
          </div>

          <BatteryTrendGroup
            deviceId={device.id}
            socSeries={[{ key: "battery_soc_pct", label: "SOC", color: "var(--chart-1)" }]}
            temperatureRows={[{ key: "battery_temp_c", label: "Battery", maxC: 45 }]}
          />
          <MetricListCard title="Battery Detail" fields={BATTERY_DETAIL_FIELDS} getValue={getValue} />
        </TabsContent>

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
              liveValue={getValue("load_energy_today_kwh")}
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
              liveValue={getValue("load_l1_power_w")}
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
              liveValue={getValue("load_l2_power_w")}
              statusLabel="Status"
              badgeLabel="Live"
              badgeTone="neutral"
              sparkline={[]}
            />
          </div>

          <BarTrendChart deviceId={device.id} title="Load Power" series={[{ key: "load_power_w", label: "Load", color: "var(--chart-2)" }]} />
        </TabsContent>

        <TabsContent value="grid" className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={gridConnected === 1 ? "default" : gridConnected === 0 ? "alert" : "secondary"}>
              Grid {gridConnected === 1 ? "Connected" : gridConnected === 0 ? "Disconnected" : "Unknown"}
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
              liveValue={getValue("grid_buy_energy_today_kwh")}
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
              liveValue={getValue("grid_sell_energy_today_kwh")}
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

          <BarTrendChart deviceId={device.id} title="Grid Power" series={[{ key: "grid_power_w", label: "Grid", color: "var(--chart-4)" }]} />
          <MetricListCard title="Grid Detail" fields={GRID_DETAIL_REMAINING_FIELDS} getValue={getValue} />
        </TabsContent>

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
                liveValue={getValue("gen_frequency_hz")}
                statusLabel="Status"
                badgeLabel="Live"
                badgeTone="neutral"
                sparkline={[]}
              />
            </div>

            <BarTrendChart deviceId={device.id} title="Generator Power" series={[{ key: "gen_power_w", label: "Generator", color: "var(--chart-5)" }]} />
          </TabsContent>
        )}
      </MonitoringTabs>
    </>
  );
}

// The full presentation universe — filtered per device below against
// what this device's own stock model + device_feature_flags actually
// confirm exist (fetchReadKeys), so a future charger model missing a
// register (e.g. no temperature sensor) doesn't query for it and show a
// permanently-blank card.
const EV_CANDIDATE_KEYS = [...EV_LIVE_FIELDS, ...EV_TOTAL_FIELDS].map((f) => f.key).concat(["connector_status", "error_code"]);

async function EvChargerMonitoring({
  supabase,
  device,
  devices,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  devices: CustomerDevice[];
}) {
  const readKeys = await fetchReadKeys(supabase, device);
  const snapshotKeys = EV_CANDIDATE_KEYS.filter((k) => readKeys.has(k));

  const [{ data: snapshotReadings }, lastSync, chargingSummary, recentChargingStats, customerPlan, site, enumOptions] =
    await Promise.all([
      supabase
        .from("device_readings")
        .select("instrument_key, value, ts")
        .eq("device_id", device.id)
        .in("instrument_key", snapshotKeys)
        .order("ts", { ascending: false })
        .limit(snapshotKeys.length * 5),
      getLastSyncInfo(device.id),
      fetchTodayChargingSessions(supabase, device.id),
      fetchRecentChargingStats(supabase, device.id),
      getCustomerPlan(),
      getSelectedSite(),
      fetchEnumOptions(supabase, ["connector_status", "error_code"]),
    ]);

  const latest = new Map<string, number | null>();
  for (const r of snapshotReadings ?? []) {
    if (!latest.has(r.instrument_key)) latest.set(r.instrument_key, r.value);
  }
  const getValue = (key: string) => latest.get(key) ?? null;
  const status = getConnectorStatusLabel(getValue("connector_status"), enumOptions.get("connector_status") ?? []);
  const errorLabel = getErrorCodeLabel(getValue("error_code"), enumOptions.get("error_code") ?? []);

  const powerW = getValue("power_active_import_w");
  const offeredW = getValue("power_offered_w");
  const utilizationPct =
    powerW !== null && offeredW !== null && offeredW > 0 ? Math.max(0, Math.min(100, (powerW / offeredW) * 100)) : null;

  const tariffRate = customerPlan?.tariffRatePerKwh ?? 8;
  const showCost = site?.propertyType !== "residential_independent_villas";

  const sessionsToday = chargingSummary.sessions.length;
  const energyTodayKwh = chargingSummary.sessions.reduce((sum, s) => sum + (s.energyKwh ?? 0), 0);
  const offeredKw = offeredW !== null ? offeredW / 1000 : null;

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
      <MonitoringTabs defaultValue="hub" headlines={{}}>
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
              badgeTone="good"
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
                key: "power_active_import_w",
                label: "Power",
                color: "var(--chart-1)",
                scale: 0.001,
                unit: "kW",
                footerMode: "sum",
                footerUnit: "kWh",
              },
              { key: "current_import_a", label: "Current", color: "var(--chart-2)", scale: 1, unit: "A", footerMode: "average" },
            ]}
            sessionMarkers={chargingSummary.sessions.map((sess) => ({
              startedAt: sess.startedAt,
              endedAt: sess.endedAt,
              energyKwh: sess.energyKwh,
            }))}
            temperatureRows={[{ key: "temperature_c", label: "Connector", maxC: EV_CONNECTOR_TEMP_WARN_C }]}
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
        </TabsContent>
      </MonitoringTabs>
    </>
  );
}
