import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import { fetchTodayEvEnergyKwh } from "@/lib/device-overview";
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
  Cpu,
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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveMetricChart, BarTrendChart, MainHubTrendGroup, BatteryTrendGroup } from "./lazy-charts";
import { PvStringComparison } from "./pv-string-comparison";
import { TemperatureGauge } from "./temperature-gauge";
import { MetricListCard } from "./metric-list-card";
import { LiveStatusCard } from "./live-status-card";
import { StatusPill } from "./status-pill";
import { DeviceStatusPill } from "./device-status-pill";
import { FaultBanner } from "./fault-banner";
import { DeviceParameterCards } from "./device-parameter-cards";
import { StatTile } from "./analytics-content";
import { MonitoringTabs } from "./monitoring-tabs";
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

/** A tab button's own content — just an icon and a label, nothing else.
 *  Deliberately minimal: a tab button that also tries to show a live
 *  number ends up sized and styled enough like a card that it gets
 *  mistaken for one of the stat cards under it (see TabHeadline below for
 *  where that number actually lives now). */
function TabButtonContent({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <>
      <Icon className="size-4 shrink-0" />
      <span className="text-sm font-medium">{label}</span>
    </>
  );
}

/** The selected tab's own headline — icon, label, and its one live
 *  number — shown once at the top of that tab's panel content instead of
 *  crammed into the tab button itself. Radix only mounts the active
 *  TabsContent, so this naturally shows only the selected tab's number
 *  with no client-side toggling needed, and it keeps the tab strip
 *  (MonitoringTabs' TabsList) a plain row of small buttons that can't be
 *  mistaken for a content card at any size. */
function TabHeadline({
  icon: Icon,
  iconClassName,
  label,
  statValue,
  statLabel,
}: {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  statValue: string;
  statLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", iconClassName)}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs font-medium text-theme-muted">{label}</p>
          <p className="text-2xl font-semibold text-theme-primary">{statValue}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-theme-muted">
        <span>{statLabel}</span>
        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live Active
        </span>
      </div>
    </div>
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
  const [{ data: snapshotReadings }, lastSync] = await Promise.all([
    supabase
      .from("device_readings")
      .select("instrument_key, value, ts")
      .eq("device_id", device.id)
      .in("instrument_key", SOLAR_SNAPSHOT_KEYS)
      .order("ts", { ascending: false })
      .limit(SOLAR_SNAPSHOT_KEYS.length * 5),
    getLastSyncInfo(device.id),
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

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <DeviceSwitcher devices={devices} selectedId={device.id} />
          <p className="mt-1 text-sm text-theme-muted">Live readings for this inverter, updated in real time.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <DeviceStatusPill inverterState={getValue("inverter_state")} activeFaultCode={getValue("active_fault_code")} variant="text" />
          <LiveSyncedAgo lastTs={lastSync.lastTs} />
        </div>
      </div>

      {/* Real tab panels — each node's content only exists in the DOM while
          its own tab is selected (Radix Tabs unmounts inactive
          TabsContent), rather than every section's charts/queries all
          living on one long scrolled page at once. */}
      <MonitoringTabs defaultValue="hub">
        <TabsList variant="card">
          <TabsTrigger value="hub" variant="card">
            <TabButtonContent icon={Cpu} label="Main Hub" />
          </TabsTrigger>
          <TabsTrigger value="solar" variant="card">
            <TabButtonContent icon={Sun} label="Solar Array" />
          </TabsTrigger>
          <TabsTrigger value="battery" variant="card">
            <TabButtonContent icon={BatteryCharging} label="Battery Pack" />
          </TabsTrigger>
          <TabsTrigger value="load" variant="card">
            <TabButtonContent icon={Home} label="Home Load" />
          </TabsTrigger>
          <TabsTrigger value="grid" variant="card">
            <TabButtonContent icon={Zap} label="Grid Interface" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hub" className="space-y-4">
          <TabHeadline icon={Cpu} iconClassName="bg-primary/15 text-primary" label="Main Hub" statValue={liveOutputKw} statLabel="Live Output" />
          <p className="text-sm text-theme-muted">The inverter itself — everything connected to it, consolidated.</p>
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
          <TabHeadline
            icon={Sun}
            iconClassName="bg-amber-500/15 text-amber-600 dark:text-amber-400"
            label="Solar Array"
            statValue={solarTodayText}
            statLabel="Power Generated"
          />
          <p className="text-sm text-theme-muted">Only what&apos;s happening at the panels.</p>

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
          <TabHeadline
            icon={BatteryCharging}
            iconClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            label="Battery Pack"
            statValue={socPctText}
            statLabel="Charge Level"
          />
          <p className="text-sm text-theme-muted">Only what&apos;s happening in storage.</p>
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
          <TabHeadline
            icon={Home}
            iconClassName="bg-sky-500/15 text-sky-600 dark:text-sky-400"
            label="Home Load"
            statValue={loadTodayText}
            statLabel="Consumed Today"
          />
          <p className="text-sm text-theme-muted">Only what&apos;s being drawn by the house.</p>

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
          <TabHeadline
            icon={Zap}
            iconClassName="bg-violet-500/15 text-violet-600 dark:text-violet-400"
            label="Grid Interface"
            statValue={gridImportedTodayText}
            statLabel="Imported Today"
          />
          <p className="text-sm text-theme-muted">Only what&apos;s crossing the meter.</p>
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
      </MonitoringTabs>
    </>
  );
}

const EV_SNAPSHOT_KEYS = [...EV_LIVE_FIELDS, ...EV_TOTAL_FIELDS].map((f) => f.key).concat(["connector_status", "error_code"]);

async function EvChargerMonitoring({
  supabase,
  device,
  devices,
}: {
  supabase: SupabaseServerClient;
  device: CustomerDevice;
  devices: CustomerDevice[];
}) {
  const [{ data: snapshotReadings }, lastSync, todayEnergyKwh] = await Promise.all([
    supabase
      .from("device_readings")
      .select("instrument_key, value, ts")
      .eq("device_id", device.id)
      .in("instrument_key", EV_SNAPSHOT_KEYS)
      .order("ts", { ascending: false })
      .limit(EV_SNAPSHOT_KEYS.length * 5),
    getLastSyncInfo(device.id),
    fetchTodayEvEnergyKwh(supabase, [device.id]),
  ]);

  const latest = new Map<string, number | null>();
  for (const r of snapshotReadings ?? []) {
    if (!latest.has(r.instrument_key)) latest.set(r.instrument_key, r.value);
  }
  const getValue = (key: string) => latest.get(key) ?? null;
  const status = getConnectorStatusLabel(getValue("connector_status"));
  const errorLabel = getErrorCodeLabel(getValue("error_code"));

  // Voltage/Power Offered as a snapshot list — Charging Power, Current, and
  // Connector Temperature each get their own chart/gauge elsewhere on this
  // page, so they're left out here rather than shown twice.
  const detailFields = [...EV_LIVE_FIELDS, ...EV_TOTAL_FIELDS].filter(
    (f) => f.key !== "power_active_import_w" && f.key !== "current_import_a" && f.key !== "temperature_c"
  );

  const powerW = getValue("power_active_import_w");
  const offeredW = getValue("power_offered_w");
  const utilizationPct =
    powerW !== null && offeredW !== null && offeredW > 0 ? Math.max(0, Math.min(100, (powerW / offeredW) * 100)) : null;

  // A charger has no PV/battery/grid/load sub-parts of its own to split
  // into separate tabs the way the inverter does — it's a single piece of
  // equipment, so everything connected to it lives in one consolidated
  // panel instead, no tab strip needed for just one panel.
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

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-theme-primary">Charger Hub</h2>
          <p className="text-sm text-theme-muted">The charger itself — everything connected to it, consolidated.</p>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Charging Power</CardTitle>
          </CardHeader>
          <CardContent>
            <LiveMetricChart deviceId={device.id} series={[{ key: "power_active_import_w", label: "Power", color: "var(--chart-1)" }]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current</CardTitle>
          </CardHeader>
          <CardContent>
            <LiveMetricChart deviceId={device.id} series={[{ key: "current_import_a", label: "Current", color: "var(--chart-2)" }]} />
          </CardContent>
        </Card>

        <MetricListCard title="Charger Detail" fields={detailFields} getValue={getValue} />

        <Card>
          <CardContent className="pt-6">
            <TemperatureGauge label="Connector Temperature" valueC={getValue("temperature_c")} warnAboveC={EV_CONNECTOR_TEMP_WARN_C} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Energy delivered today" value={todayEnergyKwh !== null ? `${todayEnergyKwh.toFixed(1)} kWh` : "—"} />
          <StatTile label="Power utilization" value={utilizationPct !== null ? `${utilizationPct.toFixed(0)}%` : "—"} />
        </div>
      </div>
    </>
  );
}
