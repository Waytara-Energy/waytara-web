"use client";

import * as React from "react";
import { co2AvoidedKg, treesEquivalent } from "@/lib/environmental-impact";
import { DAY_KEYS, LIFETIME_KEYS, solarInsights, type DayRow } from "@/lib/performance-metrics";
import { dailySeries, minOf, peakAt, sumOf } from "@/lib/performance-period";
import { TEMPERATURE_MAX_C } from "@/lib/temperature-thresholds";
import { DAY_MS, windowFor, type RangeWindow } from "@/lib/telemetry/ranges";
import { ChartErrorCard } from "./chart-states";
import { dayLabel, LONG_SPAN_DAYS, scaleCurve, useDailyHistory, useDayCurves, untilNow, usePeriodSeries } from "./perf-data";
import { DailyBars, DonutShare, fmtKwhText, InsightList, Panel, RangeLines, StackedDailyBars, StatTile } from "./perf-kit";

const PV_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)"];

/** Adds several curves slot by slot (null where none of them has a reading). */
export function sumCurves(curves: (number | null)[][]): (number | null)[] {
  const length = Math.max(0, ...curves.map((c) => c.length));
  return Array.from({ length }, (_, i) => {
    let total = 0;
    let any = false;
    for (const c of curves) {
      const v = c[i];
      if (v !== null && v !== undefined) {
        total += v;
        any = true;
      }
    }
    return any ? total : null;
  });
}

const clock = (t: number) => new Date(t + 19_800_000).toISOString().slice(11, 16);
const dateOf = (t: number) => new Date(t + 19_800_000).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const inputNumber = (key: string) => Number(/^pv(\d+)_/.exec(key)?.[1] ?? 0);

export function SolarSection({
  deviceId,
  span,
  periodText,
  isToday,
  live,
  tariff,
  pvKeys,
  kwp,
  extras,
}: {
  deviceId: string;
  span: RangeWindow;
  periodText: string;
  isToday: boolean;
  live: Record<string, number | null>;
  tariff: number;
  pvKeys: string[];
  /** Installed solar size (kWp) from the panels allocated to this inverter. */
  kwp: number | null;
  extras?: React.ReactNode;
}) {
  const inputs = pvKeys.map((key, i) => ({ key, n: inputNumber(key), color: PV_COLORS[i % PV_COLORS.length], volt: `pv${inputNumber(key)}_voltage_v`, amp: `pv${inputNumber(key)}_current_a` }));
  const curveKeys = inputs.flatMap((p) => [p.key, p.volt, p.amp]);
  const keys = curveKeys.length > 0 ? curveKeys : ["inverter_output_power_w"];
  const curves = useDayCurves(deviceId, keys);
  const period = usePeriodSeries(deviceId, keys, span);
  const history = useDailyHistory(deviceId, [DAY_KEYS.pv, ...pvKeys], span);
  // The findings always read the last 30 days, whatever period is chosen (a few days say little about dust or shading).
  const [nowMs] = React.useState(() => Date.now());
  const monthWindow = React.useMemo(() => windowFor("30d", nowMs), [nowMs]);
  const month = useDailyHistory(deviceId, [DAY_KEYS.pv, ...pvKeys], monthWindow);

  if (history.error) return <ChartErrorCard title="Solar history" message={history.error} onRetry={history.retry} />;

  const when = isToday ? "today" : periodText;
  const kw = (v: (number | null)[]) => scaleCurve(v, 0.001);

  // --- the chosen period, one value per day
  const daily = dailySeries(history.days, history.counter(DAY_KEYS.pv), live[DAY_KEYS.pv], history.today);
  const periodTotal = sumOf(daily.map((p) => p.value));
  const best = daily.reduce<{ date: string; value: number } | null>((b, p) => (b === null || p.value > b.value ? p : b), null);
  const monthDaily = dailySeries(month.days, month.counter(DAY_KEYS.pv), live[DAY_KEYS.pv], month.today);
  const yesterdayKwh = monthDaily.length >= 2 && monthDaily[monthDaily.length - 1].date === month.today ? monthDaily[monthDaily.length - 2].value : null;
  const monthAverage = monthDaily.length > 0 ? sumOf(monthDaily.map((p) => p.value)) / monthDaily.length : null;

  // --- power: the sum of the PV inputs, over the period and today
  const totalToday = kw(sumCurves(inputs.map((p) => curves.today[p.key] ?? [])));
  const totalYesterday = kw(sumCurves(inputs.map((p) => curves.yesterday[p.key] ?? [])));
  const totalPeriod = kw(sumCurves(inputs.map((p) => period.avg(p.key))));
  const peak = peakAt(period.axis, totalPeriod);
  const peakText = peak ? (period.minutes >= 1440 ? `On ${dateOf(peak.t)} (daily average)` : `At ${isToday ? clock(peak.t) : `${dateOf(peak.t)} ${clock(peak.t)}`}`) : undefined;

  const perInputKwh = inputs.map((p) => sumOf(history.powerEnergyKwh(p.key)));
  const stackedRows = history.days
    .map((d, i) => ({ label: dayLabel(d, history.days.length > LONG_SPAN_DAYS), ...Object.fromEntries(inputs.map((p) => [p.key, history.powerEnergyKwh(p.key)[i] ?? 0])) }))
    .filter((_, i) => inputs.some((p) => history.powerEnergyKwh(p.key)[i] !== null));

  // --- findings (from the last 30 days)
  const monthKwh = month.counter(DAY_KEYS.pv);
  const todayIso = month.days[month.days.length - 1];
  const dayRows: DayRow[] = month.days
    .map((d, i) => ({ day: d, kwh: monthKwh[i], inputs: inputs.map((p) => month.powerEnergyKwh(p.key)[i] ?? null) }))
    .filter((r) => r.day !== todayIso);
  const ratios = [live.inverter_ac_temperature_c, live.inverter_dc_temperature_c].map((t, i) => (t === null || t === undefined ? null : t / (i === 0 ? TEMPERATURE_MAX_C.inverter_ac_temperature_c : TEMPERATURE_MAX_C.inverter_dc_temperature_c)));
  const hottest = ratios.reduce<number | null>((m, r) => (r === null ? m : m === null ? r : Math.max(m, r)), null);
  const insights = solarInsights({ days: dayRows, tariffPerKwh: tariff, hottestRatio: hottest });

  const lifetime = live[LIFETIME_KEYS.pv];
  const co2 = lifetime !== null && lifetime !== undefined ? co2AvoidedKg(lifetime) : null;
  const perDay = daily.length > 0 ? periodTotal / daily.length : null;
  const yieldPerDay = kwp !== null && perDay !== null ? perDay / kwp : null;
  const spanDays = (span.toMs - span.fromMs) / DAY_MS;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Produced, lifetime" value={fmtKwhText(lifetime)} hint={co2 !== null ? `${co2.toFixed(0)} kg CO₂ avoided · ${treesEquivalent(co2).toFixed(1)} trees a year` : undefined} />
        <StatTile label={`Produced · ${when}`} value={fmtKwhText(periodTotal)} hint={isToday ? (peakText ? `Peak ${peakText.toLowerCase()}` : "No sun yet") : `${daily.length} day${daily.length === 1 ? "" : "s"} of data`} />
        {isToday ? <StatTile label="Yesterday" value={fmtKwhText(yesterdayKwh)} /> : <StatTile label={`Average per day · ${periodText}`} value={fmtKwhText(perDay)} hint={`${daily.length} day${daily.length === 1 ? "" : "s"} of data`} />}
        {isToday ? (
          <StatTile label="Average · last 30 days" value={fmtKwhText(monthAverage)} hint="Per day, to compare today with" />
        ) : (
          <StatTile label={`Best day · ${periodText}`} value={fmtKwhText(best?.value ?? null)} hint={best ? dayLabel(best.date) : undefined} tone="good" />
        )}
        <StatTile label={`Peak power · ${when}`} value={peak ? `${peak.v.toFixed(2)} kW` : "—"} hint={peakText} />
        {kwp !== null ? (
          <StatTile
            label={`Yield · ${when}`}
            value={isToday ? (perDay === null ? "—" : `${(perDay / kwp).toFixed(2)} kWh/kWp`) : yieldPerDay === null ? "—" : `${yieldPerDay.toFixed(2)} kWh/kWp a day`}
            hint={`${kwp.toFixed(2)} kWp installed · 4–5 is a good day`}
          />
        ) : (
          <StatTile label={`Lowest day · ${when}`} value={fmtKwhText(daily.length > 0 ? (minOf(daily.map((p) => p.value)) ?? null) : null)} />
        )}
      </div>

      <Panel title="Solar health" description="What the last 30 days of production say about your panels, in plain words (not tied to the period chosen above).">
        <InsightList insights={insights} />
      </Panel>

      <Panel title={`Production · ${when}`} description={`Total of your PV inputs${peak ? `, peaking at ${peak.v.toFixed(2)} kW ${period.minutes >= 1440 ? `on ${dateOf(peak.t)}` : `at ${isToday ? clock(peak.t) : `${dateOf(peak.t)} ${clock(peak.t)}`}`}` : isToday ? ", waiting for the sun" : ""}.${isToday ? " The dashed line is yesterday." : ""}`}>
        <RangeLines
          isToday={isToday}
          todayAxis={curves.axis}
          todaySeries={[
            { key: "today", label: "Today", color: "var(--chart-3)", values: untilNow(totalToday, curves.axis, curves.nowMs) },
            { key: "yesterday", label: "Yesterday", color: "var(--chart-3)", values: totalYesterday, dashed: true },
          ]}
          period={{ axis: period.axis, minutes: period.minutes, series: [{ key: "pv", label: "Solar", color: "var(--chart-3)", values: totalPeriod }] }}
          unit="kW"
        />
      </Panel>

      {!isToday && (
        <Panel title="Daily production" description={`Energy produced each day over ${periodText}.`}>
          <DailyBars daily={daily} label="Produced" color="var(--chart-3)" />
        </Panel>
      )}

      {kwp !== null && !isToday && (
        <Panel
          title="Yield per kWp"
          description={`Energy per kW of panels each day, so any size of system can be compared - ${kwp.toFixed(2)} kWp installed.${yieldPerDay !== null ? ` Average ${yieldPerDay.toFixed(2)} kWh/kWp a day over ${periodText}` : ""}${lifetime !== null && lifetime !== undefined ? `, ${(lifetime / kwp).toFixed(0)} kWh/kWp since commissioning` : ""}. 4-5 is typical for a good day in India.`}
        >
          <DailyBars daily={daily.map((p) => ({ date: p.date, value: p.value / kwp }))} label="Yield" unit="kWh/kWp" digits={2} color="var(--chart-1)" />
        </Panel>
      )}

      {inputs.length > 1 && (
        <Panel title={`PV1 vs PV2 · ${when}`} description="Each input's share of the energy over this period.">
          <div className="space-y-5">
            <DonutShare parts={inputs.map((p, i) => ({ label: `PV${p.n}`, value: perInputKwh[i], color: p.color }))} center={`${fmtKwhText(sumOf(perInputKwh))}`} />
            {spanDays > 1 && <StackedDailyBars rows={stackedRows} series={inputs.map((p) => ({ key: p.key, label: `PV${p.n}`, color: p.color }))} />}
          </div>
        </Panel>
      )}

      {inputs.length > 0 && (
        <Panel title={`PV power · ${when}`} description="What each input is delivering. The two should follow the same shape unless the panels face different ways.">
          <RangeLines
            isToday={isToday}
            todayAxis={curves.axis}
            todaySeries={inputs.map((p) => ({ key: p.key, label: `PV${p.n}`, color: p.color, values: untilNow(kw(curves.today[p.key] ?? []), curves.axis, curves.nowMs) }))}
            period={{ axis: period.axis, minutes: period.minutes, series: inputs.map((p) => ({ key: p.key, label: `PV${p.n}`, color: p.color, values: kw(period.avg(p.key)) })) }}
            unit="kW"
            digits={2}
          />
        </Panel>
      )}

      {inputs.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={`PV voltage · ${when}`} description="A steady curve is healthy; sudden drops can mean shading.">
            <RangeLines
              isToday={isToday}
              todayAxis={curves.axis}
              todaySeries={inputs.map((p) => ({ key: p.volt, label: `PV${p.n}`, color: p.color, values: untilNow(curves.today[p.volt] ?? [], curves.axis, curves.nowMs) }))}
              period={{ axis: period.axis, minutes: period.minutes, series: inputs.map((p) => ({ key: p.volt, label: `PV${p.n}`, color: p.color, values: period.avg(p.volt) })) }}
              unit="V"
              digits={0}
            />
          </Panel>
          <Panel title={`PV current · ${when}`} description="Current follows the sunlight; both inputs should rise and fall together.">
            <RangeLines
              isToday={isToday}
              todayAxis={curves.axis}
              todaySeries={inputs.map((p) => ({ key: p.amp, label: `PV${p.n}`, color: p.color, values: untilNow(curves.today[p.amp] ?? [], curves.axis, curves.nowMs) }))}
              period={{ axis: period.axis, minutes: period.minutes, series: inputs.map((p) => ({ key: p.amp, label: `PV${p.n}`, color: p.color, values: period.avg(p.amp) })) }}
              unit="A"
            />
          </Panel>
        </div>
      )}

      {extras}
    </div>
  );
}
