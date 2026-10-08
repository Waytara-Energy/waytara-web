"use client";

import * as React from "react";
import { co2AvoidedKg, treesEquivalent } from "@/lib/environmental-impact";
import { DAY_KEYS, LIFETIME_KEYS, solarInsights, type DayRow } from "@/lib/performance-metrics";
import { TEMPERATURE_MAX_C } from "@/lib/temperature-thresholds";
import { ChartErrorCard } from "./chart-states";
import { PerformanceChart } from "./lazy-charts";
import { dayLabel, scaleCurve, useDailyHistory, useDayCurves, untilNow, type HistoryPreset } from "./perf-data";
import { fmtKwhText, fmtNum, InsightList, LineSeriesChart, Panel, StackedDailyBars, StatTile, DonutShare } from "./perf-kit";

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

function peakOfCurve(axis: number[], values: (number | null)[]): { v: number; t: number } | null {
  let best: { v: number; t: number } | null = null;
  values.forEach((v, i) => {
    if (v !== null && v > 0 && (best === null || v > best.v)) best = { v, t: axis[i] };
  });
  return best;
}

const clock = (t: number) => new Date(t + 19_800_000).toISOString().slice(11, 16);
const inputNumber = (key: string) => Number(/^pv(\d+)_/.exec(key)?.[1] ?? 0);

export function SolarSection({
  deviceId,
  preset,
  live,
  tariff,
  pvKeys,
  kwp,
  extras,
}: {
  deviceId: string;
  preset: HistoryPreset;
  live: Record<string, number | null>;
  tariff: number;
  pvKeys: string[];
  /** Installed solar size (kWp) from the panels allocated to this inverter. */
  kwp: number | null;
  extras?: React.ReactNode;
}) {
  const inputs = pvKeys.map((key, i) => ({ key, n: inputNumber(key), color: PV_COLORS[i % PV_COLORS.length], volt: `pv${inputNumber(key)}_voltage_v`, amp: `pv${inputNumber(key)}_current_a` }));
  const curveKeys = inputs.flatMap((p) => [p.key, p.volt, p.amp]);
  const curves = useDayCurves(deviceId, curveKeys.length > 0 ? curveKeys : ["inverter_output_power_w"]);
  const history = useDailyHistory(deviceId, [DAY_KEYS.pv, ...pvKeys], preset);
  const month = useDailyHistory(deviceId, [DAY_KEYS.pv, ...pvKeys], "30d");

  if (history.error) return <ChartErrorCard title="Solar history" message={history.error} onRetry={history.retry} />;

  // --- today
  const todayTotal = untilNow(scaleCurve(sumCurves(inputs.map((p) => curves.today[p.key] ?? [])), 0.001), curves.axis, curves.nowMs);
  const yesterdayTotal = scaleCurve(sumCurves(inputs.map((p) => curves.yesterday[p.key] ?? [])), 0.001);
  const peak = peakOfCurve(curves.axis, todayTotal);

  // --- the chosen period, one value per day
  const dailyKwh = history.counter(DAY_KEYS.pv);
  const daily = history.days.flatMap((d, i) => (dailyKwh[i] !== null ? [{ date: d, value: dailyKwh[i] as number }] : []));
  const periodTotal = daily.reduce((s, p) => s + p.value, 0);
  const best = daily.reduce<{ date: string; value: number } | null>((b, p) => (b === null || p.value > b.value ? p : b), null);
  const yesterdayKwh = daily.length >= 2 ? daily[daily.length - 2].value : null;

  const perInputKwh = inputs.map((p) => history.powerEnergyKwh(p.key).reduce<number>((s, v) => s + (v ?? 0), 0));
  const stackedRows = history.days.map((d, i) => ({ label: dayLabel(d), ...Object.fromEntries(inputs.map((p) => [p.key, history.powerEnergyKwh(p.key)[i] ?? 0])) })).filter((_, i) => inputs.some((p) => history.powerEnergyKwh(p.key)[i] !== null));

  // --- findings (always from the last 30 days, whatever period is chosen)
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Produced, lifetime" value={fmtKwhText(lifetime)} hint={co2 !== null ? `${co2.toFixed(0)} kg CO₂ avoided · ${treesEquivalent(co2).toFixed(1)} trees a year` : undefined} />
        <StatTile label="Produced today" value={fmtKwhText(live[DAY_KEYS.pv])} hint={peak ? `Peak ${peak.v.toFixed(2)} kW at ${clock(peak.t)}` : "No sun yet"} />
        <StatTile label="Yesterday" value={fmtKwhText(yesterdayKwh)} />
        <StatTile label={`Average per day · ${preset.replace("d", " days")}`} value={fmtKwhText(daily.length > 0 ? periodTotal / daily.length : null)} hint={`${daily.length} day${daily.length === 1 ? "" : "s"} of data`} />
        <StatTile label="Best day" value={fmtKwhText(best?.value ?? null)} hint={best ? dayLabel(best.date) : undefined} tone="good" />
        <StatTile label={`Produced · ${preset.replace("d", " days")}`} value={fmtKwhText(periodTotal || null)} />
      </div>

      {kwp !== null && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Installed solar size" value={`${kwp.toFixed(2)} kWp`} hint="From the panels fitted to your system" />
          <StatTile label="Yield today" value={live[DAY_KEYS.pv] === null || live[DAY_KEYS.pv] === undefined ? "—" : `${((live[DAY_KEYS.pv] as number) / kwp).toFixed(2)} kWh/kWp`} hint="Energy per kWp, to compare any size of system" />
          <StatTile label={`Average yield per day · ${preset.replace("d", " days")}`} value={daily.length > 0 ? `${(periodTotal / daily.length / kwp).toFixed(2)} kWh/kWp` : "—"} hint="4–5 is typical for a good day in India" />
          <StatTile label="Yield, lifetime" value={lifetime === null || lifetime === undefined ? "—" : `${(lifetime / kwp).toFixed(0)} kWh/kWp`} />
        </div>
      )}

      <Panel title="Solar health" description="What your production says about your panels, in plain words.">
        <InsightList insights={insights} />
      </Panel>

      <Panel title="Today's production" description={`Total of your PV inputs, ${peak ? `peaking at ${peak.v.toFixed(2)} kW at ${clock(peak.t)}` : "waiting for the sun"}. The dashed line is yesterday.`}>
        <LineSeriesChart
          axis={curves.axis}
          unit="kW"
          series={[
            { key: "today", label: "Today", color: "var(--chart-3)", values: todayTotal },
            { key: "yesterday", label: "Yesterday", color: "var(--chart-3)", values: yesterdayTotal, dashed: true },
          ]}
        />
      </Panel>

      <Panel title="Daily production" description="Energy produced each day. Switch to weekly or monthly totals above the chart.">
        <PerformanceChart daily={daily} unit="kWh" />
      </Panel>

      {inputs.length > 1 && (
        <Panel title="PV1 vs PV2" description="Each input's share of the energy over this period, and what each is delivering right now.">
          <div className="space-y-5">
            <DonutShare parts={inputs.map((p, i) => ({ label: `PV${p.n}`, value: perInputKwh[i], color: p.color }))} center={`${fmtKwhText(perInputKwh.reduce((a, b) => a + b, 0))}`} />
            <div className="grid gap-3 sm:grid-cols-2">
              {inputs.map((p) => (
                <div key={p.key} className="rounded-xl border border-border p-3.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: p.color }} />
                    PV{p.n}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-semibold tabular-nums">{fmtNum(live[p.key] === null || live[p.key] === undefined ? null : (live[p.key] as number) / 1000, 2)}</p>
                      <p className="text-[11px] text-muted-foreground">kW</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold tabular-nums">{fmtNum(live[p.volt], 0)}</p>
                      <p className="text-[11px] text-muted-foreground">Volts</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold tabular-nums">{fmtNum(live[p.amp], 1)}</p>
                      <p className="text-[11px] text-muted-foreground">Amps</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <StackedDailyBars rows={stackedRows} series={inputs.map((p) => ({ key: p.key, label: `PV${p.n}`, color: p.color }))} />
          </div>
        </Panel>
      )}

      {inputs.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="PV voltage today" description="A steady curve is healthy; sudden drops can mean shading.">
            <LineSeriesChart axis={curves.axis} unit="V" digits={0} series={inputs.map((p) => ({ key: p.volt, label: `PV${p.n}`, color: p.color, values: untilNow(curves.today[p.volt] ?? [], curves.axis, curves.nowMs) }))} />
          </Panel>
          <Panel title="PV current today" description="Current follows the sunlight; both inputs should rise and fall together.">
            <LineSeriesChart axis={curves.axis} unit="A" series={inputs.map((p) => ({ key: p.amp, label: `PV${p.n}`, color: p.color, values: untilNow(curves.today[p.amp] ?? [], curves.axis, curves.nowMs) }))} />
          </Panel>
        </div>
      )}

      {extras}
    </div>
  );
}
