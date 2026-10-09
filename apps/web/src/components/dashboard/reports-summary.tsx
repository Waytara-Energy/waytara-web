"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, inr } from "@/lib/savings";
import { pctChange } from "@/lib/reports/period-math";
import type { PeriodView } from "@/lib/reports/period-view";
import type { ReportsBase } from "@/lib/reports/gather";
import { cn } from "@/lib/utils";
import { ChartEmptyState } from "./chart-empty-state";
import { FLOW } from "./flow-colors";
import { fmtKwhText, fmtPct, Panel, StatTile } from "./perf-kit";
import { DailyBars } from "./chart-kit";

const change = (cur: number, prev: number | undefined): string => {
  if (prev === undefined) return "—";
  const c = pctChange(cur, prev);
  return c === null ? "—" : `${c > 0 ? "+" : ""}${c.toFixed(0)}%`;
};
const tone = (cur: number, prev: number | undefined, higherIsBetter = true) => {
  const c = prev === undefined ? null : pctChange(cur, prev);
  if (c === null || Math.abs(c) < 1) return "text-muted-foreground";
  return (c > 0) === higherIsBetter ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400";
};

/** The period at a glance: energy, how it was used, the bill with and without solar, the carbon avoided, how it compares with the
 *  period before and the same dates a year ago, and the day-by-day bars. */
export function ReportsSummary({ base, view, label }: { base: ReportsBase; view: PeriodView; label: string }) {
  const c = view.current;
  if (c.days === 0) return <ChartEmptyState />;
  const short = label || "period";
  const prev = view.previous ?? undefined;
  const vsPrev = prev ? `${change(c.pvKwh, prev.pvKwh)} vs the period before` : undefined;
  const daily = view.rows.map((d) => ({ date: d.day, value: d.pvKwh ?? 0 }));
  const used = view.rows.map((d) => ({ date: d.day, value: d.loadKwh }));
  const bill = view.bill;

  const rows: { name: string; cur: number; prev?: number; last?: number; good?: boolean }[] = [
    { name: "Generated", cur: c.pvKwh, prev: view.previous?.pvKwh, last: view.lastYear?.pvKwh },
    { name: "Used", cur: c.loadKwh, prev: view.previous?.loadKwh, last: view.lastYear?.loadKwh },
    { name: "Bought from the grid", cur: c.importKwh, prev: view.previous?.importKwh, last: view.lastYear?.importKwh, good: false },
    { name: "Sent to the grid", cur: c.exportKwh, prev: view.previous?.exportKwh, last: view.lastYear?.exportKwh },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label={`Generated · ${short}`} value={fmtKwhText(c.pvKwh)} hint={vsPrev ?? (c.avgPvPerDay !== null ? `${c.avgPvPerDay.toFixed(1)} kWh a day` : undefined)} />
        <StatTile label={`Used · ${short}`} value={fmtKwhText(c.loadKwh)} hint={`${c.days} day${c.days === 1 ? "" : "s"} with readings`} />
        <StatTile label={`Bought from the grid · ${short}`} value={fmtKwhText(c.importKwh)} />
        <StatTile label={`Sent to the grid · ${short}`} value={fmtKwhText(c.exportKwh)} />
        <StatTile label="Solar used on site" value={fmtPct(c.selfUsePct)} hint="Share of the solar energy used here" />
        <StatTile label="Home covered by solar" value={fmtPct(c.selfSufficiencyPct)} hint="Share of use not bought from the grid" tone={c.selfSufficiencyPct !== null && c.selfSufficiencyPct >= 50 ? "good" : "neutral"} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label={`Bill without solar · ${short}`} value={inr(bill.withoutSolar)} hint="Everything bought from the grid" />
        <StatTile label={`Bill with solar · ${short}`} value={inr(bill.withSolar)} hint="What is still paid" />
        <StatTile label={`Saved · ${short}`} value={inr(bill.saved)} hint={bill.exact ? "Worked out on the month's units" : "An estimate: a share of the month's bill"} tone="good" />
        <StatTile label="Saved since commissioning" value={base.lifetimeBill ? inr(base.lifetimeBill.saved) : "—"} hint={base.invested > 0 ? `${inr(base.invested)} invested` : undefined} />
        <StatTile label={`CO₂ avoided · ${short}`} value={`${view.co2Kg.toFixed(view.co2Kg >= 100 ? 0 : 1)} kg`} hint={`About ${view.trees.toFixed(1)} trees a year`} />
        <StatTile label="Best day" value={c.best ? fmtKwhText(c.best.kwh) : "—"} hint={c.best ? fmtDate(c.best.day) : undefined} />
      </div>

      <Panel title="Compared with earlier" description={`The period before is ${fmtDate(view.previousWindow.from)} to ${fmtDate(view.previousWindow.to)}; a year ago is ${fmtDate(view.lastYearWindow.from)} to ${fmtDate(view.lastYearWindow.to)}. A comparison needs readings in both.`}>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>&nbsp;</TableHead>
                <TableHead className="text-right">This period</TableHead>
                <TableHead className="text-right">Period before</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">A year ago</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="text-foreground">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtKwhText(r.cur)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.prev === undefined ? "—" : fmtKwhText(r.prev)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", tone(r.cur, r.prev, r.good ?? true))}>{change(r.cur, r.prev)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.last === undefined ? "—" : fmtKwhText(r.last)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", tone(r.cur, r.last, r.good ?? true))}>{change(r.cur, r.last)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {view.rows.length > 1 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel chart title={`Generated each day · ${short}`} description={`Energy the panels made each day. Lowest day ${c.lowest ? `${fmtKwhText(c.lowest.kwh)} on ${fmtDate(c.lowest.day)}` : "—"}.`}>
            <DailyBars daily={daily} label="Generated" color={FLOW.producing} />
          </Panel>
          <Panel chart title={`Used each day · ${short}`} description="Energy the site used each day.">
            <DailyBars daily={used} label="Used" color={FLOW.consuming} />
          </Panel>
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        From the inverter&apos;s own counters, not the electricity board&apos;s meter - treat the money and carbon figures as estimates. Tariff: {base.tariffNote}. CO₂: {base.co2Note}. Fixed charges and meter rent are left out.
      </p>
    </div>
  );
}
