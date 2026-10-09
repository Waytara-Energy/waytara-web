"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selfConsumptionPct, selfSufficiencyPct } from "@/lib/performance-metrics";
import { fmtDate, inr } from "@/lib/savings";
import type { PeriodView } from "@/lib/reports/period-view";
import type { ReportsBase } from "@/lib/reports/gather";
import { ChartEmptyState } from "./chart-empty-state";
import { fmtPct, Panel } from "./perf-kit";

const MAX_DAY_ROWS = 62;
const kwh = (n: number) => n.toFixed(1);

/** The period's numbers as tables: month by month (with the bill each month came to) and day by day (the latest days; the CSV has
 *  every day). */
export function ReportsEnergy({ base, view }: { base: ReportsBase; view: PeriodView }) {
  const c = view.current;
  if (c.days === 0) return <ChartEmptyState />;

  const months = base.months.filter((m) => view.rows.some((d) => d.day.slice(0, 7) === m.month));
  const shown = [...view.rows].reverse().slice(0, MAX_DAY_ROWS);

  return (
    <div className="space-y-4">
      <Panel title="Month by month" description="Each month is billed on its own units and the tariff in force then. A month only partly inside the period shows the whole month.">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Generated</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Bought</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Bill without solar</TableHead>
                <TableHead className="text-right">Bill with solar</TableHead>
                <TableHead className="text-right">Saved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="text-foreground">{m.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{kwh(m.energy.pvKwh ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{kwh(m.energy.loadKwh)}</TableCell>
                  <TableCell className="text-right tabular-nums">{kwh(m.energy.importKwh)}</TableCell>
                  <TableCell className="text-right tabular-nums">{kwh(m.energy.exportKwh)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{inr(m.bill.withoutSolar)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{inr(m.bill.withSolar)}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">{inr(m.bill.saved)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Energy in kWh. Tariff: {base.tariffNote}.</p>
      </Panel>

      <Panel title="Day by day" description={view.rows.length > MAX_DAY_ROWS ? `The latest ${MAX_DAY_ROWS} days of the period; download the CSV for every day.` : "Every day of the period with a reading."}>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead className="text-right">Generated</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Bought</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Solar used on site</TableHead>
                <TableHead className="text-right">Home covered by solar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((d) => (
                <TableRow key={d.day}>
                  <TableCell className="text-foreground">{fmtDate(d.day)}</TableCell>
                  <TableCell className="text-right tabular-nums">{kwh(d.pvKwh ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{kwh(d.loadKwh)}</TableCell>
                  <TableCell className="text-right tabular-nums">{kwh(d.importKwh)}</TableCell>
                  <TableCell className="text-right tabular-nums">{kwh(d.exportKwh)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPct(selfConsumptionPct(d.pvKwh ?? 0, d.exportKwh))}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPct(selfSufficiencyPct(d.loadKwh, d.importKwh))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total of the period</TableCell>
                <TableCell className="text-right tabular-nums">{kwh(c.pvKwh)}</TableCell>
                <TableCell className="text-right tabular-nums">{kwh(c.loadKwh)}</TableCell>
                <TableCell className="text-right tabular-nums">{kwh(c.importKwh)}</TableCell>
                <TableCell className="text-right tabular-nums">{kwh(c.exportKwh)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPct(c.selfUsePct)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPct(c.selfSufficiencyPct)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Energy in kWh, from the inverter&apos;s own counters. Readings on {c.days} of the {view.length} days; {view.completeness}% of the period.</p>
      </Panel>
    </div>
  );
}
