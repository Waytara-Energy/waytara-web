"use client";

import * as React from "react";
import Link from "next/link";
import { CarFront } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { chargingShareOfLoadPct, evPerfStats, loadKwhInSpan, type EvPerfSession } from "@/lib/ev-perf-stats";
import { formatSeconds, sessionStatusLabel } from "@/lib/ev-sessions";
import { inr } from "@/lib/savings";
import { FLOW } from "./flow-colors";
import { periodText } from "./perf-data";
import { DailyBars, DonutShare, Panel, StatTile, useKwhText } from "./perf-kit";
import { RangeBar, LONG_PRESETS } from "./range-bar";
import { RangeProvider, useRange } from "./range-context";

const when = (ts: string) => new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const kw = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)} kW`);
/** The newest sessions listed under the figures; the rest are on the Charging sessions page. */
const LIST_LIMIT = 12;

export interface EvPerformanceProps {
  deviceId: string;
  /** The charger's sessions of the last years (newest first or not: they are sorted here), as many as the page read. */
  sessions: EvPerfSession[];
  /** The home's energy use per day (the inverter's day counter), when the site has an inverter that reports it. */
  loadDaily: { ts: string; value: number }[];
  /** Rupees per kWh, when a tariff is known. */
  tariff: number | null;
}

/** Performance for an EV charger: for the period chosen with the range picker, how much it charged, how often, how fast, what powered it
 *  and what that cost; every figure is worked out in the browser from the sessions the page read. */
export function EvPerformanceBoard(props: EvPerformanceProps) {
  return (
    <RangeProvider deviceId={props.deviceId} scope="performance-ev" defaultPreset="30d">
      <Board {...props} />
    </RangeProvider>
  );
}

function Board({ sessions, loadDaily, tariff }: EvPerformanceProps) {
  const range = useRange();
  const kwh = useKwhText();
  const fromMs = range?.window.fromMs ?? 0;
  const toMs = range?.window.toMs ?? 0;
  const span = React.useMemo(() => ({ fromMs, toMs }), [fromMs, toMs]);
  const period = range ? periodText(range.preset, span) : "";
  const stats = React.useMemo(() => evPerfStats(sessions, span, tariff), [sessions, span, tariff]);
  const loadKwh = React.useMemo(() => loadKwhInSpan(loadDaily, span), [loadDaily, span]);
  const share = chargingShareOfLoadPct(stats.energyKwh, loadKwh);
  const has = stats.sessions > 0;
  const sources = stats.sources;
  const known = sources.solarKwh + sources.batteryKwh + sources.gridKwh;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CarFront className="size-7" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-theme-muted">Energy delivered · {period}</p>
            <p className="text-4xl font-semibold leading-tight tracking-tight text-theme-primary">{has ? kwh(stats.energyKwh) : "—"}</p>
          </div>
          <div className="hidden items-center gap-8 pl-6 md:flex">
            <Figure label="Sessions" value={has ? String(stats.sessions) : "—"} />
            <Figure label="Solar share" value={stats.solarSharePct === null ? "—" : `${stats.solarSharePct.toFixed(0)}%`} good={stats.solarSharePct !== null && stats.solarSharePct >= 50} />
          </div>
        </div>
        <RangeBar presets={LONG_PRESETS} />
      </div>

      {stats.sample && has && (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Sample data: this charger has no real charge yet, so these figures are from sample charges. They are replaced by the real ones with its first real charge.</p>
      )}

      {!has && (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">No charging sessions in this period. Pick a longer period, or start a charge from the Overview.</p>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
        <StatTile label={`Sessions · ${period}`} value={has ? String(stats.sessions) : "—"} hint={stats.avgSessionKwh === null ? undefined : `${kwh(stats.avgSessionKwh)} on average`} />
        <StatTile label={`Charging time · ${period}`} value={has ? formatSeconds(stats.chargingSeconds) : "—"} hint="the car was drawing power" />
        <StatTile label={`Peak power · ${period}`} value={kw(stats.peakKw)} hint="the fastest moment" />
        <StatTile label={`Average power · ${period}`} value={kw(stats.avgKw)} hint="while charging" />
      </div>

      <Panel chart title="Energy delivered per day" description={`${period} · each bar is the energy the charger delivered that day.`}>
        {has ? <DailyBars daily={stats.daily} label="Delivered" color={FLOW.consuming} unit="kWh" /> : <p className="py-8 text-center text-sm text-muted-foreground">No data in this period.</p>}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="What powered the charging" description={known > 0 ? `${period} · energy whose source is known${sources.unknownKwh > 0.05 ? `; ${kwh(sources.unknownKwh)} could not be matched to a source` : ""}.` : `${period}`}>
          {known > 0 ? (
            <DonutShare
              center={stats.solarSharePct === null ? undefined : `${stats.solarSharePct.toFixed(0)}% solar`}
              parts={[
                { label: "Solar", value: sources.solarKwh, color: FLOW.producing },
                { label: "Battery", value: sources.batteryKwh, color: FLOW.drawing },
                { label: "Grid", value: sources.gridKwh, color: FLOW.consuming },
              ].filter((p) => p.value > 0)}
            />
          ) : (
            <p className="py-6 text-sm text-muted-foreground">{has ? "The home's own figures were not available while these sessions ran, so the split is not known." : "No data in this period."}</p>
          )}
        </Panel>

        <Panel title="What it cost" description={stats.cost ? `Estimated at ₹${stats.cost.rate.toFixed(2)}/kWh. Energy without a source split counts as grid.` : "A tariff is needed to price the charging."}>
          {stats.cost && has ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <StatTile label="From the grid" value={inr(stats.cost.gridCost)} hint="paid to the board" />
              <StatTile label="Saved" value={inr(stats.cost.saved)} hint="solar and battery" tone="good" />
              <StatTile label="All from the grid" value={inr(stats.cost.allGridCost)} hint="without solar" />
            </div>
          ) : (
            <p className="py-6 text-sm text-muted-foreground">{has ? "No tariff is on file for this site yet." : "No data in this period."}</p>
          )}
        </Panel>
      </div>

      <p className="text-sm text-muted-foreground">
        {share === null
          ? "How much of the home's energy went to the car is shown when the inverter reports the home's use."
          : `Charging was ${share.toFixed(0)}% of the home's energy use in this period (${kwh(stats.energyKwh)} of ${kwh(loadKwh)}).`}
      </p>

      {has && (
        <Panel title="Charging sessions" description={`${period}${stats.rows.length > LIST_LIMIT ? ` · the newest ${LIST_LIMIT} of ${stats.rows.length}` : ""}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Energy</TableHead>
                <TableHead className="text-right">Peak</TableHead>
                <TableHead className="text-right">Solar</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.rows.slice(0, LIST_LIMIT).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-foreground">{when(r.startedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatSeconds(r.durationS)}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{r.energyKwh === null ? "—" : `${r.energyKwh.toFixed(1)} kWh`}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{kw(r.peakKw)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.solarSharePct === null ? "—" : `${r.solarSharePct.toFixed(0)}%`}</TableCell>
                  <TableCell className="text-muted-foreground">{sessionStatusLabel(r.status).label}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            <Link href="/dashboard/ev-sessions" className="underline underline-offset-2">
              All charging sessions
            </Link>{" "}
            with each charge&apos;s curve and receipt.
          </p>
        </Panel>
      )}
    </div>
  );
}

function Figure({ label, value, good = false }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <p className="text-sm font-medium text-theme-muted">{label}</p>
      <p className={`text-2xl font-semibold tracking-tight ${good ? "text-emerald-600 dark:text-emerald-400" : "text-theme-primary"}`}>{value}</p>
    </div>
  );
}
