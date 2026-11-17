"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/savings";
import { fmtCo2, type CarbonDay, type CarbonPack } from "@/lib/reports/carbon-data";
import { ChartEmptyState } from "./chart-empty-state";
import { Panel, StatTile, useKwhText } from "./perf-kit";

/** The carbon report laid out as in the PDF: the headline figures, then (as a graph) the CO2 avoided each month, or (as tables) every month and every day. */
export function CarbonView({ pack, view }: { pack: CarbonPack; view: "graph" | "table" }) {
  const fmtKwhText = useKwhText();
  const t = pack.totals;
  if (t.days === 0) return <ChartEmptyState label={`No readings in ${pack.period.label}`} />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={`CO₂ avoided · ${pack.period.label}`} value={fmtCo2(t.co2AvoidedKg)} hint="by the solar generated" tone="good" />
        <StatTile label={`Generated · ${pack.period.label}`} value={fmtKwhText(t.pvKwh)} hint={`${t.days} of ${t.daysInPeriod} days with readings`} />
        <StatTile label="Equal to" value={`${t.trees.toFixed(t.trees >= 100 ? 0 : 1)} trees`} hint="absorbing CO₂ for a year" />
        <StatTile label="Equal to" value={`${Math.round(t.carKm).toLocaleString("en-IN")} km`} hint="not driven in a petrol car" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Bought from the grid" value={fmtKwhText(t.importKwh)} hint={`${pack.period.label}`} />
        <StatTile label="Grid CO₂ · Scope 2 estimate" value={fmtCo2(t.gridCo2Kg)} hint="location-based, same factor" />
        {pack.sinceCommissioning && <StatTile label="Since commissioning" value={fmtCo2(pack.sinceCommissioning.co2AvoidedKg)} hint={`${fmtKwhText(pack.sinceCommissioning.pvKwh)} generated, lifetime counter`} />}
      </div>
      {view === "graph" ? <MonthBars pack={pack} /> : <Tables pack={pack} />}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Report {pack.id}, method version {pack.methodVersion}. From the inverter&apos;s own counters, not the electricity board&apos;s revenue-grade meter. CO₂ factor: {pack.factor.note}. Not a carbon credit and not verified.
        Download the PDF for the method and what this report is and is not, or the CSV for every day.
      </p>
    </div>
  );
}

/** One bar a month: how much CO2 the solar avoided, drawn with plain bars so a year of months always fits. A month with no readings is marked, not shown as zero. */
function MonthBars({ pack }: { pack: CarbonPack }) {
  const max = Math.max(1, ...pack.months.map((m) => m.co2AvoidedKg));
  return (
    <Panel title={`CO₂ avoided each month · ${pack.period.label}`} description="From the energy the panels generated, at the grid emission factor.">
      <ul className="space-y-1.5">
        {pack.months.map((m) => (
          <li key={m.month} className="grid grid-cols-[4.5rem_1fr_6rem] items-center gap-3 text-sm">
            <span className="text-muted-foreground">{m.label}</span>
            <span className="h-3 overflow-hidden rounded-full bg-muted" role="presentation">
              <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(m.co2AvoidedKg / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums text-foreground">{m.days === 0 ? <span className="text-muted-foreground">no readings</span> : fmtCo2(m.co2AvoidedKg)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Tables({ pack }: { pack: CarbonPack }) {
  const t = pack.totals;
  const columns = React.useMemo<ColumnDef<CarbonDay, unknown>[]>(
    () => [
      { id: "day", accessorFn: (d) => d.day, header: "Day", cell: ({ row }) => fmtDate(row.original.day) },
      { id: "pv", accessorFn: (d) => d.pvKwh, header: "Generated kWh", meta: { align: "right" }, cell: ({ row }) => row.original.pvKwh.toFixed(1) },
      { id: "co2", accessorFn: (d) => d.co2AvoidedKg, header: "CO₂ avoided kg", meta: { align: "right" }, cell: ({ row }) => row.original.co2AvoidedKg.toFixed(2) },
      { id: "imp", accessorFn: (d) => d.importKwh, header: "Bought kWh", meta: { align: "right" }, cell: ({ row }) => row.original.importKwh.toFixed(1) },
    ],
    []
  );
  return (
    <div className="space-y-4">
      <Panel title="Month by month" description="Days with readings are counted out of the days of the month in the period.">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Days with readings</TableHead>
                <TableHead className="text-right">Generated kWh</TableHead>
                <TableHead className="text-right">CO₂ avoided kg</TableHead>
                <TableHead className="text-right">Bought kWh</TableHead>
                <TableHead className="text-right">Grid CO₂ kg</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pack.months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="text-foreground">{m.label}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {m.days} of {m.daysInPeriod}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.pvKwh.toFixed(1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.co2AvoidedKg.toFixed(1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.importKwh.toFixed(1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.gridCo2Kg.toFixed(1)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium text-foreground">Total</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {t.days} of {t.daysInPeriod}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{t.pvKwh.toFixed(1)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{t.co2AvoidedKg.toFixed(1)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{t.importKwh.toFixed(1)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{t.gridCo2Kg.toFixed(1)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Panel>
      <Panel title="Day by day" description="Click a heading to sort. Only days with readings are listed.">
        <DataTable columns={columns} data={pack.daily} pageSize={15} footer={["Total", t.pvKwh.toFixed(1), t.co2AvoidedKg.toFixed(2), t.importKwh.toFixed(1)]} />
      </Panel>
    </div>
  );
}
