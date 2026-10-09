"use client";

import * as React from "react";
import { DAY_KEYS, homeSupply, LIFETIME_KEYS, pct, roundTripPct, selfConsumptionPct, selfSufficiencyPct, solarSplit } from "@/lib/performance-metrics";
import { averageAtHours, dailySeries, maxOf, minOf, peakAt, periodEfficiency, sumOf, type Series } from "@/lib/performance-period";
import { TEMPERATURE_MAX_C } from "@/lib/temperature-thresholds";
import { batteryHealth, capacityEstimates, MIN_SOC_SWING, type BatteryProfile, type BatterySlot } from "@/lib/battery-health";
import { useSeriesRange } from "@/lib/telemetry/react";
import { DAY_MS, windowFor, type RangeWindow } from "@/lib/telemetry/ranges";
import { ChartErrorCard } from "./chart-states";
import { DivergingBarChart } from "./lazy-charts";
import { dayLabel, scaleCurve, untilNow, useDailyHistory, useDayCurves, usePeriodSeries } from "./perf-data";
import { HeartPulse } from "lucide-react";
import { DailyBars, fmtKwhText, fmtNum, fmtPct, Panel, RangeLines, SplitBar, StatTile } from "./perf-kit";
import { sumCurves } from "./perf-solar";
import { FLOW } from "./flow-colors";

export interface SectionProps {
  deviceId: string;
  /** The days the page is showing (chosen with the range picker above), that period in words, and whether it is just today. */
  span: RangeWindow;
  periodText: string;
  isToday: boolean;
  live: Record<string, number | null>;
  tariff: number;
  pvKeys: string[];
  extras?: React.ReactNode;
}

const clock = (t: number) => new Date(t + 19_800_000).toISOString().slice(11, 16);
const dateOf = (t: number) => new Date(t + 19_800_000).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
/** "14:30" within a day, "5 Oct 14:30" across days, "5 Oct" when a slot is a whole day. */
const whenText = (t: number, isToday: boolean, minutes: number) => (isToday ? clock(t) : minutes >= 1440 ? dateOf(t) : `${dateOf(t)} ${clock(t)}`);
const spanDaysOf = (w: RangeWindow) => (w.toMs - w.fromMs) / DAY_MS;

const GREEN: string = FLOW.producing;
const ORANGE = "#f97316";
const BLUE: string = FLOW.consuming;
// Charts that are not an energy flow keep neutral colours, so the green / amber / blue of the flow key means one thing.
const SOC = "var(--chart-1)";
const TEMP = "#f59e0b"; // temperature charts: amber, and blue for a second line
const VOLT = "var(--chart-1)";
const FREQ = "var(--chart-5)";
const EFF = "var(--chart-2)";

/** The day-by-day pairs the diverging bars need, from two daily counters. */
function pairByDay(days: string[], positive: { date: string; value: number }[], negative: { date: string; value: number }[]) {
  const p = new Map(positive.map((x) => [x.date, x.value]));
  const n = new Map(negative.map((x) => [x.date, x.value]));
  return days.flatMap((d) => (p.has(d) || n.has(d) ? [{ date: d, positive: p.get(d) ?? 0, negative: n.get(d) ?? 0 }] : []));
}

// ====================================================================== battery

export function BatterySection({ deviceId, span, periodText, isToday, live, profile, extras }: SectionProps & { profile: BatteryProfile | null }) {
  const keys = ["battery_soc_pct", "battery_power_w", "battery_temperature_c", "battery_voltage_v"];
  const curves = useDayCurves(deviceId, keys);
  const period = usePeriodSeries(deviceId, keys, span);
  const history = useDailyHistory(deviceId, [DAY_KEYS.charged, DAY_KEYS.discharged], span);
  // Health and cycles are about the battery's whole life: the last 7 days at 15 minutes (to measure the capacity in long
  // discharges) and 30 days of daily discharge (the pace of use) - whatever period is chosen.
  const [nowMs] = React.useState(() => Date.now());
  const week = React.useMemo(() => windowFor("7d", nowMs), [nowMs]);
  const weekSeries = useSeriesRange(deviceId, ["battery_soc_pct", "battery_power_w"], week, 15);
  const monthWindow = React.useMemo(() => windowFor("30d", nowMs), [nowMs]);
  const month = useDailyHistory(deviceId, [DAY_KEYS.discharged], monthWindow);
  if (history.error) return <ChartErrorCard title="Battery history" message={history.error} onRetry={history.retry} />;

  const charged = live[LIFETIME_KEYS.charged];
  const discharged = live[LIFETIME_KEYS.discharged];
  const chargedDaily = dailySeries(history.days, history.counter(DAY_KEYS.charged), live[DAY_KEYS.charged], history.today);
  const dischargedDaily = dailySeries(history.days, history.counter(DAY_KEYS.discharged), live[DAY_KEYS.discharged], history.today);
  const diverging = pairByDay(history.days, chargedDaily, dischargedDaily);
  const periodCharged = sumOf(chargedDaily.map((p) => p.value));
  const periodDischarged = sumOf(dischargedDaily.map((p) => p.value));
  const efficiency = roundTripPct(periodCharged, periodDischarged);
  const lifetimeEfficiency = roundTripPct(charged, discharged);
  const soc = period.avg("battery_soc_pct");
  const socLow = minOf(period.min("battery_soc_pct"));
  const socHigh = maxOf(period.max("battery_soc_pct"));
  const tempMax = TEMPERATURE_MAX_C.battery_temperature_c;
  const hottest = maxOf(period.max("battery_temperature_c"));
  const when = isToday ? "today" : periodText;
  // The inverter reports discharging as positive; charging is drawn upward.
  const power = (c: Record<string, (number | null)[]>) => scaleCurve(c.battery_power_w ?? [], -0.001);
  const showPower = spanDaysOf(span) <= 8; // averaged over hours or days, charge and discharge cancel out and say little

  const slots: BatterySlot[] = weekSeries.axis.map((t, i) => {
    const s = weekSeries.byKey.battery_soc_pct?.[i];
    const p = weekSeries.byKey.battery_power_w?.[i];
    return { t, socMax: s?.max ?? null, socMin: s?.min ?? null, powerW: p?.avg ?? null, coveredS: p?.covered ?? 0 };
  });
  const health = profile ? batteryHealth({ profile, dischargedKwh: discharged, dailyDischargedKwh: month.counter(DAY_KEYS.discharged), estimates: capacityEstimates(slots) }) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label={`Charged · ${when}`} value={fmtKwhText(periodCharged)} hint={`${fmtKwhText(charged)} lifetime`} />
        <StatTile label={`Discharged · ${when}`} value={fmtKwhText(periodDischarged)} hint={`${fmtKwhText(discharged)} lifetime`} />
        <StatTile label={`Through the battery · ${when}`} value={fmtKwhText(periodCharged + periodDischarged)} hint="Charged + discharged" />
        <StatTile
          label={`Round-trip efficiency · ${when}`}
          value={fmtPct(efficiency)}
          hint={efficiency === null ? "Shows once 5 kWh has been charged in the period" : isToday ? "Rough over one day: depends on the charge you started with" : `Lifetime ${fmtPct(lifetimeEfficiency)}`}
        />
        <StatTile label={`Charge level · ${when}`} value={socLow === null || socHigh === null ? "—" : `${socLow.toFixed(0)}–${socHigh.toFixed(0)}%`} hint={isToday ? `Now ${fmtPct(live.battery_soc_pct)} · ${fmtNum(live.battery_voltage_v, 1)} V` : "Lowest to highest"} />
        <StatTile
          label={`Hottest · ${when}`}
          value={hottest === null ? "—" : `${hottest.toFixed(1)} °C`}
          hint={`Limit ${tempMax} °C`}
          tone={hottest !== null && hottest >= tempMax ? "warn" : "neutral"}
        />
      </div>

      <Panel title="Battery health and cycles" icon={HeartPulse} iconTone="good" description="Worked out from the energy that has gone through your battery over its whole life - your inverter does not report these itself, and they do not depend on the period chosen above.">
        {profile && health ? <HealthPanel profile={profile} health={health} /> : <p className="text-sm text-muted-foreground">Your battery&apos;s size has not been entered yet. Once your installer adds its datasheet numbers (usable capacity and rated cycles), the cycle count, estimated health and remaining life show here.</p>}
      </Panel>

      <Panel chart title={`Charge level · ${when}`} description={isToday ? "State of charge through the day. The dashed line is yesterday." : "State of charge over the period (average of each point)."}>
        <RangeLines
          isToday={isToday}
          todayAxis={curves.axis}
          todaySeries={[
            { key: "today", label: "Today", color: SOC, values: untilNow(curves.today.battery_soc_pct ?? [], curves.axis, curves.nowMs) },
            { key: "yesterday", label: "Yesterday", color: SOC, values: curves.yesterday.battery_soc_pct ?? [], dashed: true },
          ]}
          period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "soc", label: "Charge level", color: SOC, values: soc }] }}
          unit="%"
          digits={0}
        />
      </Panel>

      {(isToday || showPower) && (
        <Panel chart title={`Battery power · ${when}`} description="Above zero the battery is charging, below zero it is discharging.">
          <RangeLines
            isToday={isToday}
            todayAxis={curves.axis}
            todaySeries={[
              { key: "today", label: "Today", color: FLOW.producing, values: untilNow(power(curves.today), curves.axis, curves.nowMs) },
              { key: "yesterday", label: "Yesterday", color: FLOW.producing, values: power(curves.yesterday), dashed: true },
            ]}
            period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "p", label: "Battery power", color: FLOW.producing, values: scaleCurve(period.avg("battery_power_w"), -0.001) }] }}
            unit="kW"
            zeroLine
          />
        </Panel>
      )}

      {!isToday && (
        <Panel chart title="Charged vs discharged" description={`Each day, over ${periodText}: ${periodCharged.toFixed(1)} kWh in, ${periodDischarged.toFixed(1)} kWh out.`}>
          <DivergingBarChart data={diverging} positiveLabel="Charged" negativeLabel="Discharged" unit="kWh" />
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel chart title={`Temperature · ${when}`} description="Batteries last longest when kept cool.">
          <RangeLines
            isToday={isToday}
            todayAxis={curves.axis}
            todaySeries={[{ key: "t", label: "Battery", color: TEMP, values: untilNow(curves.today.battery_temperature_c ?? [], curves.axis, curves.nowMs) }]}
            period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "t", label: "Battery", color: TEMP, values: period.avg("battery_temperature_c") }] }}
            unit="°C"
          />
        </Panel>
        <Panel chart title={`Battery voltage · ${when}`} description="Rises while charging, falls while discharging.">
          <RangeLines
            isToday={isToday}
            todayAxis={curves.axis}
            todaySeries={[{ key: "v", label: "Voltage", color: VOLT, values: untilNow(curves.today.battery_voltage_v ?? [], curves.axis, curves.nowMs) }]}
            period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "v", label: "Voltage", color: VOLT, values: period.avg("battery_voltage_v") }] }}
            unit="V"
          />
        </Panel>
      </div>

      {isToday && (
        <Panel title="What the battery management system allows right now" description="The limits the battery asks the inverter to respect.">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Charge current limit" value={`${fmtNum(live.bms_charge_current_limit_a, 0)} A`} />
            <StatTile label="Discharge current limit" value={`${fmtNum(live.bms_discharge_current_limit_a, 0)} A`} />
            <StatTile label="Charge voltage" value={`${fmtNum(live.bms_charge_voltage_v, 1)} V`} />
            <StatTile label="BMS temperature" value={live.bms_temperature_c === null || live.bms_temperature_c === undefined ? "—" : `${live.bms_temperature_c.toFixed(1)} °C`} />
          </div>
        </Panel>
      )}
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

export function InverterSection({ deviceId, span, periodText, isToday, live, pvKeys, extras }: SectionProps) {
  const keys = ["inverter_output_power_w", "battery_power_w", "inverter_ac_temperature_c", "inverter_dc_temperature_c", "grid_frequency_hz", ...pvKeys];
  const curves = useDayCurves(deviceId, keys);
  const period = usePeriodSeries(deviceId, keys, span);
  const history = useDailyHistory(deviceId, [DAY_KEYS.acOut], span);
  if (history.error) return <ChartErrorCard title="Inverter history" message={history.error} onRetry={history.retry} />;

  const kw = (v: Series) => scaleCurve(v, 0.001);
  // Energy going in on the DC side: the solar input plus what the battery gives (or minus what it takes).
  const dcIn = (get: (k: string) => Series) => sumCurves([kw(sumCurves(pvKeys.map((k) => get(k)))), kw(get("battery_power_w"))]);
  const acToday = kw(curves.today.inverter_output_power_w ?? []);
  const effToday = periodEfficiency(acToday, dcIn((k) => curves.today[k] ?? []));
  const acPeriod = kw(period.avg("inverter_output_power_w"));
  const effPeriod = periodEfficiency(acPeriod, dcIn((k) => period.avg(k)));
  const efficiency = isToday ? effToday.pct : effPeriod.pct;

  const acDaily = dailySeries(history.days, history.counter(DAY_KEYS.acOut), live[DAY_KEYS.acOut], history.today);
  const periodAc = sumOf(acDaily.map((p) => p.value));
  const peakKw = (maxOf(period.max("inverter_output_power_w")) ?? 0) / 1000;
  const peak = peakAt(period.axis, kw(period.max("inverter_output_power_w")));
  const acHot = maxOf(period.max("inverter_ac_temperature_c"));
  const dcHot = maxOf(period.max("inverter_dc_temperature_c"));
  const hottest = acHot === null && dcHot === null ? null : Math.max(acHot ?? -Infinity, dcHot ?? -Infinity);
  const hotLimit = hottest !== null && (acHot ?? -Infinity) >= (dcHot ?? -Infinity) ? TEMPERATURE_MAX_C.inverter_ac_temperature_c : TEMPERATURE_MAX_C.inverter_dc_temperature_c;
  const fLow = minOf(period.min("grid_frequency_hz"));
  const fHigh = maxOf(period.max("grid_frequency_hz"));
  const fOut = fLow !== null && fHigh !== null && (fLow < 49.5 || fHigh > 50.5);
  const when = isToday ? "today" : periodText;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="AC output, lifetime" value={fmtKwhText(live[LIFETIME_KEYS.acOut])} hint={`${fmtKwhText(live[DAY_KEYS.acOut])} today`} />
        <StatTile label={`AC output · ${when}`} value={fmtKwhText(periodAc)} hint={acDaily.length > 1 ? `${(periodAc / acDaily.length).toFixed(1)} kWh a day on average` : undefined} />
        <StatTile label={`Peak power · ${when}`} value={peak ? `${peakKw.toFixed(2)} kW` : "—"} hint={peak ? (period.minutes >= 1440 ? `On ${dateOf(peak.t)} (daily peak)` : `At ${whenText(peak.t, isToday, period.minutes)}`) : undefined} />
        <StatTile label={`Conversion efficiency · ${when}`} value={fmtPct(efficiency)} hint="AC out ÷ DC in (approximate)" tone={efficiency !== null && efficiency < 90 ? "warn" : "neutral"} />
        <StatTile
          label={`Hottest heat sink · ${when}`}
          value={hottest === null ? "—" : `${hottest.toFixed(1)} °C`}
          hint={`AC ${acHot === null ? "—" : acHot.toFixed(0)} · DC ${dcHot === null ? "—" : dcHot.toFixed(0)} · limit ${hotLimit} °C`}
          tone={hottest !== null && hottest >= hotLimit * 0.9 ? "warn" : "neutral"}
        />
        <StatTile label={`Grid frequency · ${when}`} value={fLow === null || fHigh === null ? "—" : `${fLow.toFixed(2)}–${fHigh.toFixed(2)} Hz`} hint={fOut ? "Outside 50 ± 0.5 Hz" : "Stable"} tone={fOut ? "warn" : "neutral"} />
      </div>

      <Panel chart title={`Inverter output · ${when}`} description={isToday ? "Power the inverter is delivering. The dashed line is yesterday." : "Power the inverter delivered (average of each point)."}>
        <RangeLines
          isToday={isToday}
          todayAxis={curves.axis}
          todaySeries={[
            { key: "today", label: "Today", color: FLOW.producing, values: untilNow(acToday, curves.axis, curves.nowMs) },
            { key: "yesterday", label: "Yesterday", color: FLOW.producing, values: kw(curves.yesterday.inverter_output_power_w ?? []), dashed: true },
          ]}
          period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "ac", label: "AC output", color: FLOW.producing, values: acPeriod }] }}
          unit="kW"
        />
      </Panel>

      <Panel chart title={`Conversion efficiency · ${when}`} description="How much of the DC power from the panels and battery comes out as AC. Shown while the inverter is working above 0.3 kW.">
        <RangeLines
          isToday={isToday}
          todayAxis={curves.axis}
          todaySeries={[{ key: "e", label: "Efficiency", color: EFF, values: untilNow(effToday.perSlot, curves.axis, curves.nowMs) }]}
          period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "e", label: "Efficiency", color: EFF, values: effPeriod.perSlot }] }}
          unit="%"
          digits={0}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel chart title={`Inverter temperature · ${when}`} description="Heat sinks run warmer under load; a steady climb means poor airflow.">
          <RangeLines
            isToday={isToday}
            todayAxis={curves.axis}
            todaySeries={[
              { key: "ac", label: "AC side", color: TEMP, values: untilNow(curves.today.inverter_ac_temperature_c ?? [], curves.axis, curves.nowMs) },
              { key: "dc", label: "DC side", color: "#3b82f6", values: untilNow(curves.today.inverter_dc_temperature_c ?? [], curves.axis, curves.nowMs) },
            ]}
            period={{
              axis: period.axis,
              minutes: period.minutes,
              series: [
                { key: "ac", label: "AC side", color: TEMP, values: period.avg("inverter_ac_temperature_c") },
                { key: "dc", label: "DC side", color: "#3b82f6", values: period.avg("inverter_dc_temperature_c") },
              ],
            }}
            unit="°C"
          />
        </Panel>
        <Panel chart title={`Grid frequency · ${when}`} description="Should stay within 50 ± 0.5 Hz.">
          <RangeLines
            isToday={isToday}
            todayAxis={curves.axis}
            todaySeries={[{ key: "f", label: "Frequency", color: FREQ, values: untilNow(curves.today.grid_frequency_hz ?? [], curves.axis, curves.nowMs) }]}
            period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "f", label: "Frequency", color: FREQ, values: period.avg("grid_frequency_hz") }] }}
            unit="Hz"
            digits={2}
          />
        </Panel>
      </div>

      {!isToday && (
        <Panel chart title="Daily AC output" description={`Energy the inverter delivered each day over ${periodText}.`}>
          <DailyBars daily={acDaily} label="AC output" color={FLOW.producing} />
        </Panel>
      )}
      {extras}
    </div>
  );
}

// ====================================================================== load

export function LoadSection({ deviceId, span, periodText, isToday, live, extras }: SectionProps) {
  const keys = ["load_total_power_w", "load_l1_voltage_v", "load_frequency_hz"];
  const curves = useDayCurves(deviceId, keys);
  const period = usePeriodSeries(deviceId, keys, span);
  const history = useDailyHistory(deviceId, [DAY_KEYS.load, DAY_KEYS.imported, DAY_KEYS.discharged], span);
  if (history.error) return <ChartErrorCard title="Load history" message={history.error} onRetry={history.retry} />;

  const kw = (v: Series) => scaleCurve(v, 0.001);
  const loadDaily = dailySeries(history.days, history.counter(DAY_KEYS.load), live[DAY_KEYS.load], history.today);
  const importDaily = dailySeries(history.days, history.counter(DAY_KEYS.imported), live[DAY_KEYS.imported], history.today);
  const dischargeDaily = dailySeries(history.days, history.counter(DAY_KEYS.discharged), live[DAY_KEYS.discharged], history.today);
  const periodLoad = sumOf(loadDaily.map((p) => p.value));
  const periodImport = sumOf(importDaily.map((p) => p.value));
  const periodDischarge = sumOf(dischargeDaily.map((p) => p.value));
  const highest = loadDaily.reduce<{ date: string; value: number } | null>((b, p) => (b === null || p.value > b.value ? p : b), null);
  const loadKw = kw(period.avg("load_total_power_w"));
  const peak = peakAt(period.axis, kw(period.max("load_total_power_w")));
  const peakKw = (maxOf(period.max("load_total_power_w")) ?? 0) / 1000;
  // What the house draws when nothing is on but the always-on devices (2-4 AM) - needs slots finer than 3 hours.
  const standby = period.minutes <= 120 ? averageAtHours(period.axis, period.avg("load_total_power_w"), 2, 4) : null;
  const covered = period.avg("load_total_power_w").filter((v) => v !== null).length;
  const avgKw = covered > 0 ? sumOf(loadKw) / covered : null;
  const sufficiency = selfSufficiencyPct(periodLoad, periodImport);
  const supplyPeriod = homeSupply(periodLoad, periodImport, periodDischarge);
  const supplyLife = homeSupply(live[LIFETIME_KEYS.load], live[LIFETIME_KEYS.imported], live[LIFETIME_KEYS.discharged]);
  const when = isToday ? "today" : periodText;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Consumed, lifetime" value={fmtKwhText(live[LIFETIME_KEYS.load])} hint={`${fmtKwhText(live[DAY_KEYS.load])} today`} />
        <StatTile label={`Consumed · ${when}`} value={fmtKwhText(periodLoad)} hint={highest && loadDaily.length > 1 ? `Highest day ${fmtKwhText(highest.value)} · ${dayLabel(highest.date)}` : undefined} />
        <StatTile label={`Average power · ${when}`} value={avgKw === null ? "—" : `${avgKw.toFixed(2)} kW`} hint={loadDaily.length > 1 ? `${(periodLoad / loadDaily.length).toFixed(1)} kWh a day` : undefined} />
        <StatTile label={`Peak power · ${when}`} value={peak ? `${peakKw.toFixed(2)} kW` : "—"} hint={peak ? (period.minutes >= 1440 ? `On ${dateOf(peak.t)} (daily peak)` : `At ${whenText(peak.t, isToday, period.minutes)}`) : undefined} />
        <StatTile label={`Standby draw (2–4 AM) · ${when}`} value={standby === null ? "—" : `${(standby).toFixed(0)} W`} hint={standby === null ? (isToday ? "Shows after 2 AM" : "Needs a period of 30 days or less") : "What always-on devices use"} />
        <StatTile label={`Self-sufficiency · ${when}`} value={fmtPct(sufficiency)} hint="Share not taken from the grid" tone={sufficiency !== null && sufficiency >= 50 ? "good" : "neutral"} />
      </div>

      <Panel chart title={`Load · ${when}`} description={`Power your home is using${peak ? `, peaking at ${peakKw.toFixed(2)} kW ${period.minutes >= 1440 ? `on ${dateOf(peak.t)}` : `at ${whenText(peak.t, isToday, period.minutes)}`}` : ""}.${isToday ? " The dashed line is yesterday." : ""}`}>
        <RangeLines
          isToday={isToday}
          todayAxis={curves.axis}
          todaySeries={[
            { key: "today", label: "Today", color: FLOW.consuming, values: untilNow(kw(curves.today.load_total_power_w ?? []), curves.axis, curves.nowMs) },
            { key: "yesterday", label: "Yesterday", color: FLOW.consuming, values: kw(curves.yesterday.load_total_power_w ?? []), dashed: true },
          ]}
          period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "load", label: "Load", color: FLOW.consuming, values: loadKw }] }}
          unit="kW"
          digits={2}
        />
      </Panel>

      {!isToday && (
        <Panel chart title="Daily consumption" description={`Energy used each day over ${periodText}.`}>
          <DailyBars daily={loadDaily} label="Used" color={FLOW.consuming} />
        </Panel>
      )}

      <Panel title={`Where your home's energy came from · ${when}`} description="An estimate from the energy counters: what the grid and battery supplied, and the rest taken as solar.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{isToday ? "Today" : periodText}</p>
            {supplyPeriod ? <SplitBar parts={supplyPeriod} colors={["var(--chart-3)", GREEN, ORANGE]} /> : <p className="text-sm text-muted-foreground">No data yet.</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Lifetime</p>
            {supplyLife ? <SplitBar parts={supplyLife} colors={["var(--chart-3)", GREEN, ORANGE]} /> : <p className="text-sm text-muted-foreground">No data yet.</p>}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel chart title={`Voltage at your loads · ${when}`} description="Dips below about 215 V under heavy use can stress motors.">
          <RangeLines
            isToday={isToday}
            todayAxis={curves.axis}
            todaySeries={[{ key: "v", label: "Voltage", color: VOLT, values: untilNow(curves.today.load_l1_voltage_v ?? [], curves.axis, curves.nowMs) }]}
            period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "v", label: "Voltage", color: VOLT, values: period.avg("load_l1_voltage_v") }] }}
            unit="V"
            digits={0}
          />
        </Panel>
        <Panel chart title={`Frequency · ${when}`} description="Should stay within 50 ± 0.5 Hz.">
          <RangeLines
            isToday={isToday}
            todayAxis={curves.axis}
            todaySeries={[{ key: "f", label: "Frequency", color: FREQ, values: untilNow(curves.today.load_frequency_hz ?? [], curves.axis, curves.nowMs) }]}
            period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "f", label: "Frequency", color: FREQ, values: period.avg("load_frequency_hz") }] }}
            unit="Hz"
            digits={2}
          />
        </Panel>
      </div>
      {extras}
    </div>
  );
}

// ====================================================================== grid

export function GridSection({ deviceId, span, periodText, isToday, live, tariff, extras }: SectionProps) {
  const keys = ["grid_total_power_w", "grid_l1_voltage_v", "grid_frequency_hz"];
  const curves = useDayCurves(deviceId, keys);
  const period = usePeriodSeries(deviceId, keys, span);
  const history = useDailyHistory(deviceId, [DAY_KEYS.imported, DAY_KEYS.exported, DAY_KEYS.pv, DAY_KEYS.load, DAY_KEYS.charged], span);
  if (history.error) return <ChartErrorCard title="Grid history" message={history.error} onRetry={history.retry} />;

  const daily = (key: string) => dailySeries(history.days, history.counter(key), live[key], history.today);
  const importDaily = daily(DAY_KEYS.imported);
  const exportDaily = daily(DAY_KEYS.exported);
  const periodImport = sumOf(importDaily.map((p) => p.value));
  const periodExport = sumOf(exportDaily.map((p) => p.value));
  const periodPv = sumOf(daily(DAY_KEYS.pv).map((p) => p.value));
  const periodLoad = sumOf(daily(DAY_KEYS.load).map((p) => p.value));
  const periodCharged = sumOf(daily(DAY_KEYS.charged).map((p) => p.value));
  const diverging = pairByDay(history.days, exportDaily, importDaily);
  const net = periodExport - periodImport;
  const notFromGrid = Math.max(0, periodLoad - periodImport);
  const solarShare = selfConsumptionPct(periodPv, periodExport);
  const splitPeriod = solarSplit(periodPv, periodExport, periodCharged);
  const splitLife = solarSplit(live[LIFETIME_KEYS.pv], live[LIFETIME_KEYS.exported], live[LIFETIME_KEYS.charged]);
  const peakImportW = maxOf(period.max("grid_total_power_w"));
  const peakExportW = minOf(period.min("grid_total_power_w"));
  const peakImport = peakAt(period.axis, period.max("grid_total_power_w"));
  const power = (c: Record<string, (number | null)[]>) => scaleCurve(c.grid_total_power_w ?? [], 0.001);
  const when = isToday ? "today" : periodText;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label={`Imported · ${when}`} value={fmtKwhText(periodImport)} hint={`${fmtKwhText(live[LIFETIME_KEYS.imported])} lifetime`} />
        <StatTile label={`Exported · ${when}`} value={fmtKwhText(periodExport)} hint={`${fmtKwhText(live[LIFETIME_KEYS.exported])} lifetime`} />
        <StatTile label={`Net exported · ${when}`} value={fmtKwhText(net)} hint="Exported − imported" tone={net > 0 ? "good" : "neutral"} />
        <StatTile label={`Solar sent to the grid · ${when}`} value={fmtPct(pct(periodExport, periodPv))} hint={solarShare === null ? undefined : `${solarShare.toFixed(0)}% used on site`} />
        <StatTile label={`Bill avoided · ${when} (estimate)`} value={`₹${(notFromGrid * tariff).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} hint={`Energy not bought, at ₹${tariff.toFixed(2)}/kWh`} />
        <StatTile
          label={`Peak import · ${when}`}
          value={peakImportW === null || peakImportW <= 0 ? "—" : `${(peakImportW / 1000).toFixed(2)} kW`}
          hint={`${peakExportW !== null && peakExportW < 0 ? `Peak export ${(-peakExportW / 1000).toFixed(2)} kW` : "No export"}${peakImport ? ` · import at ${period.minutes >= 1440 ? dateOf(peakImport.t) : whenText(peakImport.t, isToday, period.minutes)}` : ""}`}
        />
      </div>

      <Panel chart title={`Grid power · ${when}`} description={`Above zero you are buying from the grid; below zero you are selling to it.${isToday ? " The dashed line is yesterday." : ""}`}>
        <RangeLines
          isToday={isToday}
          todayAxis={curves.axis}
          todaySeries={[
            { key: "today", label: "Today", color: FLOW.drawing, values: untilNow(power(curves.today), curves.axis, curves.nowMs) },
            { key: "yesterday", label: "Yesterday", color: FLOW.drawing, values: power(curves.yesterday), dashed: true },
          ]}
          period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "g", label: "Grid power", color: FLOW.drawing, values: scaleCurve(period.avg("grid_total_power_w"), 0.001) }] }}
          unit="kW"
          digits={2}
          zeroLine
        />
      </Panel>

      {!isToday && (
        <Panel chart title="Exported vs imported" description={`Each day, over ${periodText}: ${periodExport.toFixed(1)} kWh sold, ${periodImport.toFixed(1)} kWh bought.`}>
          <DivergingBarChart data={diverging} positiveLabel="Exported" negativeLabel="Imported" unit="kWh" positiveColor={FLOW.consuming} negativeColor={FLOW.drawing} />
        </Panel>
      )}

      <Panel title={`Where your solar energy went · ${when}`} description="An estimate from the energy counters.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{isToday ? "Today" : periodText}</p>
            {splitPeriod ? <SplitBar parts={splitPeriod} colors={[BLUE, GREEN, ORANGE]} /> : <p className="text-sm text-muted-foreground">No data yet.</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Lifetime</p>
            {splitLife ? <SplitBar parts={splitLife} colors={[BLUE, GREEN, ORANGE]} /> : <p className="text-sm text-muted-foreground">No data yet.</p>}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel chart title={`Grid voltage · ${when}`} description="Mains voltage at your inverter.">
          <RangeLines
            isToday={isToday}
            todayAxis={curves.axis}
            todaySeries={[{ key: "v", label: "Voltage", color: VOLT, values: untilNow(curves.today.grid_l1_voltage_v ?? [], curves.axis, curves.nowMs) }]}
            period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "v", label: "Voltage", color: VOLT, values: period.avg("grid_l1_voltage_v") }] }}
            unit="V"
            digits={0}
          />
        </Panel>
        <Panel chart title={`Grid frequency · ${when}`} description="Should stay within 50 ± 0.5 Hz.">
          <RangeLines
            isToday={isToday}
            todayAxis={curves.axis}
            todaySeries={[{ key: "f", label: "Frequency", color: FREQ, values: untilNow(curves.today.grid_frequency_hz ?? [], curves.axis, curves.nowMs) }]}
            period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "f", label: "Frequency", color: FREQ, values: period.avg("grid_frequency_hz") }] }}
            unit="Hz"
            digits={2}
          />
        </Panel>
      </div>

      {isToday && (
        <Panel title="Energy meter (CT clamp)" description="What the clamp on your grid cable measures right now.">
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Total power" value={live.grid_ct_total_power_w === null || live.grid_ct_total_power_w === undefined ? "—" : `${(live.grid_ct_total_power_w / 1000).toFixed(2)} kW`} />
            <StatTile label="Power L1" value={live.grid_ct_l1_power_w === null || live.grid_ct_l1_power_w === undefined ? "—" : `${live.grid_ct_l1_power_w.toFixed(0)} W`} />
            <StatTile label="Current L1" value={`${fmtNum(live.grid_ct_l1_current_a, 2)} A`} />
          </div>
        </Panel>
      )}
      {extras}
    </div>
  );
}
