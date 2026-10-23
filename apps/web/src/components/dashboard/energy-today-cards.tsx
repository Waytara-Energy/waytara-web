"use client";

import * as React from "react";
import { areaPoints, deltaPct, recentPoints, RECENT_WINDOW_MS, peakOf, slotIndex, TODAY_COUNTER_KEYS as K } from "@/lib/energy-today";
import { istDayStart } from "@/lib/telemetry/combine";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { useUnits } from "@/components/units-provider";
import { useSeriesRange, useTodaySeries } from "@/lib/telemetry/react";
import type { OverviewCardId } from "@/lib/overview-prefs";
import { TodayStatCard } from "./today-stat-card";
import { FLOW } from "./flow-colors";

const DAY_MS = 86_400_000;
const GREEN: string = FLOW.producing;
const AMBER: string = FLOW.drawing;
const BLUE: string = FLOW.consuming;

/** Yesterday's counters at this time of day (the slot that contains "now minus 24 hours"), from the 15-minute rollups. */
function useYesterdayAtThisTime(deviceId: string, keys: string[], nowMs: number): Record<string, number | null> {
  const yStart = istDayStart(nowMs) - DAY_MS;
  const win = React.useMemo(() => ({ fromMs: yStart, toMs: yStart + DAY_MS }), [yStart]);
  const state = useSeriesRange(deviceId, keys, win, 15);
  const i = slotIndex(state.axis, nowMs - DAY_MS);
  const out: Record<string, number | null> = {};
  for (const k of keys) out[k] = state.status === "ready" && i !== null ? (state.byKey[k]?.[i]?.last ?? null) : null;
  return out;
}

const istClock = (ms: number) => new Date(ms + 19_800_000).toISOString().slice(11, 16);

/** Overview's "today" cards, each opening its Monitoring tab: solar generated, grid, load consumption, battery, self-powered, sent to and
 *  bought from the grid. `cards` says which ones to draw here, in order (the person chooses four in Application Settings; two sit on each
 *  side of the energy flow). The totals are the inverter's own day counters (live, in place); the dots are today's readings. */
export function EnergyTodayCards({
  inverterId,
  initial,
  pvKeys,
  cards,
}: {
  inverterId: string;
  initial: Record<string, number | null>;
  /** Accepted for the callers' shared props. */
  sync?: unknown;
  pvKeys: string[];
  /** The cards to draw, in order. */
  cards: OverviewCardId[];
}) {
  // numbers in the unit the person chose for energy and power (Application Settings > Units), else as the inverter reports them
  const u = useUnits();
  const kwhNumber = (v: number | null, key?: string) => (v === null ? "—" : u.format(v, "kWh", key, v >= 100 ? 0 : 1, false));
  const fmtKwh = (v: number | null, key?: string) => (v === null || !Number.isFinite(v) ? "—" : u.format(v, "kWh", key, v >= 100 ? 0 : 1));
  const solarKeys = pvKeys.length > 0 ? pvKeys : ["inverter_output_power_w"];
  const counterKeys = [K.solar, K.load, K.charged, K.discharged, K.imported, K.exported];
  const powerKeys = [...solarKeys, "load_total_power_w", "battery_power_w", "grid_total_power_w"];

  const n = useLiveNumbers([inverterId], counterKeys, initial);
  const series = useTodaySeries(inverterId, powerKeys, 15);
  const yesterday = useYesterdayAtThisTime(inverterId, [K.solar, K.load], series.nowMs);
  // Early in the day the last two hours reach back before midnight, so yesterday's evening readings are read too (only then).
  const dayStart = istDayStart(series.nowMs);
  const earlyInDay = series.nowMs - dayStart < RECENT_WINDOW_MS;
  const yesterdayWindow = React.useMemo(() => ({ fromMs: dayStart - DAY_MS, toMs: dayStart }), [dayStart]);
  const evening = useSeriesRange(inverterId, earlyInDay ? powerKeys : [], yesterdayWindow, 15);

  // The curve of one or more power keys (summed), scaled to kW, oldest first: today's slots, with yesterday's in front of them when
  // the last two hours reach back across midnight.
  const curve = (keys: string[], sign: 1 | -1 = 1) => {
    const sumAt = (byKey: typeof series.byKey, i: number) => {
      let sum = 0;
      let any = false;
      for (const k of keys) {
        const v = byKey[k]?.[i]?.avg;
        if (v !== null && v !== undefined) {
          sum += v;
          any = true;
        }
      }
      return any ? sum * sign : null;
    };
    const axis = [...evening.axis, ...series.axis];
    const values = axis.map((_, i) => (i < evening.axis.length ? sumAt(evening.byKey, i) : sumAt(series.byKey, i - evening.axis.length)));
    return areaPoints(axis, values, series.nowMs, 0.001);
  };

  const solarCurve = curve(solarKeys);
  const loadCurve = curve(["load_total_power_w"]);
  const batteryCurve = curve(["battery_power_w"], -1); // the inverter reports discharging as positive; charging is drawn as the main colour
  const gridCurve = curve(["grid_total_power_w"]);

  // What sits under a total: the comparison with yesterday at this time when there is one, otherwise today's peak.
  const versus = (today: number | null, yest: number | null, curveOf: ReturnType<typeof curve>, higherIsGood: boolean) => {
    const d = deltaPct(today, yest);
    const peak = peakOf(curveOf.filter((p) => p.t >= dayStart)); // today's peak only
    const detail = d !== null ? `${Math.abs(Math.round(d))}% ${d >= 0 ? "more" : "less"} than yesterday` : peak ? `Peak ${u.format(peak.v, "kW", null, 1)} at ${istClock(peak.t)}` : "No readings yet";
    return { detail, trend: d === null ? null : { direction: d >= 0 ? ("up" as const) : ("down" as const), good: (d >= 0) === higherIsGood } };
  };

  const solar = versus(n[K.solar], yesterday[K.solar], solarCurve, true);
  const load = versus(n[K.load], yesterday[K.load], loadCurve, false);

  const stored = n[K.charged] !== null && n[K.discharged] !== null ? n[K.charged]! - n[K.discharged]! : null;
  const exported = n[K.exported] !== null && n[K.imported] !== null ? n[K.exported]! - n[K.imported]! : null;
  const monitoring = (tab: string) => `/dashboard/monitoring?device=${inverterId}#${tab}`;

  const solarCard = (
      <TodayStatCard
        title="Solar generated today"
        deviceId={inverterId}
        href={monitoring("solar")}
        value={kwhNumber(n[K.solar], K.solar)}
        unit={u.unit("kWh", K.solar)}
        trend={solar.trend}
        detail={solar.detail}
        points={recentPoints(solarCurve, series.nowMs)}
        now={series.nowMs}
        posColor={FLOW.producing}
        posLabel="Solar"
      />
  );

  const gridCard = (
      <TodayStatCard
        title="Grid usage today"
        deviceId={inverterId}
      href={monitoring("grid")}
        value={kwhNumber(exported === null ? null : Math.abs(exported), K.exported)}
        unit={u.unit("kWh", K.exported)}
        trend={exported === null ? null : { direction: exported >= 0 ? "up" : "down", good: exported >= 0 }}
        detail={`Net ${exported !== null && exported < 0 ? "import" : "export"} · ${fmtKwh(n[K.exported])} out, ${fmtKwh(n[K.imported])} in`}
        points={recentPoints(gridCurve, series.nowMs)}
        now={series.nowMs}
        posColor={AMBER}
        negColor={BLUE}
        posLabel="Importing"
        negLabel="Exporting"
      />
  );

  const loadCard = (
      <TodayStatCard
        title="Load consumption today"
        deviceId={inverterId}
        href={monitoring("load")}
        value={kwhNumber(n[K.load], K.load)}
        unit={u.unit("kWh", K.load)}
        trend={load.trend}
        detail={load.detail}
        points={recentPoints(loadCurve, series.nowMs)}
        now={series.nowMs}
        posColor={FLOW.consuming}
        posLabel="Load"
      />
  );

  const batteryCard = (
      <TodayStatCard
        title="Battery usage today"
        deviceId={inverterId}
        href={monitoring("battery")}
        value={kwhNumber(stored === null ? null : Math.abs(stored), K.charged)}
        unit={u.unit("kWh", K.charged)}
        trend={stored === null ? null : { direction: stored >= 0 ? "up" : "down", good: stored >= 0 }}
        detail={`Net ${stored !== null && stored < 0 ? "used" : "stored"} · ${fmtKwh(n[K.charged])} in, ${fmtKwh(n[K.discharged])} out`}
        points={recentPoints(batteryCurve, series.nowMs)}
        now={series.nowMs}
        posColor={GREEN}
        negColor={AMBER}
        posLabel="Charging"
        negLabel="Discharging"
      />
  );

  // How much of today's use did not come from the grid, and where the exported and imported energy stands against solar and load.
  const imported = n[K.imported];
  const selfPowered = n[K.load] !== null && n[K.load]! > 0 && imported !== null ? Math.min(100, Math.max(0, (1 - imported / n[K.load]!) * 100)) : null;

  const selfPoweredCard = (
    <TodayStatCard
      title="Self-powered today"
      deviceId={inverterId}
      href={monitoring("grid")}
      value={selfPowered === null ? "—" : selfPowered.toFixed(0)}
      unit="%"
      trend={null}
      detail={n[K.load] !== null && imported !== null ? `${fmtKwh(imported)} bought from the grid of ${fmtKwh(n[K.load])} used` : "No readings yet"}
      points={recentPoints(gridCurve, series.nowMs)}
      now={series.nowMs}
      posColor={AMBER}
      negColor={BLUE}
      posLabel="Importing"
      negLabel="Exporting"
    />
  );

  const exportedCard = (
    <TodayStatCard
      title="Sent to the grid today"
      deviceId={inverterId}
      href={monitoring("grid")}
      value={kwhNumber(n[K.exported], K.exported)}
      unit={u.unit("kWh", K.exported)}
      trend={null}
      detail={n[K.exported] !== null && n[K.solar] !== null && n[K.solar]! > 0 ? `${Math.round((n[K.exported]! / n[K.solar]!) * 100)}% of the solar you made` : "Energy exported today"}
      points={recentPoints(gridCurve, series.nowMs)}
      now={series.nowMs}
      posColor={AMBER}
      negColor={BLUE}
      posLabel="Importing"
      negLabel="Exporting"
    />
  );

  const importedCard = (
    <TodayStatCard
      title="Bought from the grid today"
      deviceId={inverterId}
      href={monitoring("grid")}
      value={kwhNumber(imported, K.imported)}
      unit={u.unit("kWh", K.imported)}
      trend={null}
      detail={imported !== null && n[K.load] !== null && n[K.load]! > 0 ? `${Math.round((imported / n[K.load]!) * 100)}% of what your site used` : "Energy imported today"}
      points={recentPoints(gridCurve, series.nowMs)}
      now={series.nowMs}
      posColor={AMBER}
      negColor={BLUE}
      posLabel="Importing"
      negLabel="Exporting"
    />
  );

  const byId: Record<OverviewCardId, React.ReactNode> = {
    solar: solarCard,
    grid: gridCard,
    load: loadCard,
    battery: batteryCard,
    selfpowered: selfPoweredCard,
    exported: exportedCard,
    imported: importedCard,
  };

  return (
    <>
      {cards.map((id) => (
        <React.Fragment key={id}>{byId[id]}</React.Fragment>
      ))}
    </>
  );
}
