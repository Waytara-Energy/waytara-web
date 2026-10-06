"use client";

import * as React from "react";
import { Server, Sun, BatteryCharging, Home, Zap, Activity, Gauge, Leaf, TreePine, ArrowDownToLine, ArrowUpFromLine, Fuel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { CustomerDevice } from "@/lib/device-display";
import type { EnumOption } from "@/lib/enum-labels";
import { co2AvoidedKg, treesEquivalent } from "@/lib/environmental-impact";
import { FAULT_BITMASK_KEYS } from "@/lib/overview-keys";
import type { FieldValue } from "@/lib/template-field-format";
import type { FieldGroup } from "@/lib/template-fields";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { BarTrendChart, MainHubTrendGroup, BatteryTrendGroup } from "./lazy-charts";
import type { HeatmapRow } from "./temperature-heatmap";
import { LiveStatusCard } from "./live-status-card";
import { DeviceStatusPill } from "./device-status-pill";
import { FaultBanner } from "./fault-banner";
import { MonitoringTabs, type TabHeadlineInfo } from "./monitoring-tabs";
import { LiveSyncedAgo } from "./live-synced-ago";
import { DeviceSwitcher } from "./device-switcher";
import { TabButtonContent, renderGroup, sortGroups } from "./monitoring-shared";
import { useLiveLastSync } from "./use-live-last-sync";
import { RangeProvider } from "./range-context";
import { RangeBar } from "./range-bar";
import { GoLiveButton, GoLiveProvider } from "./go-live";

/** The first non-zero fault/alarm bitmask, passed on as the fault code (see deriveFaultCode in device-overview). */
function faultCodeFrom(get: (key: string) => number | null): number | null {
  for (const key of FAULT_BITMASK_KEYS) {
    const v = get(key);
    if (v) return v;
  }
  return null;
}

export interface SolarMonitoringProps {
  deviceId: string;
  devices: CustomerDevice[];
  /** What the server rendered, for every key on this screen. */
  initialValues: Record<string, FieldValue>;
  /** The keys that follow the device live. */
  liveKeys: string[];
  /** Monitoring field groups by category (Inverter, Solar Array, Battery, Home Load, Grid, Generator). */
  categories: Record<string, FieldGroup[]>;
  inverterGroups: FieldGroup[];
  batteryGroups: FieldGroup[];
  inverterTemperatureRows: HeatmapRow[];
  batteryTemperatureRows: HeatmapRow[];
  enumOptions: Record<string, EnumOption[]>;
  lastSyncTs: string | null;
  /** How often the device agent says it uploads, in seconds (null if it has not said). */
  heartbeatIntervalS: number | null;
}

/** The solar inverter's Monitoring screen. Every number follows the device's live channel in place - there is no
 *  page refresh and no refetch; the server only supplies the first values. Battery power is positive = discharging. */
export function SolarMonitoringView({
  deviceId,
  devices,
  initialValues,
  liveKeys,
  categories,
  inverterGroups,
  batteryGroups,
  inverterTemperatureRows,
  batteryTemperatureRows,
  enumOptions: enumOptionsObj,
  lastSyncTs,
  heartbeatIntervalS,
}: SolarMonitoringProps) {
  const enumOptions = React.useMemo(() => new Map(Object.entries(enumOptionsObj)), [enumOptionsObj]);
  const solarEnabled = "Solar Array" in categories;
  const batteryEnabled = "Battery" in categories;
  const loadEnabled = "Home Load" in categories;
  const gridEnabled = "Grid" in categories;
  const generatorEnabled = "Generator" in categories;

  const inverterStateOptions = enumOptions.get("inverter_state") ?? [];

  // Every number on this screen is the device's live value once one arrives, the server's value until then.
  const initialNumbers = React.useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const k of liveKeys) out[k] = typeof initialValues[k] === "number" ? (initialValues[k] as number) : null;
    return out;
  }, [liveKeys, initialValues]);
  const live = useLiveNumbers([deviceId], liveKeys, initialNumbers, () => "first");
  const getValue = (key: string): FieldValue => {
    const v = live[key];
    return v !== undefined && v !== null ? v : (initialValues[key] ?? null);
  };
  const getNum = (key: string): number | null => {
    const v = getValue(key);
    return typeof v === "number" ? v : null;
  };
  const activeFaultCode = faultCodeFrom(getNum);
  const sync = useLiveLastSync(deviceId, lastSyncTs);
  // The agent counts as online while its heartbeat is newer than three upload intervals (at least 90 s).
  const [clock, setClock] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const agentOnline = sync !== null && clock - new Date(sync).getTime() < Math.max(90_000, 3 * (heartbeatIntervalS ?? 60) * 1000);

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
  const batteryDirection = batteryPowerW === null || batteryPowerW === 0 ? "Idle" : batteryPowerW < 0 ? "Charging" : "Discharging";
  const batteryDirectionTone = batteryPowerW !== null && batteryPowerW < 0 ? "good" : "neutral";
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
    <RangeProvider deviceId={deviceId}>
      <GoLiveProvider deviceId={deviceId} agentOnline={agentOnline}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <DeviceSwitcher devices={devices} selectedId={deviceId} />
          <p className="mt-1 text-sm text-theme-muted">Live readings for this inverter, updated in real time.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <DeviceStatusPill
            inverterState={getNum("inverter_run_state")}
            activeFaultCode={activeFaultCode}
            inverterStateOptions={inverterStateOptions}
            variant="text"
          />
          <LiveSyncedAgo lastTs={sync} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeBar />
        <GoLiveButton />
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
      <MonitoringTabs key={deviceId} defaultValue="hub" headlines={tabHeadlines} hasLiveData={sync !== null}>
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
            deviceId={deviceId}
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
              deviceId={deviceId}
              title="Solar Power"
              series={[{ key: "inverter_output_power_w", label: "Solar", color: "var(--chart-3)" }]}
            />

            {sortGroups("Solar Array", categories["Solar Array"] ?? []).map((group) =>
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
              deviceId={deviceId}
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
              deviceId={deviceId}
              title="Load Power"
              series={[{ key: "load_total_power_w", label: "Load", color: "var(--chart-2)" }]}
            />

            {(categories["Home Load"] ?? []).map((group) => renderGroup("Home Load", group, getValue, enumOptions))}
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
              deviceId={deviceId}
              title="Grid Power"
              series={[{ key: "grid_total_power_w", label: "Grid", color: "var(--chart-4)" }]}
            />

            {sortGroups("Grid", categories["Grid"] ?? []).map((group) => renderGroup("Grid", group, getValue, enumOptions))}
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
              deviceId={deviceId}
              title="Generator Power"
              series={[{ key: "generator_power_w", label: "Generator", color: "var(--chart-5)" }]}
            />

            {sortGroups("Generator", categories["Generator"] ?? []).map((group) =>
              renderGroup("Generator", group, getValue, enumOptions)
            )}
          </TabsContent>
        )}
      </MonitoringTabs>
      </GoLiveProvider>
    </RangeProvider>
  );
}
