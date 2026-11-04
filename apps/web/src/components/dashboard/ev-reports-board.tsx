"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BarChart3, CarFront, FileSpreadsheet, FileText, RotateCcw, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ButtonSpinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { evPerfStats, spanOfDays, type EvDayFigures, type EvPerfSession, type EvRow } from "@/lib/ev-perf-stats";
import { formatSeconds, sessionStatusLabel } from "@/lib/ev-sessions";
import { buildEvReport, evChargingDays, evSummaryFigures, type EvReport } from "@/lib/reports/ev-report";
import { filtersQuery, monthBounds, monthsBetween, type EvReportFilters, type EvReportMode } from "@/lib/reports/ev-filters";
import { choiceLabel, defaultChoice, resolveChoice, type PeriodChoice } from "@/lib/reports/period-choice";
import { fmtDate } from "@/lib/savings";
import { cn } from "@/lib/utils";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartCore, type ChartRow, type ChartSeriesDef, type ReadoutItem } from "./chart-kit";
import { EvSessionsBrowser } from "./ev-sessions-browser";
import { FLOW } from "./flow-colors";
import { Panel, StatTile, useKwhText } from "./perf-kit";
import { ALL_DAY, TimeOfDayFilter, isAllDay, windowIsValid, type DayWindow } from "./report-filters";
import { ReportPeriodPicker } from "./report-period-picker";
import { useDownloadPending } from "./use-download-pending";

const when = (ts: string) => new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const monthName = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
/** The most charges drawn as bars in the graph (the newest); the table and the downloads hold all of them. */
const MAX_BARS = 60;

const MODES: { id: EvReportMode; label: string }[] = [
  { id: "sessions", label: "Charging sessions" },
  { id: "daily", label: "Daily totals" },
  { id: "statement", label: "Monthly statement" },
];

const SOURCE_SERIES: ChartSeriesDef[] = [
  { key: "solar", label: "Solar", color: FLOW.producing },
  { key: "battery", label: "Battery", color: FLOW.drawing },
  { key: "grid", label: "Grid", color: FLOW.consuming },
  { key: "unmatched", label: "Not matched to a source", color: "#94a3b8" },
];
const kwhFormat = (v: number) => ({ num: v.toFixed(v >= 10 ? 1 : 2), unit: "kWh" });
const kwhText = (v: number | null) => (v === null ? null : `${v.toFixed(v >= 10 ? 1 : 2)} kWh`);

export interface EvReportsProps {
  deviceId: string;
  deviceLabel: string;
  customerName: string;
  siteName: string | null;
  tariffRate: number | null;
  tariffNote: string;
  /** The charger's sessions of the last two years, as many as the page read. */
  sessions: EvPerfSession[];
  /** Today in India (YYYY-MM-DD), and the day of the first charge (null when there is none): the period picker needs them. */
  today: string;
  firstDay: string | null;
}

/** Reports for an EV charger when it is the whole page (a site without an inverter): the headline, then the detailed report. */
export function EvReportsBoard(props: EvReportsProps) {
  return (
    <div className="space-y-5">
      <EvReportsHeadline {...props} />
      <EvReportsBody {...props} />
    </div>
  );
}

/** The line above the Reports tabs for the EV Charger, like Generate's (it has no period of its own): everything the charger has delivered, with the
 *  number of charges and what solar and battery saved. */
export function EvReportsHeadline({ sessions, tariffRate, today, firstDay }: EvReportsProps) {
  const kwh = useKwhText();
  const stats = React.useMemo(() => evPerfStats(sessions, spanOfDays(firstDay ?? today, today), tariffRate), [sessions, tariffRate, today, firstDay]);
  const has = stats.sessions > 0;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CarFront className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-theme-muted">Energy delivered · so far</p>
          <p className="text-4xl font-semibold leading-tight tracking-tight text-theme-primary">{has ? kwh(stats.energyKwh) : "—"}</p>
        </div>
        <div className="hidden items-center gap-8 pl-6 md:flex">
          <Figure label="Charging sessions" value={has ? String(stats.sessions) : "—"} />
          {stats.cost ? <Figure label="Saved by solar and battery" value={has ? `₹${stats.cost.saved.toFixed(0)}` : "—"} good /> : null}
        </div>
      </div>
    </div>
  );
}

function Figure({ label, value, good = false }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <p className="text-sm font-medium text-theme-muted">{label}</p>
      <p className={cn("text-2xl font-semibold tracking-tight", good ? "text-emerald-600 dark:text-emerald-400" : "text-theme-primary")}>{value}</p>
    </div>
  );
}

const label = "text-xs font-medium text-muted-foreground";

/** The detailed report, built as a filter like the solar one on the Generate tab: choose what to look at (every charge, one row per day, or a month as
 *  a statement), the period, the hours of the day and the kind of charge; see it as a graph or as tables; and download exactly what is shown as CSV or PDF. */
export function EvReportsBody(props: EvReportsProps) {
  const { deviceId, today, firstDay, sessions } = props;
  const months = React.useMemo(() => monthsBetween(firstDay, today), [firstDay, today]);
  const [mode, setMode] = React.useState<EvReportMode>("sessions");
  const [view, setView] = React.useState<"graph" | "table">("table");
  const [choice, setChoice] = React.useState<PeriodChoice>(() => ({ ...defaultChoice(today), mode: "30d" }));
  const [month, setMonth] = React.useState(months[0] ?? today.slice(0, 7));
  const [status, setStatus] = React.useState("all");
  const [withEnergy, setWithEnergy] = React.useState(false);
  const [win, setWin] = React.useState<DayWindow>(ALL_DAY);
  const [csvPending, triggerCsv] = useDownloadPending();
  const [pdfPending, triggerPdf] = useDownloadPending();

  const winOk = windowIsValid(win);
  const filters = React.useMemo<EvReportFilters>(
    () => ({ status, withEnergy, fromTime: isAllDay(win) || !winOk ? null : win.from, toTime: isAllDay(win) || !winOk ? null : win.to }),
    [status, withEnergy, win, winOk],
  );
  const period = mode === "statement" ? monthBounds(month, today) : (() => {
    const r = resolveChoice(choice, today);
    return { from: r.start, to: r.end };
  })();
  const periodName = mode === "statement" ? monthName(month) : choiceLabel(choice, today);

  const report = React.useMemo(
    () => buildEvReport({ customerName: props.customerName, siteName: props.siteName, deviceLabel: props.deviceLabel, generatedAt: "", from: period.from, to: period.to, tariffRate: props.tariffRate, tariffNote: props.tariffNote, sessions, filters }),
    [props.customerName, props.siteName, props.deviceLabel, period.from, period.to, props.tariffRate, props.tariffNote, sessions, filters],
  );
  const has = report.stats.rows.length > 0;

  // The statuses the charger has had, for the filter (a status it never had is not offered).
  const statuses = React.useMemo(() => [...new Set(sessions.filter((s) => !s.is_test).map((s) => s.status))].map((key) => ({ key, label: sessionStatusLabel(key).label })), [sessions]);
  const activeStatus = status === "all" || statuses.some((s) => s.key === status) ? status : "all";

  const href = (format: "csv" | "pdf") => {
    const f = filtersQuery(filters);
    return `/api/reports/ev.${format}?device=${deviceId}&from=${period.from}&to=${period.to}&mode=${mode}${f ? `&${f}` : ""}`;
  };
  const dirty = mode === "statement" ? month !== (months[0] ?? today.slice(0, 7)) || status !== "all" || withEnergy || !isAllDay(win) : choice.mode !== "30d" || status !== "all" || withEnergy || !isAllDay(win);
  const reset = () => {
    setChoice({ ...defaultChoice(today), mode: "30d" });
    setMonth(months[0] ?? today.slice(0, 7));
    setStatus("all");
    setWithEnergy(false);
    setWin(ALL_DAY);
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Detailed report</h2>
        <p className="text-xs text-muted-foreground">Filter by the period, the hours of the day and the kind of charge, see it as a graph or a table, and download it as CSV or PDF.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v) => v && setMode(v as EvReportMode)} aria-label="What to look at">
          {MODES.map((m) => (
            <ToggleGroupItem key={m.id} value={m.id} className="h-9 px-3 text-xs sm:text-sm">
              {m.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex items-center gap-2">
          <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v as "graph" | "table")} aria-label="Show as">
            <ToggleGroupItem value="graph" aria-label="Graph" className="h-9 gap-1.5 px-2.5">
              <BarChart3 className="size-4" />
              <span className="hidden sm:inline">Graph</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table" className="h-9 gap-1.5 px-2.5">
              <Table2 className="size-4" />
              <span className="hidden sm:inline">Table</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <Button asChild variant="outline" size="sm" className={`h-9 gap-1.5 max-sm:px-2.5 ${has ? "" : "pointer-events-none opacity-50"}`}>
            <a href={href("csv")} onClick={triggerCsv} aria-label="Download CSV" aria-disabled={!has} title="Download CSV">
              <ButtonSpinner show={csvPending} />
              <FileSpreadsheet className="size-4" />
              <span className="hidden sm:inline">CSV</span>
            </a>
          </Button>
          <Button asChild size="sm" className={`h-9 gap-1.5 max-sm:px-2.5 ${has ? "" : "pointer-events-none opacity-50"}`}>
            <a href={href("pdf")} onClick={triggerPdf} aria-label="Download PDF" aria-disabled={!has} title="Download PDF">
              <ButtonSpinner show={pdfPending} />
              <FileText className="size-4" />
              <span className="hidden sm:inline">PDF</span>
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          {mode === "statement" ? (
            <div className="space-y-1">
              <span className={label}>Month</span>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(months.length > 0 ? months : [month]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <span className={label}>Period</span>
              <div>
                <ReportPeriodPicker choice={choice} onChange={setChoice} today={today} firstDay={firstDay} />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <span className={label}>Started between</span>
            <div>
              <TimeOfDayFilter value={win} onChange={setWin} />
            </div>
          </div>
          <div className="space-y-1">
            <span className={label}>Status</span>
            <Select value={activeStatus} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className={label}>Charges</span>
            <div>
              <Button type="button" variant={withEnergy ? "secondary" : "outline"} size="sm" aria-pressed={withEnergy} onClick={() => setWithEnergy((v) => !v)} className="h-9">
                Only with energy
              </Button>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto h-9 gap-1.5 text-muted-foreground" onClick={reset} disabled={!dirty}>
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>
      </div>

      {!winOk ? (
        <EmptyPick text="Set a start time that is earlier than the end time." />
      ) : (
        <ReportView report={report} mode={mode} view={view} periodName={periodName} has={has} today={today} />
      )}
    </section>
  );
}

function ReportView({ report, mode, view, periodName, has, today }: { report: EvReport; mode: EvReportMode; view: "graph" | "table"; periodName: string; has: boolean; today: string }) {
  const s = report.stats;
  return (
    <div className="space-y-4">
      {!has && <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">No charging sessions match this. Pick a longer period, or loosen the filters.</p>}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
        {evSummaryFigures(report)
          // a statement shows the money in its Bill, once
          .filter((f) => !(mode === "statement" && (f.label === "Paid to the grid" || f.label === "Saved by solar and battery")))
          .map((f) => (
          <StatTile key={f.label} label={`${f.label} · ${periodName}`} value={has ? f.value : "—"} />
        ))}
      </div>
      {s.sample && has && <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Sample data: this charger has no real charge yet, so this report is made from sample charges.</p>}
      {s.cost && has && (
        <p className="text-xs text-muted-foreground">
          Priced at ₹{s.cost.rate.toFixed(2)}/kWh{report.tariffNote ? ` (${report.tariffNote})` : ""}. Energy without a source split counts as grid.
        </p>
      )}

      {has && mode === "statement" && s.cost && <Bill report={report} periodName={periodName} />}

      {has &&
        (mode === "sessions" ? (
          view === "graph" ? (
            <SessionsGraph rows={s.rows} periodName={periodName} />
          ) : (
            <EvSessionsBrowser rows={s.rows} periodName={periodName} today={today} />
          )
        ) : view === "graph" ? (
          <DaysGraph report={report} periodName={periodName} />
        ) : (
          <DaysTable report={report} periodName={periodName} />
        ))}
    </div>
  );
}

function EmptyPick({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

/** The statement's bill: what the grid part of the charging cost, what solar and battery saved, and what it would all have cost. */
function Bill({ report, periodName }: { report: EvReport; periodName: string }) {
  const c = report.stats.cost!;
  return (
    <Panel title="Bill" description={`${periodName} · ${report.stats.energyKwh.toFixed(1)} kWh at ₹${c.rate.toFixed(2)}/kWh`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Paid to the grid" value={`₹${c.gridCost.toFixed(0)}`} hint="paid to the board" />
        <StatTile label="Saved" value={`₹${c.saved.toFixed(0)}`} hint="solar and battery" tone="good" />
        <StatTile label="All from the grid" value={`₹${c.allGridCost.toFixed(0)}`} hint="without solar" />
      </div>
    </Panel>
  );
}

/** The series that have something to draw (a source no charge used is left out, so it is not listed with a 0). */
const usedSeries = (rows: ChartRow[]) => {
  const used = SOURCE_SERIES.filter((s) => rows.some((r) => typeof r[s.key] === "number" && (r[s.key] as number) > 0));
  return used.length > 0 ? used : SOURCE_SERIES.slice(0, 1);
};
const lead = (...items: [string, string, string | null][]): ReadoutItem[] => items.map(([key, label, num]) => ({ key, label, color: "var(--foreground)", value: num === null ? null : { num, unit: "" } }));

/** One bar per charge, split by where its energy came from (the newest MAX_BARS of them). Pointing at a bar says when the charge started, how much
 *  energy it delivered and for how long, and the split. A charge still running has no energy yet, so it is drawn once it has ended. */
function SessionsGraph({ rows, periodName }: { rows: EvRow[]; periodName: string }) {
  const done = rows.filter((r) => r.energyKwh !== null);
  const bars = done.slice(0, MAX_BARS).reverse();
  const oneDay = new Set(bars.map((r) => new Date(r.startedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }))).size <= 1;
  const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const data: ChartRow[] = bars.map((r) => {
    const split = r.solarKwh !== null || r.batteryKwh !== null || r.gridKwh !== null;
    return {
      __tick: oneDay ? clock(r.startedAt) : `${new Date(r.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}, ${clock(r.startedAt)}`,
      __label: `Started ${when(r.startedAt)}`,
      total: r.energyKwh,
      time: r.durationS === null ? null : formatSeconds(r.durationS),
      solar: split ? (r.solarKwh ?? 0) : 0,
      battery: split ? (r.batteryKwh ?? 0) : 0,
      grid: split ? (r.gridKwh ?? 0) : 0,
      unmatched: split ? (r.unknownKwh ?? 0) : (r.energyKwh ?? 0),
    };
  });
  const running = rows.length - done.length;
  return (
    <Panel
      chart
      title="Energy of each charge"
      description={`${periodName} · point at a bar for its energy, duration and where the energy came from${rows.length > MAX_BARS ? `. The newest ${MAX_BARS} of ${done.length}; the table and the downloads hold all of them` : ""}${running > 0 ? `. A charge still running is drawn once it has ended` : ""}`}
    >
      <ChartCore
        rows={data}
        series={usedSeries(data)}
        kind="bar"
        stacked
        format={kwhFormat}
        tickEvery={Math.max(1, Math.round(data.length / 6))}
        readoutLead={(r) => lead(["total", "Energy", kwhText(r.total as number | null)], ["time", "Charging time", (r.time as string | null) ?? null])}
      />
    </Panel>
  );
}

/** One bar per day, split by where the energy came from (a day with no charge is an empty bar). */
function DaysGraph({ report, periodName }: { report: EvReport; periodName: string }) {
  const days = report.stats.dayFigures;
  const data: ChartRow[] = days.map((d) => ({
    __tick: new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }),
    __label: fmtDate(d.date),
    total: d.energyKwh,
    count: d.sessions === 0 ? "No charge" : `${d.sessions} ${d.sessions === 1 ? "charge" : "charges"}`,
    time: d.sessions === 0 ? null : formatSeconds(d.chargingSeconds),
    solar: d.solarKwh,
    battery: d.batteryKwh,
    grid: d.gridKwh,
    unmatched: d.unknownKwh,
  }));
  return (
    <Panel chart title="Energy per day" description={`${periodName} · point at a day for its energy, charges, charging time and where the energy came from`}>
      <ChartCore
        rows={data}
        series={usedSeries(data)}
        kind="bar"
        stacked
        format={kwhFormat}
        tickEvery={Math.max(1, Math.round(data.length / 6))}
        readoutLead={(r) => lead(["total", "Energy", kwhText(r.total as number | null)], ["count", "Charges", r.count as string], ["time", "Charging time", (r.time as string | null) ?? null])}
      />
    </Panel>
  );
}

function DaysTable({ report, periodName }: { report: EvReport; periodName: string }) {
  const s = report.stats;
  const days = evChargingDays(report);
  const cost = s.cost !== null;
  const k = (v: number) => v.toFixed(2);
  const columns = React.useMemo<ColumnDef<EvDayFigures, unknown>[]>(
    () => [
      { id: "day", accessorFn: (d) => d.date, header: "Day", cell: ({ row }) => fmtDate(row.original.date) },
      { id: "sessions", accessorFn: (d) => d.sessions, header: "Sessions", meta: { align: "right" } },
      { id: "energy", accessorFn: (d) => d.energyKwh, header: "Energy · kWh", meta: { align: "right" }, cell: ({ row }) => k(row.original.energyKwh) },
      { id: "solar", accessorFn: (d) => d.solarKwh, header: "Solar · kWh", meta: { align: "right" }, cell: ({ row }) => k(row.original.solarKwh) },
      { id: "battery", accessorFn: (d) => d.batteryKwh, header: "Battery · kWh", meta: { align: "right" }, cell: ({ row }) => k(row.original.batteryKwh) },
      { id: "grid", accessorFn: (d) => d.gridKwh, header: "Grid · kWh", meta: { align: "right" }, cell: ({ row }) => k(row.original.gridKwh) },
      { id: "time", accessorFn: (d) => d.chargingSeconds, header: "Charging time", meta: { align: "right" }, cell: ({ row }) => formatSeconds(row.original.chargingSeconds) },
      { id: "peak", accessorFn: (d) => d.peakKw ?? -1, header: "Peak · kW", meta: { align: "right" }, cell: ({ row }) => (row.original.peakKw === null ? "—" : row.original.peakKw.toFixed(1)) },
      ...(cost
        ? ([
            { id: "paid", accessorFn: (d) => d.gridCost ?? 0, header: "Paid · ₹", meta: { align: "right" }, cell: ({ row }) => (row.original.gridCost ?? 0).toFixed(0) },
            { id: "saved", accessorFn: (d) => d.saved ?? 0, header: "Saved · ₹", meta: { align: "right" }, cell: ({ row }) => (row.original.saved ?? 0).toFixed(0) },
          ] as ColumnDef<EvDayFigures, unknown>[])
        : []),
    ],
    [cost],
  );
  const sum = (pick: (d: EvDayFigures) => number) => days.reduce((a, d) => a + pick(d), 0);
  const footer: React.ReactNode[] = [
    "Total",
    String(s.sessions),
    k(s.energyKwh),
    k(sum((d) => d.solarKwh)),
    k(sum((d) => d.batteryKwh)),
    k(sum((d) => d.gridKwh)),
    formatSeconds(s.chargingSeconds),
    s.peakKw === null ? "—" : s.peakKw.toFixed(1),
    ...(s.cost ? [s.cost.gridCost.toFixed(0), s.cost.saved.toFixed(0)] : []),
  ];
  return (
    <Panel title="Day by day" description={`${periodName} · the days with a charge. Click a heading to sort.`}>
      {days.length === 0 ? <ChartEmptyState label="No charging days" /> : <DataTable columns={columns} data={days} pageSize={15} footer={footer} />}
    </Panel>
  );
}
