"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { resolveKind } from "@/lib/chart-style";
import { fmtDate } from "@/lib/savings";
import { formatValue, unitGroups, type CustomReport, type ReportSeries } from "@/lib/reports/custom-report";
import { cn } from "@/lib/utils";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartCore, type ChartRow, type ChartSeriesDef } from "./chart-kit";
import { useChartStyle } from "./chart-style";
import { FLOW } from "./flow-colors";
import { Panel, StatTile } from "./perf-kit";

// Each parameter's own colour where it has a natural one (the flow colours of the Overview), the next free colour otherwise, so two
// series on one chart never look alike.
const PREFERRED: Record<string, string> = { pv: FLOW.producing, charged: FLOW.producing, load: FLOW.consuming, export: FLOW.consuming, net: FLOW.consuming, import: FLOW.drawing, discharged: FLOW.drawing };
const SPARE = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#14b8a6", "#ef4444"];

export function seriesColors(series: ReportSeries[]): Record<string, string> {
  const used = new Set<string>();
  const out: Record<string, string> = {};
  for (const s of series) {
    const pick = (PREFERRED[s.param] && !used.has(PREFERRED[s.param]) ? PREFERRED[s.param] : SPARE.find((c) => !used.has(c))) ?? SPARE[0];
    used.add(pick);
    out[s.id] = pick;
  }
  return out;
}

const fixed = (unit: ReportSeries["unit"]) => (v: number) => {
  const text = formatValue(v, unit);
  const i = text.search(/\s*(kWh|kg)$/);
  return i > 0 ? { num: text.slice(0, i), unit: text.slice(i).trim() } : { num: text.replace(/^₹/, ""), unit: unit === "₹" ? "₹" : "" };
};

/** A custom report, as charts (one per unit, so two scales never share a chart) or as tables. */
export function CustomReportView({ report, view }: { report: CustomReport; view: "graph" | "table" }) {
  if (report.buckets.length === 0) return <ChartEmptyState label="No readings in this period" />;
  return view === "graph" ? <Graphs report={report} /> : <Tables report={report} />;
}

function Tiles({ report }: { report: CustomReport }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
      {report.series.map((s) => (
        <StatTile
          key={s.id}
          label={`${s.label} · ${s.categoryLabel}`}
          value={formatValue(s.total, s.unit)}
          hint={s.changePct !== null ? `${s.changePct > 0 ? "+" : ""}${s.changePct.toFixed(0)}% vs the period before` : s.avg !== null ? `Average ${formatValue(s.avg, s.unit)} a ${report.granularity}` : undefined}
        />
      ))}
    </div>
  );
}

function Graphs({ report }: { report: CustomReport }) {
  const style = useChartStyle();
  const colors = React.useMemo(() => seriesColors(report.series), [report.series]);
  return (
    <div className="space-y-4">
      <Tiles report={report} />
      <div className={cn("grid gap-4", unitGroups(report).length > 1 && "lg:grid-cols-2")}>
        {unitGroups(report).map((g) => {
          const rows: ChartRow[] = report.buckets.map((b, i) => ({ __tick: b.label, __label: report.granularity === "day" ? fmtDate(b.key) : b.label, ...Object.fromEntries(g.series.map((s) => [s.id, s.values[i]])) }));
          const defs: ChartSeriesDef[] = g.series.map((s) => ({ key: s.id, label: s.label, color: colors[s.id] }));
          const kind = resolveKind(style, g.series.length > 1 || rows.length > 40 ? "line" : "bar");
          return (
            <Panel key={g.unit} chart title={g.series.map((s) => s.label).join(" and ")} description={`${report.period.label} · ${g.unit} each ${report.granularity}${report.comparison ? ` · ${g.series.map((s) => s.categoryLabel).filter((c, i, a) => a.indexOf(c) === i).join(" + ")}` : ""}`}>
              <ChartCore rows={rows} series={defs} kind={kind} format={fixed(g.unit)} tickEvery={Math.max(1, Math.round(rows.length / 6))} />
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function Tables({ report }: { report: CustomReport }) {
  const summary = report.series;
  const summaryColumns = React.useMemo<ColumnDef<ReportSeries, unknown>[]>(
    () => [
      { accessorKey: "label", header: "Parameter", cell: ({ row }) => <span>{row.original.label}</span> },
      { accessorKey: "categoryLabel", header: "Category", cell: ({ row }) => <span className="text-muted-foreground">{row.original.categoryLabel}</span> },
      { accessorKey: "total", header: "Total", meta: { align: "right" }, cell: ({ row }) => formatValue(row.original.total, row.original.unit) },
      { accessorKey: "avg", header: "Average", meta: { align: "right" }, cell: ({ row }) => formatValue(row.original.avg, row.original.unit) },
      { accessorKey: "min", header: "Lowest", meta: { align: "right" }, cell: ({ row }) => formatValue(row.original.min, row.original.unit) },
      { accessorKey: "max", header: "Highest", meta: { align: "right" }, cell: ({ row }) => formatValue(row.original.max, row.original.unit) },
      ...(report.comparePrevious
        ? ([{ accessorKey: "changePct", header: "Change", meta: { align: "right" }, cell: ({ row }) => (row.original.changePct === null ? "—" : `${row.original.changePct > 0 ? "+" : ""}${row.original.changePct.toFixed(0)}%`) }] as ColumnDef<ReportSeries, unknown>[])
        : []),
    ],
    [report.comparePrevious]
  );

  type Row = { key: string; label: string; values: (number | null)[] };
  const rows: Row[] = report.buckets.map((b, i) => ({ key: b.key, label: b.label, values: report.series.map((s) => s.values[i]) }));
  const dataColumns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { id: "when", accessorFn: (r) => r.key, header: report.granularity === "month" ? "Month" : "Day", cell: ({ row }) => row.original.label },
      ...report.series.map<ColumnDef<Row, unknown>>((s, i) => ({
        id: s.id,
        accessorFn: (r) => r.values[i],
        header: `${s.label} · ${s.unit}`,
        meta: { align: "right" },
        cell: ({ row }) => formatValue(row.original.values[i], s.unit).replace(/ (kWh|kg)$/, ""),
        sortUndefined: "last",
      })),
    ],
    [report.series, report.granularity]
  );

  return (
    <div className="space-y-4">
      <Panel title="At a glance" description={`${report.period.label} · ${fmtDate(report.period.from)} to ${fmtDate(report.period.to)} · ${report.daysWithReadings} day${report.daysWithReadings === 1 ? "" : "s"} with readings${report.series.some((s) => s.unit === "%") ? ". A percentage's total is the whole period's own ratio." : ""}`}>
        <DataTable columns={summaryColumns} data={summary} pageSize={10} />
      </Panel>
      <Panel title={report.granularity === "month" ? "Month by month" : "Day by day"} description="Click a heading to sort.">
        <DataTable columns={dataColumns} data={rows} pageSize={15} footer={["Total", ...report.series.map((s) => formatValue(s.total, s.unit).replace(/ (kWh|kg)$/, ""))]} />
      </Panel>
    </div>
  );
}
