"use client";

import * as React from "react";
import {
  averageBetweenHours,
  DAY_KEYS,
  homeSupply,
  LIFETIME_KEYS,
  pct,
  roundTripPct,
  selfConsumptionPct,
  selfSufficiencyPct,
  solarSplit,
} from "@/lib/performance-metrics";
import { TEMPERATURE_MAX_C } from "@/lib/temperature-thresholds";
import { batteryHealth, capacityEstimates, MIN_SOC_SWING, type BatteryProfile, type BatterySlot } from "@/lib/battery-health";
import { useSeriesRange } from "@/lib/telemetry/react";
import { windowFor } from "@/lib/telemetry/ranges";
import { ChartErrorCard } from "./chart-states";
import { DivergingBarChart, PerformanceChart } from "./lazy-charts";
import { dayLabel, scaleCurve, untilNow, useDailyHistory, useDayCurves, type HistoryPreset } from "./perf-data";
import { fmtKwhText, fmtNum, fmtPct, LineSeriesChart, Panel, SplitBar, StatTile } from "./perf-kit";
import { sumCurves } from "./perf-solar";

export interface SectionProps {
  deviceId: string;
  preset: HistoryPreset;
  live: Record<string, number | null>;
  tariff: number;
  pvKeys: string[];
  extras?: React.ReactNode;
}

const clock = (t: number) => new Date(t + 19_800_000).toISOString().slice(11, 16);
const periodLabel = (preset: HistoryPreset) => preset.replace("d", " days");

/** Daily points of a counter over the history window. */
function dailyPoints(days: string[], values: (number | null)[]) {
  return days.flatMap((d, i) => (values[i] !== null ? [{ date: d, value: values[i] as number }] : []));
}

function peakOf(axis: number[], values: (number | null)[]): { v: number; t: number } | null {
  let best: { v: number; t: number } | null = null;
  values.forEach((v, i) => {
    if (v !== null && v > 0 && (best === null || v > best.v)) best = { v, t: axis[i] };
  });
  return best;
}

const GREEN = "#10b981";
const ORANGE = "#f97316";
const BLUE = "#3b82f6";

// ====================================================================== battery

export function BatterySection({ deviceId, preset, live, profile, extras }: SectionProps & { profile: BatteryProfile | null }) {
  const curves = useDayCurves(deviceId, ["battery_soc_pct", "battery_power_w", "battery_temperature_c", "battery_voltage_v"]);
  const history = useDailyHistory(deviceId, [DAY_KEYS.charged, DAY_KEYS.discharged], preset);
  // Health and cycles: the last 7 days at 15 minutes (to measure the capacity in long discharges) and 30 days of daily
  // discharge (the pace of use).
  const [nowMs] = React.useState(() => Date.now());
  const week = React.useMemo(() => windowFor("7d", nowMs), [nowMs]);
  const weekSeries = useSeriesRange(deviceId, ["battery_soc_pct", "battery_power_w"], week, 15);
  const month = useDailyHistory(deviceId, [DAY_KEYS.discharged], "30d");
  if (history.error) return <ChartErrorCard title="Battery history" message={history.error} onRetry={history.retry} />;

  const charged = live[LIFETIME_KEYS.charged];
  const discharged = live[LIFETIME_KEYS.discharged];
  const efficiency = roundTripPct(charged, discharged);
  const chargedDaily = history.counter(DAY_KEYS.charged);
  const dischargedDaily = history.counter(DAY_KEYS.discharged);
  const diverging = history.days.flatMap((d, i) => (chargedDaily[i] !== null || dischargedDaily[i] !== null ? [{ date: d, positive: chargedDaily[i] ?? 0, negative: dischargedDaily[i] ?? 0 }] : []));
  const periodCharged = diverging.reduce((s, p) => s + p.positive, 0);
  const periodDischarged = diverging.reduce((s, p) => s + p.negative, 0);
  const temp = live.battery_temperature_c;
  const tempMax = TEMPERATURE_MAX_C.battery_temperature_c;
  // The inverter reports discharging as positive; charging is drawn upward.
  const power = (c: Record<string, (number | null)[]>) => scaleCurve(c.battery_power_w ?? [], -0.001);

  const slots: BatterySlot[] = weekSeries.axis.map((t, i) => {
    const soc = weekSeries.byKey.battery_soc_pct?.[i];
    const p = weekSeries.byKey.battery_power_w?.[i];
    return { t, socMax: soc?.max ?? null, socMin: soc?.min ?? null, powerW: p?.avg ?? null, coveredS: p?.covered ?? 0 };
  });
  const health = profile ? batteryHealth({ profile, dischargedKwh: discharged, dailyDischargedKwh: month.counter(DAY_KEYS.discharged), estimates: capacityEstimates(slots) }) : null;

  return (
    <div className="space-y-4">
      <Panel title="Battery health and cycles" description="Worked out from the energy that has gone through your battery - your inverter does not report these itself.">
        {profile && health ? <HealthPanel profile={profile} health={health} /> : <p className="text-sm text-muted-foreground">Your battery&apos;s size has not been entered yet. Once your installer adds its datasheet numbers (usable capacity and rated cycles), the cycle count, estimated health and remaining life show here.</p>}
      </Panel>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Charged, lifetime" value={fmtKwhText(charged)} hint={`${fmtKwhText(live[DAY_KEYS.charged])} today`} />
        <StatTile label="Discharged, lifetime" value={fmtKwhText(discharged)} hint={`${fmtKwhText(live[DAY_KEYS.discharged])} today`} />
        <StatTile label="Energy through the battery" value={fmtKwhText(charged !== null && charged !== undefined && discharged !== null && discharged !== undefined ? charged + discharged : null)} hint="Charged + discharged" />
        <StatTile label="Round-trip efficiency" value={fmtPct(efficiency)} hint={efficiency === null ? "Shows once the battery has cycled a few times" : "Energy out ÷ energy in"} />
        <StatTile label="Charge level" value={fmtPct(live.battery_soc_pct)} hint={`${fmtNum(live.battery_voltage_v, 1)} V · ${fmtNum(live.battery_current_a === null || live.battery_current_a === undefined ? null : Math.abs(live.battery_current_a), 1)} A`} />
        <StatTile label="Temperature" value={temp === null || temp === undefined ? "—" : `${temp.toFixed(1)} °C`} hint={temp !== null && temp !== undefined && temp >= tempMax ? "Running hot" : "Normal"} tone={temp !== null && temp !== undefined && temp >= tempMax ? "warn" : "neutral"} />
      </div>

      <Panel title="Charge level today" description="State of charge through the day. The dashed line is yesterday.">
        <LineSeriesChart axis={curves.axis} unit="%" digits={0} series={[
          { key: "today", label: "Today", color: GREEN, values: untilNow(curves.today.battery_soc_pct ?? [], curves.axis, curves.nowMs) },
          { key: "yesterday", label: "Yesterday", color: GREEN, values: curves.yesterday.battery_soc_pct ?? [], dashed: true },
        ]} />
      </Panel>

      <Panel title="Battery power today" description="Above zero the battery is charging, below zero it is discharging.">
        <LineSeriesChart axis={curves.axis} unit="kW" zeroLine series={[
          { key: "today", label: "Today", color: GREEN, values: untilNow(power(curves.today), curves.axis, curves.nowMs) },
          { key: "yesterday", label: "Yesterday", color: GREEN, values: power(curves.yesterday), dashed: true },
        ]} />
      </Panel>

      <Panel title="Charged vs discharged" description={`Each day, over ${periodLabel(preset)}: ${periodCharged.toFixed(1)} kWh in, ${periodDischarged.toFixed(1)} kWh out.`}>
        <DivergingBarChart data={diverging} positiveLabel="Charged" negativeLabel="Discharged" unit="kWh" />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Temperature today" description="Batteries last longest when kept cool.">
          <LineSeriesChart axis={curves.axis} unit="°C" series={[{ key: "t", label: "Battery", color: ORANGE, values: untilNow(curves.today.battery_temperature_c ?? [], curves.axis, curves.nowMs) }]} />
        </Panel>
        <Panel title="Battery voltage today" description="Rises while charging, falls while discharging.">
          <LineSeriesChart axis={curves.axis} unit="V" series={[{ key: "v", label: "Voltage", color: BLUE, values: untilNow(curves.today.battery_voltage_v ?? [], curves.axis, curves.nowMs) }]} />
        </Panel>
      </div>

      <Panel title="What the battery management system allows right now" description="The limits the battery asks the inverter to respect.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Charge current limit" value={`${fmtNum(live.bms_charge_current_limit_a, 0)} A`} />
          <StatTile label="Discharge current limit" value={`${fmtNum(live.bms_discharge_current_limit_a, 0)} A`} />
          <StatTile label="Charge voltage" value={`${fmtNum(live.bms_charge_voltage_v, 1)} V`} />
          <StatTile label="BMS temperature" value={live.bms_temperature_c === null || live.bms_temperature_c === undefined ? "—" : `${live.bms_temperature_c.toFixed(1)} °C`} />
        </div>
      </Panel>
      {extras}
    </div>
  );
}

function HealthPanel({ profile, health }: { profile: BatteryProfile; health: ReturnType<typeof batteryHealth> }) {
  const used = health.cycleLifeUsedPct;
  const soh = health.sohPct;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Equivalent full cycles" value={health.efc === null ? "—" : health.efc.toFixed(health.efc >= 100 ? 0 : 1)} hint={`of ${profile.ratedCycleLife.toLocaleString("en-IN")} rated`} />
        <StatTile
          label="Estimated health"
          value={soh === null ? "—" : `${soh.toFixed(0)}%`}
          hint={health.sohSource === "measured" ? `Measured from ${health.samples} discharge${health.samples === 1 ? "" : "s"}` : health.sohSource === "usage" ? "From how much it has been used" : undefined}
          tone={soh !== null && soh < profile.endOfLifePct + 5 ? "warn" : soh !== null && soh >= 90 ? "good" : "neutral"}
        />
        <StatTile label="Usable capacity" value={health.measuredKwh === null ? `${profile.ratedCapacityKwh} kWh` : `${health.measuredKwh.toFixed(1)} kWh`} hint={health.measuredKwh === null ? "Rated (not yet measured)" : `of ${profile.ratedCapacityKwh} kWh rated`} />
        <StatTile label="Life left at this pace" value={health.yearsLeft === null ? "—" : health.yearsLeft >= 100 ? "100+ years" : `${health.yearsLeft.toFixed(1)} years`} hint={health.cyclesPerDay === null ? "Needs a few days of use" : `${health.cyclesPerDay.toFixed(2)} cycles a day`} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Rated life used</span>
          <span className="tabular-nums">{used === null ? "—" : `${used.toFixed(used < 10 ? 1 : 0)}%`}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, used ?? 0)}%` }} />
        </div>
      </div>
      <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
        <li>One cycle = the battery delivering its rated {profile.ratedCapacityKwh} kWh once, in one go or spread over many smaller discharges.</li>
        <li>
          {health.sohSource === "measured"
            ? `Health is measured: the energy delivered in each long discharge divided by the share of the charge level it used. Discharges using at least ${MIN_SOC_SWING}% of the charge give a reading within about 3%.`
            : `Health is an estimate from use: the battery fades in a straight line to ${profile.endOfLifePct}% of its capacity at ${profile.ratedCycleLife.toLocaleString("en-IN")} cycles. A measured value replaces it after a discharge that uses at least ${MIN_SOC_SWING}% of the charge.`}
        </li>
        {profile.installedOn && <li>Installed {new Date(`${profile.installedOn}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}.</li>}
      </ul>
    </div>
  );
}

// ====================================================================== inverter

export function InverterSection({ deviceId, preset, live, pvKeys, extras }: SectionProps) {
  const keys = ["inverter_output_power_w", "battery_power_w", "inverter_ac_temperature_c", "inverter_dc_temperature_c", "grid_frequency_hz", "inverter_l1_voltage_v", ...pvKeys];
  const curves = useDayCurves(deviceId, keys);
  const history = useDailyHistory(deviceId, [DAY_KEYS.acOut], preset);
  if (history.error) return <ChartErrorCard title="Inverter history" message={history.error} onRetry={history.retry} />;

  const out = (c: Record<string, (number | null)[]>) => scaleCurve(c.inverter_output_power_w ?? [], 0.001);
  // Energy going in on the DC side: the solar input plus what the battery gives (or minus what it takes).
  const dcIn = (c: Record<string, (number | null)[]>) => sumCurves([scaleCurve(sumCurves(pvKeys.map((k) => c[k] ?? [])), 0.001), scaleCurve(c.battery_power_w ?? [], 0.001)]);
  const acToday = out(curves.today);
  const dcToday = dcIn(curves.today);
  const efficiencyCurve = acToday.map((ac, i) => {
    const dc = dcToday[i];
    if (ac === null || dc === null || dc < 0.3 || ac < 0.1) return null;
    const e = (ac / dc) * 100;
    return e > 105 ? null : Math.min(100, e);
  });
  let acSum = 0;
  let dcSum = 0;
  efficiencyCurve.forEach((e, i) => {
    if (e !== null) {
      acSum += acToday[i] as number;
      dcSum += dcToday[i] as number;
    }
  });
  const efficiencyToday = dcSum > 0 ? Math.min(100, (acSum / dcSum) * 100) : null;
  const dailyAc = dailyPoints(history.days, history.counter(DAY_KEYS.acOut));
  const peak = peakOf(curves.axis, untilNow(acToday, curves.axis, curves.nowMs));
  const acT = live.inverter_ac_temperature_c;
  const dcT = live.inverter_dc_temperature_c;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="AC output, lifetime" value={fmtKwhText(live[LIFETIME_KEYS.acOut])} hint={`${fmtKwhText(live[DAY_KEYS.acOut])} today`} />
        <StatTile label="Power now" value={live.inverter_output_power_w === null || live.inverter_output_power_w === undefined ? "—" : `${(live.inverter_output_power_w / 1000).toFixed(2)} kW`} hint={peak ? `Today's peak ${peak.v.toFixed(2)} kW at ${clock(peak.t)}` : undefined} />
        <StatTile label="Conversion efficiency, today" value={fmtPct(efficiencyToday)} hint="AC out ÷ DC in (approximate)" tone={efficiencyToday !== null && efficiencyToday < 90 ? "warn" : "neutral"} />
        <StatTile label="Heat sink (AC side)" value={acT === null || acT === undefined ? "—" : `${acT.toFixed(1)} °C`} hint={`Limit ${TEMPERATURE_MAX_C.inverter_ac_temperature_c} °C`} tone={acT !== null && acT !== undefined && acT >= TEMPERATURE_MAX_C.inverter_ac_temperature_c * 0.9 ? "warn" : "neutral"} />
        <StatTile label="Heat sink (DC side)" value={dcT === null || dcT === undefined ? "—" : `${dcT.toFixed(1)} °C`} hint={`Limit ${TEMPERATURE_MAX_C.inverter_dc_temperature_c} °C`} tone={dcT !== null && dcT !== undefined && dcT >= TEMPERATURE_MAX_C.inverter_dc_temperature_c * 0.9 ? "warn" : "neutral"} />
        <StatTile label="Grid frequency" value={`${fmtNum(live.grid_frequency_hz, 2)} Hz`} hint={live.grid_frequency_hz !== null && live.grid_frequency_hz !== undefined && Math.abs(live.grid_frequency_hz - 50) > 0.5 ? "Outside 50 ± 0.5 Hz" : "Stable"} />
      </div>

      <Panel title="Inverter output today" description="Power the inverter is delivering. The dashed line is yesterday.">
        <LineSeriesChart axis={curves.axis} unit="kW" series={[
          { key: "today", label: "Today", color: "var(--chart-1)", values: untilNow(acToday, curves.axis, curves.nowMs) },
          { key: "yesterday", label: "Yesterday", color: "var(--chart-1)", values: out(curves.yesterday), dashed: true },
        ]} />
      </Panel>

      <Panel title="Conversion efficiency today" description="How much of the DC power from the panels and battery comes out as AC. Shown while the inverter is working above 0.3 kW.">
        <LineSeriesChart axis={curves.axis} unit="%" digits={0} series={[{ key: "e", label: "Efficiency", color: GREEN, values: untilNow(efficiencyCurve, curves.axis, curves.nowMs) }]} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Inverter temperature today" description="Heat sinks run warmer under load; a steady climb means poor airflow.">
          <LineSeriesChart axis={curves.axis} unit="°C" series={[
            { key: "ac", label: "AC side", color: ORANGE, values: untilNow(curves.today.inverter_ac_temperature_c ?? [], curves.axis, curves.nowMs) },
            { key: "dc", label: "DC side", color: BLUE, values: untilNow(curves.today.inverter_dc_temperature_c ?? [], curves.axis, curves.nowMs) },
          ]} />
        </Panel>
        <Panel title="Grid frequency today" description="Should stay within 50 ± 0.5 Hz.">
          <LineSeriesChart axis={curves.axis} unit="Hz" digits={2} series={[{ key: "f", label: "Frequency", color: BLUE, values: untilNow(curves.today.grid_frequency_hz ?? [], curves.axis, curves.nowMs) }]} />
        </Panel>
      </div>

      <Panel title="Daily AC output" description={`Energy the inverter delivered each day over ${periodLabel(preset)}.`}>
        <PerformanceChart daily={dailyAc} unit="kWh" />
      </Panel>
      {extras}
    </div>
  );
}

// ====================================================================== load

export function LoadSection({ deviceId, preset, live, extras }: SectionProps) {
  const curves = useDayCurves(deviceId, ["load_total_power_w", "load_l1_voltage_v", "load_frequency_hz"]);
  const history = useDailyHistory(deviceId, [DAY_KEYS.load], preset);
  if (history.error) return <ChartErrorCard title="Load history" message={history.error} onRetry={history.retry} />;

  const kw = (c: Record<string, (number | null)[]>) => scaleCurve(c.load_total_power_w ?? [], 0.001);
  const todayKw = untilNow(kw(curves.today), curves.axis, curves.nowMs);
  const yesterdayKw = kw(curves.yesterday);
  const peak = peakOf(curves.axis, todayKw);
  const dayStart = curves.dayStart;
  // The standby draw: what the house uses in the small hours, when nothing is on but the always-on devices.
  const standby = averageBetweenHours(curves.axis, todayKw, dayStart, 2, 4) ?? averageBetweenHours(curves.axis, yesterdayKw, dayStart, 2, 4);
  const daily = dailyPoints(history.days, history.counter(DAY_KEYS.load));
  const total = daily.reduce((s, p) => s + p.value, 0);
  const sufficiency = selfSufficiencyPct(live[LIFETIME_KEYS.load], live[LIFETIME_KEYS.imported]);
  const supplyLife = homeSupply(live[LIFETIME_KEYS.load], live[LIFETIME_KEYS.imported], live[LIFETIME_KEYS.discharged]);
  const supplyToday = homeSupply(live[DAY_KEYS.load], live[DAY_KEYS.imported], live[DAY_KEYS.discharged]);
  const highest = daily.reduce<{ date: string; value: number } | null>((b, p) => (b === null || p.value > b.value ? p : b), null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Consumed, lifetime" value={fmtKwhText(live[LIFETIME_KEYS.load])} hint={`${fmtKwhText(live[DAY_KEYS.load])} today`} />
        <StatTile label={`Average per day · ${periodLabel(preset)}`} value={fmtKwhText(daily.length > 0 ? total / daily.length : null)} hint={`${daily.length} day${daily.length === 1 ? "" : "s"} of data`} />
        <StatTile label="Highest day" value={fmtKwhText(highest?.value ?? null)} hint={highest ? dayLabel(highest.date) : undefined} />
        <StatTile label="Peak today" value={peak ? `${peak.v.toFixed(2)} kW` : "—"} hint={peak ? `at ${clock(peak.t)}` : undefined} />
        <StatTile label="Standby draw (2–4 AM)" value={standby === null ? "—" : `${(standby * 1000).toFixed(0)} W`} hint="What always-on devices use" />
        <StatTile label="Self-sufficiency, lifetime" value={fmtPct(sufficiency)} hint="Share not taken from the grid" tone={sufficiency !== null && sufficiency >= 50 ? "good" : "neutral"} />
      </div>

      <Panel title="Load today" description={`Power your home is using${peak ? `, peaking at ${peak.v.toFixed(2)} kW at ${clock(peak.t)}` : ""}. The dashed line is yesterday.`}>
        <LineSeriesChart axis={curves.axis} unit="kW" digits={2} series={[
          { key: "today", label: "Today", color: "var(--chart-2)", values: todayKw },
          { key: "yesterday", label: "Yesterday", color: "var(--chart-2)", values: yesterdayKw, dashed: true },
        ]} />
      </Panel>

      <Panel title="Daily consumption" description={`Energy used each day over ${periodLabel(preset)}.`}>
        <PerformanceChart daily={daily} unit="kWh" />
      </Panel>

      <Panel title="Where your home's energy came from" description="An estimate from the energy counters: what the grid and battery supplied, and the rest taken as solar.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Lifetime</p>
            {supplyLife ? <SplitBar parts={supplyLife} colors={["var(--chart-3)", GREEN, ORANGE]} /> : <p className="text-sm text-muted-foreground">No data yet.</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Today</p>
            {supplyToday ? <SplitBar parts={supplyToday} colors={["var(--chart-3)", GREEN, ORANGE]} /> : <p className="text-sm text-muted-foreground">No data yet.</p>}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Voltage at your loads today" description="Dips below about 215 V under heavy use can stress motors.">
          <LineSeriesChart axis={curves.axis} unit="V" digits={0} series={[{ key: "v", label: "Voltage", color: BLUE, values: untilNow(curves.today.load_l1_voltage_v ?? [], curves.axis, curves.nowMs) }]} />
        </Panel>
        <Panel title="Frequency today" description="Should stay within 50 ± 0.5 Hz.">
          <LineSeriesChart axis={curves.axis} unit="Hz" digits={2} series={[{ key: "f", label: "Frequency", color: BLUE, values: untilNow(curves.today.load_frequency_hz ?? [], curves.axis, curves.nowMs) }]} />
        </Panel>
      </div>
      {extras}
    </div>
  );
}

// ====================================================================== grid

export function GridSection({ deviceId, preset, live, tariff, extras }: SectionProps) {
  const curves = useDayCurves(deviceId, ["grid_total_power_w", "grid_l1_voltage_v", "grid_frequency_hz"]);
  const history = useDailyHistory(deviceId, [DAY_KEYS.imported, DAY_KEYS.exported], preset);
  if (history.error) return <ChartErrorCard title="Grid history" message={history.error} onRetry={history.retry} />;

  const imported = live[LIFETIME_KEYS.imported];
  const exported = live[LIFETIME_KEYS.exported];
  const pv = live[LIFETIME_KEYS.pv];
  const net = imported !== null && imported !== undefined && exported !== null && exported !== undefined ? exported - imported : null;
  const importDaily = history.counter(DAY_KEYS.imported);
  const exportDaily = history.counter(DAY_KEYS.exported);
  const diverging = history.days.flatMap((d, i) => (importDaily[i] !== null || exportDaily[i] !== null ? [{ date: d, positive: exportDaily[i] ?? 0, negative: importDaily[i] ?? 0 }] : []));
  const periodExport = diverging.reduce((s, p) => s + p.positive, 0);
  const periodImport = diverging.reduce((s, p) => s + p.negative, 0);
  // Import is positive on the inverter; the chart shows exporting below zero.
  const power = (c: Record<string, (number | null)[]>) => scaleCurve(c.grid_total_power_w ?? [], 0.001);
  const load = live[LIFETIME_KEYS.load];
  const notFromGrid = load !== null && load !== undefined && imported !== null && imported !== undefined ? Math.max(0, load - imported) : null;
  const solarShare = selfConsumptionPct(pv, exported);
  const splitLife = solarSplit(pv, exported, live[LIFETIME_KEYS.charged]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Imported, lifetime" value={fmtKwhText(imported)} hint={`${fmtKwhText(live[DAY_KEYS.imported])} today`} />
        <StatTile label="Exported, lifetime" value={fmtKwhText(exported)} hint={`${fmtKwhText(live[DAY_KEYS.exported])} today`} />
        <StatTile label="Net exported" value={fmtKwhText(net)} hint="Exported − imported" tone={net !== null && net > 0 ? "good" : "neutral"} />
        <StatTile label="Solar sent to the grid" value={fmtPct(pct(exported, pv))} hint={solarShare === null ? undefined : `${solarShare.toFixed(0)}% used on site`} />
        <StatTile label="Bill avoided (estimate)" value={notFromGrid === null ? "—" : `₹${(notFromGrid * tariff).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} hint={`Energy not bought, at ₹${tariff.toFixed(2)}/kWh`} />
        <StatTile label="Grid power now" value={live.grid_total_power_w === null || live.grid_total_power_w === undefined ? "—" : `${Math.abs(live.grid_total_power_w / 1000).toFixed(2)} kW`} hint={live.grid_total_power_w === null || live.grid_total_power_w === undefined || live.grid_total_power_w === 0 ? "Idle" : live.grid_total_power_w > 0 ? "Importing" : "Exporting"} />
      </div>

      <Panel title="Grid power today" description="Above zero you are buying from the grid; below zero you are selling to it. The dashed line is yesterday.">
        <LineSeriesChart axis={curves.axis} unit="kW" digits={2} zeroLine series={[
          { key: "today", label: "Today", color: ORANGE, values: untilNow(power(curves.today), curves.axis, curves.nowMs) },
          { key: "yesterday", label: "Yesterday", color: ORANGE, values: power(curves.yesterday), dashed: true },
        ]} />
      </Panel>

      <Panel title="Exported vs imported" description={`Each day, over ${periodLabel(preset)}: ${periodExport.toFixed(1)} kWh sold, ${periodImport.toFixed(1)} kWh bought.`}>
        <DivergingBarChart data={diverging} positiveLabel="Exported" negativeLabel="Imported" unit="kWh" />
      </Panel>

      <Panel title="Where your solar energy went" description="An estimate from the lifetime counters.">
        {splitLife ? <SplitBar parts={splitLife} colors={[BLUE, GREEN, ORANGE]} /> : <p className="text-sm text-muted-foreground">No data yet.</p>}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Grid voltage today" description="Mains voltage at your inverter.">
          <LineSeriesChart axis={curves.axis} unit="V" digits={0} series={[{ key: "v", label: "Voltage", color: BLUE, values: untilNow(curves.today.grid_l1_voltage_v ?? [], curves.axis, curves.nowMs) }]} />
        </Panel>
        <Panel title="Grid frequency today" description="Should stay within 50 ± 0.5 Hz.">
          <LineSeriesChart axis={curves.axis} unit="Hz" digits={2} series={[{ key: "f", label: "Frequency", color: BLUE, values: untilNow(curves.today.grid_frequency_hz ?? [], curves.axis, curves.nowMs) }]} />
        </Panel>
      </div>

      <Panel title="Energy meter (CT clamp)" description="What the clamp on your grid cable measures right now.">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Total power" value={live.grid_ct_total_power_w === null || live.grid_ct_total_power_w === undefined ? "—" : `${(live.grid_ct_total_power_w / 1000).toFixed(2)} kW`} />
          <StatTile label="Power L1" value={live.grid_ct_l1_power_w === null || live.grid_ct_l1_power_w === undefined ? "—" : `${live.grid_ct_l1_power_w.toFixed(0)} W`} />
          <StatTile label="Current L1" value={`${fmtNum(live.grid_ct_l1_current_a, 2)} A`} />
        </div>
      </Panel>
      {extras}
    </div>
  );
}
