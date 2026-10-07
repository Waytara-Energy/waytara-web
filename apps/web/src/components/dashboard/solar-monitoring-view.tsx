"use client";

import * as React from "react";
import { Server, Sun, Thermometer, BatteryCharging, Home, Zap, Activity, Gauge, ArrowDownToLine, ArrowUpFromLine, Fuel } from "lucide-react";
import { TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { CustomerDevice } from "@/lib/device-display";
import type { EnumOption } from "@/lib/enum-labels";
import { FAULT_BITMASK_KEYS } from "@/lib/overview-keys";
import { TEMPERATURE_MAX_C } from "@/lib/temperature-thresholds";
import type { FieldValue } from "@/lib/template-field-format";
import type { FieldGroup } from "@/lib/template-fields";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { BarTrendChart, MainHubTrendGroup, SolarTrendGroup } from "./lazy-charts";
import type { HeatmapRow } from "./temperature-heatmap";
import { LiveStatusCard } from "./live-status-card";
import { DeviceStatusPill } from "./device-status-pill";
import { FaultBanner } from "./fault-banner";
import { MonitoringTabs, type TabHeadlineInfo } from "./monitoring-tabs";
import { LiveSyncedAgo } from "./live-synced-ago";
import { DeviceSwitcher } from "./device-switcher";
import { TabButtonContent, renderGroup, sortGroups } from "./monitoring-shared";
import { useDeviceState } from "./use-device-state";
import { pvPowerKeys, solarGenerationW } from "@/lib/solar-generation";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
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
  enumOptions: Record<string, EnumOption[]>;
  /** What the server knows about the device's connection (last reading, agent heartbeat, upload interval). */
  sync: DeviceSyncInit;
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
  enumOptions: enumOptionsObj,
  sync,
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
  // Is the device really reporting? (The agent can be running while the device is switched off.)
  const { lastReadAt, offline } = useDeviceState(deviceId, sync);
  const agentOnline = !offline;

  const gridConnected = getNum("grid_relay_status");

  const activeEnergyKwh = getNum("day_active_energy_kwh");
  const activeEnergyText = activeEnergyKwh !== null ? `${activeEnergyKwh.toFixed(1)} kWh` : "—";

  const voltageV = getNum("inverter_l1_voltage_v");
  const currentA = getNum("inverter_l1_current_a");
  const frequencyHz = getNum("inverter_output_frequency_hz");
  const voltageText = voltageV !== null ? `${voltageV.toFixed(1)} V` : "—";
  const currentText = currentA !== null ? `${currentA.toFixed(2)} A` : "—";
  const frequencyText = frequencyHz !== null ? `${frequencyHz.toFixed(2)} Hz` : "—";

  // The hottest inverter sensor, against its own ceiling (the same one the temperature gauges use).
  let hottest: { label: string; c: number; maxC: number } | null = null;
  for (const row of inverterTemperatureRows) {
    const c = getNum(row.key);
    if (c !== null && (hottest === null || c / row.maxC > hottest.c / hottest.maxC)) hottest = { label: row.label, c, maxC: row.maxC };
  }
  const tempRatio = hottest ? hottest.c / hottest.maxC : 0;
  const tempBadge = !hottest ? "No data" : tempRatio >= 1 ? "Hot" : tempRatio >= 0.85 ? "Warm" : "Normal";

  // One headline figure per tab — shown only on the active card (see
  // TabsTrigger's `card` variant, which reveals this block via
  // group-data-[state=active]) so switching tabs surfaces that node's own
  // live number at a glance, the same way the reference dashboard's
  // expanded tab does.
  const liveOutputKw = (() => {
    const v = getNum("inverter_output_power_w");
    return v !== null ? `${(v / 1000).toFixed(2)} kW` : "—";
  })();
  // The Solar Array tab's live output is the solar generation itself: the device's PV inputs added together (the Main
  // Hub's own "Live Output" stays the inverter's AC output, which also carries battery discharge).
  const pvKeys = pvPowerKeys(liveKeys);
  const solarGenerationText = (() => {
    const v = solarGenerationW(Object.fromEntries(pvKeys.concat("inverter_output_power_w").map((k) => [k, getNum(k)])), pvKeys);
    return v !== null ? `${(v / 1000).toFixed(2)} kW` : "—";
  })();
  // One card per PV input the device really has: its power, with voltage and current alongside.
  const pvInputs = pvKeys.map((key) => {
    const n = Number(/^pv(\d+)_/.exec(key)?.[1] ?? 0);
    const power = getNum(key);
    const volts = getNum(`pv${n}_voltage_v`);
    const amps = getNum(`pv${n}_current_a`);
    return {
      n,
      powerText: power !== null ? `${(power / 1000).toFixed(2)} kW` : "—",
      voltageText: volts !== null ? `${volts.toFixed(1)} V` : "—",
      currentText: amps !== null ? `${amps.toFixed(2)} A` : "—",
    };
  });
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

  // Battery Pack's own 4 cards — live charge/discharge power plus today's
  // two energy totals.
  const batteryPowerW = getNum("battery_power_w");
  const batteryPowerText = batteryPowerW !== null ? `${(Math.abs(batteryPowerW) / 1000).toFixed(2)} kW` : "—";
  const batteryDirection = batteryPowerW === null || batteryPowerW === 0 ? "Idle" : batteryPowerW < 0 ? "Charging" : "Discharging";
  const batteryDirectionTone = batteryPowerW !== null && batteryPowerW < 0 ? "good" : "neutral";
  const batteryVoltageV = getNum("battery_voltage_v");
  const batteryVoltageText = batteryVoltageV !== null ? `${batteryVoltageV.toFixed(2)} V` : "—";
  const batteryCurrentA = getNum("battery_current_a");
  const batteryCurrentText = batteryCurrentA !== null ? `${Math.abs(batteryCurrentA).toFixed(2)} A` : "—";
  const batteryTempC = getNum("battery_temperature_c");
  const batteryTempText = batteryTempC !== null ? `${batteryTempC.toFixed(1)} °C` : "—";
  const batteryTempWarm = batteryTempC !== null && batteryTempC >= TEMPERATURE_MAX_C.battery_temperature_c;
  const dayBatteryChargeText = (() => {
    const v = getNum("day_battery_charge_energy_kwh");
    return v !== null ? `${v.toFixed(1)} kWh` : "—";
  })();
  const dayBatteryDischargeText = (() => {
    const v = getNum("day_battery_discharge_energy_kwh");
    return v !== null ? `${v.toFixed(1)} kWh` : "—";
  })();

  // Load's own 4 cards — live draw, today's total, the L1 power and an Electrical card (voltage, current, frequency).
  const loadPowerW = getNum("load_total_power_w");
  const loadLiveText = loadPowerW !== null ? `${(loadPowerW / 1000).toFixed(2)} kW` : "—";
  const load1Text = (() => {
    const v = getNum("load_l1_power_w");
    return v !== null ? `${v.toFixed(0)} W` : "—";
  })();
  const loadVoltageV = getNum("load_l1_voltage_v");
  const loadVoltageText = loadVoltageV !== null ? `${loadVoltageV.toFixed(1)} V` : "—";
  const loadCurrentA = getNum("load_l1_current_a");
  const loadCurrentText = loadCurrentA !== null ? `${loadCurrentA.toFixed(2)} A` : "—";
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
  // Today's energy as plain numbers (the card shows "imported / exported kWh").
  const kwhNumber = (key: string) => {
    const v = getNum(key);
    return v !== null ? v.toFixed(1) : "—";
  };
  const gridImportedKwhText = kwhNumber("day_grid_import_energy_kwh");
  const gridExportedKwhText = kwhNumber("day_grid_export_energy_kwh");
  // The grid CT clamp: total power, L1 power and L1 current.
  const ctTotalW = getNum("grid_ct_total_power_w");
  const gridCtTotalText = ctTotalW !== null ? `${(ctTotalW / 1000).toFixed(2)} kW` : "—";
  const ctPowerW = getNum("grid_ct_l1_power_w");
  const gridCtPowerText = ctPowerW !== null ? `${ctPowerW.toFixed(0)} W` : "—";
  const ctCurrentA = getNum("grid_ct_l1_current_a");
  const gridCtCurrentText = ctCurrentA !== null ? `${ctCurrentA.toFixed(2)} A` : "—";
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
    hub: { value: liveOutputKw, label: "Output Power" },
    ...(solarEnabled ? { solar: { value: solarTodayText, label: "Power Generated" } } : {}),
    ...(batteryEnabled ? { battery: { value: socPctText, label: "Battery Level" } } : {}),
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
            lastKnown={offline}
          />
          <LiveSyncedAgo lastTs={lastReadAt} label={offline ? "Last reading" : "Updated"} />
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
      <MonitoringTabs key={deviceId} defaultValue="hub" headlines={tabHeadlines} hasLiveData={lastReadAt !== null}>
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
              <TabButtonContent icon={Home} label="Load" />
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

          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${inverterTemperatureRows.length > 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            <LiveStatusCard
              icon={Sun}
              title="Output Power"
              subtitle="Inverter output power"
              value={liveOutputKw}
              statusLabel="Status"
              badgeLabel="Live"
              badgeTone="neutral"
            />
            <LiveStatusCard
              icon={Gauge}
              title="Electrical"
              subtitle={`Current · ${currentText}`}
              value={voltageText}
              statusLabel="Frequency"
              badgeLabel={frequencyText}
              badgeTone="neutral"
            />
            <LiveStatusCard
              icon={Zap}
              title="AC Output"
              subtitle="Energy today"
              value={activeEnergyText}
              statusLabel="Status"
              badgeLabel="Today"
              badgeTone="neutral"
            />
            {inverterTemperatureRows.length > 0 && (
              <LiveStatusCard
                icon={Thermometer}
                iconTone={tempRatio >= 0.85 ? "warn" : "neutral"}
                title="Temperature"
                subtitle={hottest ? `Hottest · ${hottest.label}` : "Inverter sensors"}
                value={hottest ? `${hottest.c.toFixed(1)} °C` : "—"}
                statusLabel="Status"
                badgeLabel={tempBadge}
                badgeTone={!hottest ? "neutral" : tempRatio >= 0.85 ? "warn" : "good"}
              />
            )}
          </div>

          <MainHubTrendGroup
            deviceId={deviceId}
            powerSeries={[
              { key: "inverter_output_power_w", label: "Solar", color: "var(--chart-3)" },
              { key: "load_total_power_w", label: "Load", color: "var(--chart-2)" },
              {
                key: "grid_total_power_w",
                label: "Grid",
                color: "#f97316",
                signed: {
                  positive: { color: "#f97316", label: "Importing", footer: "imported" },
                  negative: { color: "#3b82f6", label: "Exporting", footer: "exported" },
                },
              },
              {
                key: "battery_power_w",
                label: "Battery",
                color: "#10b981",
                // The inverter reports discharging as positive; the chart draws charging upward (as Overview does).
                scale: -0.001,
                signed: {
                  positive: { color: "#10b981", label: "Charging", footer: "charged" },
                  negative: { color: "#f97316", label: "Discharging", footer: "discharged" },
                },
              },
            ]}
          />

          {/* The AC output and Energy groups are covered by the cards and charts above; AC Output Total lives on Performance. */}
          {sortGroups(
            "Inverter",
            inverterGroups.filter((g) => g.groupName !== "AC output" && g.groupName !== "Energy")
          ).map((group) => renderGroup("Inverter", group, getValue, enumOptions))}
        </TabsContent>

        {solarEnabled && (
          <TabsContent value="solar" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <LiveStatusCard
                icon={Sun}
                title="Live Output"
                subtitle="Current power"
                value={solarGenerationText}
                statusLabel="Status"
                badgeLabel="Live"
                badgeTone="neutral"
              />
              <LiveStatusCard
                icon={Zap}
                title="Generated Today"
                subtitle="So far today"
                value={solarTodayText}
                statusLabel="Status"
                badgeLabel="Today"
                badgeTone="neutral"
              />
              {pvInputs.map((pv) => (
                <LiveStatusCard
                  key={pv.n}
                  icon={Sun}
                  title={`PV${pv.n}`}
                  subtitle={`${pv.voltageText} · ${pv.currentText}`}
                  value={pv.powerText}
                  statusLabel="Status"
                  badgeLabel="Live"
                  badgeTone="neutral"
                />
              ))}
            </div>

            <SolarTrendGroup deviceId={deviceId} pvKeys={pvKeys} />

            {/* The per-input readings are the PV cards and charts above; Solar Production Total lives on Performance. */}
            {sortGroups(
              "Solar Array",
              (categories["Solar Array"] ?? []).filter((g) => g.groupName !== "Per input (MPPT)" && g.groupName !== "Energy")
            ).map((group) => renderGroup("Solar Array", group, getValue, enumOptions))}
          </TabsContent>
        )}

        {batteryEnabled && (
          <TabsContent value="battery" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <LiveStatusCard
                icon={BatteryCharging}
                title="Battery Level"
                subtitle="State of charge"
                value={socPctText}
                statusLabel="Temperature"
                badgeLabel={batteryTempText}
                badgeTone={batteryTempWarm ? "warn" : "neutral"}
              />
              <LiveStatusCard
                icon={Zap}
                title="Battery Power"
                subtitle={`${batteryVoltageText} · ${batteryCurrentText}`}
                value={batteryPowerText}
                statusLabel="Status"
                badgeLabel={batteryDirection}
                badgeTone={batteryDirectionTone}
              />
              <LiveStatusCard
                icon={ArrowDownToLine}
                title="Charged Today"
                subtitle="Into the battery"
                value={dayBatteryChargeText}
                statusLabel="Status"
                badgeLabel="Today"
                badgeTone="neutral"
              />
              <LiveStatusCard
                icon={ArrowUpFromLine}
                title="Discharged Today"
                subtitle="Out of the battery"
                value={dayBatteryDischargeText}
                statusLabel="Status"
                badgeLabel="Today"
                badgeTone="neutral"
              />
            </div>

            <BarTrendChart
              deviceId={deviceId}
              title="Battery SOC Trend"
              series={[{ key: "battery_soc_pct", label: "SOC", color: "var(--chart-1)" }]}
              unit="%"
              valueScale={1}
              footerMode="average"
            />

            {/* Live, BMS and Energy are covered by the cards and charts above; only the per-pack readings remain. */}
            {sortGroups(
              "Battery",
              batteryGroups.filter((g) => !["Live", "Battery management system (BMS)", "Energy"].includes(g.groupName ?? ""))
            ).map((group) => renderGroup("Battery", group, getValue, enumOptions))}
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
                statusLabel="Status"
                badgeLabel="Live"
                badgeTone="neutral"
              />
              <LiveStatusCard
                icon={Zap}
                title="Consumed Today"
                subtitle="So far today"
                value={loadTodayText}
                statusLabel="Status"
                badgeLabel="Today"
                badgeTone="neutral"
              />
              <LiveStatusCard
                icon={Activity}
                title="L1 Power"
                subtitle="Phase L1"
                value={load1Text}
                statusLabel="Status"
                badgeLabel="Live"
                badgeTone="neutral"
              />
              <LiveStatusCard
                icon={Gauge}
                title="Electrical"
                subtitle={`Current · ${loadCurrentText}`}
                value={loadVoltageText}
                statusLabel="Frequency"
                badgeLabel={loadFrequencyText}
                badgeTone="neutral"
              />
            </div>

            <BarTrendChart
              deviceId={deviceId}
              title="Load Power"
              series={[{ key: "load_total_power_w", label: "Load", color: "var(--chart-2)" }]}
            />
          </TabsContent>
        )}

        {gridEnabled && (
          <TabsContent value="grid" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <LiveStatusCard
                icon={Zap}
                title="Live Flow"
                subtitle={gridDirection}
                value={gridLiveText}
                statusLabel="Status"
                badgeLabel={gridConnected === 0 ? "Not connected" : gridDirection}
                badgeTone={gridConnected === 0 ? "warn" : gridDirectionTone}
              />
              <LiveStatusCard
                icon={ArrowDownToLine}
                title="Energy Today"
                subtitle="Imported / Exported"
                value={`${gridImportedKwhText} / ${gridExportedKwhText} kWh`}
                statusLabel="Status"
                badgeLabel="Today"
                badgeTone="neutral"
              />
              <LiveStatusCard
                icon={Gauge}
                title="Electrical"
                subtitle={`Current · ${gridCurrentText}`}
                value={gridVoltageText}
                statusLabel="Frequency"
                badgeLabel={gridFrequencyText}
                badgeTone="neutral"
              />
              <LiveStatusCard
                icon={Activity}
                title="CT Meter"
                subtitle={`Current · ${gridCtCurrentText}`}
                value={gridCtTotalText}
                statusLabel="CT power"
                badgeLabel={gridCtPowerText}
                badgeTone="neutral"
              />
            </div>

            <BarTrendChart
              deviceId={deviceId}
              title="Grid Power"
              series={[{ key: "grid_total_power_w", label: "Grid", color: "var(--chart-4)" }]}
            />
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
                statusLabel="Status"
                badgeLabel={genPowerW && genPowerW > 0 ? "Running" : "Idle"}
                badgeTone={genPowerW && genPowerW > 0 ? "good" : "neutral"}
              />
              <LiveStatusCard
                icon={Gauge}
                title="Voltage"
                subtitle="Output voltage"
                value={genVoltageText}
                statusLabel="Frequency"
                badgeLabel={genFrequencyText}
                badgeTone="neutral"
              />
              <LiveStatusCard
                icon={Activity}
                title="Frequency"
                subtitle="Output frequency"
                value={genFrequencyText}
                statusLabel="Status"
                badgeLabel="Live"
                badgeTone="neutral"
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
