"use client";

import * as React from "react";
import { BarChart3, FileSpreadsheet, FileText, RotateCcw, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ButtonSpinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { REPORT_BUCKET_OPTIONS, REPORT_TYPES, READING_GROUP_ORDER, DEFAULT_REPORT_BUCKET_MINUTES, getSeries, readingOptions, withDistinctColors, type AvailableReport, type ReportType } from "@/lib/report-types";
import { planRange } from "@/lib/telemetry/ranges";
import { buildCustomReport, type CustomReportDef } from "@/lib/reports/custom-report";
import { BUILTIN_DEFS } from "@/lib/reports/catalogue";
import { PARAMETER_BY_ID, PARAM_CATEGORIES, parametersOf } from "@/lib/reports/parameters";
import { defaultChoice, resolveChoice, type PeriodChoice } from "@/lib/reports/period-choice";
import { monthsWithData } from "@/lib/reports/period-math";
import { buildStatement } from "@/lib/reports/statement-data";
import type { ReportsBase } from "@/lib/reports/gather";
import { CustomReportView } from "./custom-report-view";
import { ALL_DAY, FilterChips, MultiPicker, TimeOfDayFilter, isAllDay, windowIsValid, type DayWindow, type PickGroup } from "./report-filters";
import { ReportPeriodPicker } from "./report-period-picker";
import { SeriesReportView, type SeriesReportResponse } from "./series-report-view";
import { StatementView } from "./statement-view";
import { useDownloadPending } from "./use-download-pending";

type Mode = "readings" | "totals" | "statement";
const MODES: { id: Mode; label: string }[] = [
  { id: "readings", label: "Readings" },
  { id: "totals", label: "Daily totals" },
  { id: "statement", label: "Monthly statement" },
];

const INTERVAL_LABELS: Record<number, string> = { 15: "15 min", 30: "30 min", 60: "1 hour", 120: "2 hours", 1440: "1 day" };
const monthName = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const MAX_PICKS = 8;
const DEFAULT_TOTALS = BUILTIN_DEFS.energy.series.map((s) => s.param);
const QUICK_TOTALS = [
  { label: "Day-by-day energy", params: DEFAULT_TOTALS },
  { label: "Bills & savings", params: BUILTIN_DEFS.bills.series.map((s) => s.param) },
];
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The report viewer on the Generate tab, built as a filter: choose what to look at (any number of readings, or daily figures),
 *  the period, and, for readings, the hours of the day and the interval; see it as a graph or tables; and download exactly what is
 *  shown as CSV or PDF with one pair of buttons. */
export function ReportCenter({ base, available }: { base: ReportsBase; available: AvailableReport[] }) {
  const today = base.today;
  const months = React.useMemo(() => monthsWithData(base.days), [base.days]);
  const availableIds = React.useMemo(() => new Set(available.flatMap((a) => a.seriesIds)), [available]);
  const defaultReadings = React.useMemo(() => ["solar", "load"].filter((id) => availableIds.has(id)).concat(availableIds.has("solar") || availableIds.has("load") ? [] : [...availableIds].slice(0, 1)), [availableIds]);

  const [mode, setMode] = React.useState<Mode>("readings");
  const [readings, setReadings] = React.useState<string[]>(defaultReadings);
  const [totals, setTotals] = React.useState<string[]>(DEFAULT_TOTALS);
  const [win, setWin] = React.useState<DayWindow>(ALL_DAY);
  const [choice, setChoice] = React.useState<PeriodChoice>(() => defaultChoice(today));
  const [interval, setInterval_] = React.useState(DEFAULT_REPORT_BUCKET_MINUTES);
  const [view, setView] = React.useState<"graph" | "table">("graph");
  const [month, setMonth] = React.useState(months[0] ?? today.slice(0, 7));
  const [csvPending, triggerCsv] = useDownloadPending();
  const [pdfPending, triggerPdf] = useDownloadPending();

  const { start, days, end } = resolveChoice(choice, today);
  const device = base.deviceId ? `&device=${base.deviceId}` : "";
  const winOk = windowIsValid(win);

  // --- readings: fetched from the server, only the hours asked for
  const readingGroups = React.useMemo<PickGroup[]>(
    () =>
      READING_GROUP_ORDER.map((g) => ({ id: g, label: g, items: readingOptions().filter((o) => o.group === g && availableIds.has(o.id)).map((o) => ({ id: o.id, label: o.label, unit: o.unit })) })).filter((g) => g.items.length > 0),
    [availableIds]
  );
  const seriesList = React.useMemo(() => withDistinctColors(readings.filter((id) => availableIds.has(id)).flatMap((id) => (getSeries(id) ? [getSeries(id)!] : []))), [readings, availableIds]);
  const seriesType = React.useMemo<ReportType>(
    () => ({
      id: "selection",
      label: seriesList.length === 1 ? seriesList[0].label : "Selected readings",
      group: "Combined",
      description: seriesList.length === 1 ? (REPORT_TYPES.find((t) => t.series.length === 1 && t.series[0].id === seriesList[0].id)?.description ?? "") : "",
      series: seriesList,
    }),
    [seriesList]
  );
  const isSeries = mode === "readings" && seriesList.length > 0 && winOk;
  const [nowMs] = React.useState(() => Date.now());
  const plan = React.useMemo(() => {
    const from = new Date(`${start}T00:00:00+05:30`).getTime();
    return planRange({ fromMs: from, toMs: from + days * 86_400_000 }, nowMs);
  }, [start, days, nowMs]);
  const shownInterval = plan.options.includes(interval) ? interval : plan.default;
  const windowQs = isAllDay(win) ? "" : `&from=${win.from}&to=${win.to}`;
  const query = `device=${base.deviceId}&series=${seriesList.map((s) => s.id).join(",")}&date=${start}&days=${days}&interval=${shownInterval}${windowQs}`;
  const [result, setResult] = React.useState<{ key: string; data: SeriesReportResponse | null; error: string | null } | null>(null);

  React.useEffect(() => {
    if (!isSeries) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(`/api/reports/day?${query}`, { signal: controller.signal, cache: "no-store" });
        const body = await res.json();
        if (controller.signal.aborted) return;
        setResult(res.ok ? { key: query, data: body as SeriesReportResponse, error: null } : { key: query, data: null, error: body?.error ?? "Could not load this report." });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResult({ key: query, data: null, error: "Could not load this report." });
      }
    };
    void load();
    // Today's chart is still filling in, so quietly refresh it; a past day is final.
    const timer = end >= today ? window.setInterval(() => void load(), 60_000) : null;
    return () => {
      controller.abort();
      if (timer) window.clearInterval(timer);
    };
  }, [isSeries, query, end, today]);

  const loading = isSeries && result?.key !== query;
  const seriesData = result?.data ?? null;

  // --- daily totals, worked out from the daily energy in the page
  const totalsName = QUICK_TOTALS.find((q) => sameIds(q.params, totals))?.label ?? "Daily totals";
  const custom = React.useMemo(() => {
    if (mode !== "totals" || totals.length === 0) return null;
    const def: CustomReportDef = { name: totalsName, series: totals.map((param) => ({ param })), period: { from: start, to: end } };
    return buildCustomReport(base, def, today);
  }, [mode, base, totals, totalsName, start, end, today]);
  const statement = React.useMemo(() => (mode === "statement" ? buildStatement(base, month) : null), [base, mode, month]);

  // --- the one pair of downloads
  const ready = mode === "readings" ? isSeries && !!seriesData?.hasData : mode === "statement" ? (statement?.current.days ?? 0) > 0 : (custom?.buckets.length ?? 0) > 0;
  const href = (format: "csv" | "pdf") => {
    if (mode === "readings") return `/api/reports/day.${format}?${query}`;
    if (mode === "statement") return `/api/reports/statement.${format}?month=${month}${device}`;
    return `/api/reports/custom?format=${format}&series=${totals.join(",")}&from=${start}&to=${end}&name=${encodeURIComponent(totalsName)}${device}`;
  };

  const totalsGroups = React.useMemo<PickGroup[]>(() => PARAM_CATEGORIES.map((c) => ({ id: c.id, label: c.label, items: parametersOf(c.id).map((p) => ({ id: p.id, label: p.label, unit: p.unit })) })).filter((g) => g.items.length > 0), []);
  const dirty =
    mode === "readings"
      ? !sameIds(readings, defaultReadings) || !isAllDay(win) || interval !== DEFAULT_REPORT_BUCKET_MINUTES || choice.mode !== "day" || choice.date !== today
      : mode === "totals"
        ? !sameIds(totals, DEFAULT_TOTALS) || choice.mode !== "day" || choice.date !== today
        : month !== (months[0] ?? today.slice(0, 7));
  const reset = () => {
    if (mode === "readings") {
      setReadings(defaultReadings);
      setWin(ALL_DAY);
      setInterval_(DEFAULT_REPORT_BUCKET_MINUTES);
    } else if (mode === "totals") setTotals(DEFAULT_TOTALS);
    else setMonth(months[0] ?? today.slice(0, 7));
    if (mode !== "statement") setChoice(defaultChoice(today));
  };

  const label = "text-xs font-medium text-muted-foreground";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v) => v && setMode(v as Mode)} aria-label="What to look at">
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
          <Button asChild variant="outline" size="sm" className={`h-9 gap-1.5 max-sm:px-2.5 ${ready ? "" : "pointer-events-none opacity-50"}`}>
            <a href={href("csv")} onClick={triggerCsv} aria-label="Download CSV" aria-disabled={!ready} title="Download CSV">
              <ButtonSpinner show={csvPending} />
              <FileSpreadsheet className="size-4" />
              <span className="hidden sm:inline">CSV</span>
            </a>
          </Button>
          <Button asChild size="sm" className={`h-9 gap-1.5 max-sm:px-2.5 ${ready ? "" : "pointer-events-none opacity-50"}`}>
            <a href={href("pdf")} onClick={triggerPdf} aria-label="Download PDF" aria-disabled={!ready} title="Download PDF">
              <ButtonSpinner show={pdfPending} />
              <FileText className="size-4" />
              <span className="hidden sm:inline">PDF</span>
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        {mode !== "statement" && (
          <>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={label}>{mode === "readings" ? "Readings" : "Figures"}</span>
                {mode === "totals" && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-muted-foreground">Quick sets</span>
                    {QUICK_TOTALS.map((q) => (
                      <Button key={q.label} variant={sameIds(q.params, totals) ? "secondary" : "ghost"} size="sm" className="h-7 px-2 text-xs" onClick={() => setTotals(q.params)}>
                        {q.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {mode === "readings" ? (
                  <>
                    <FilterChips items={seriesList.map((s) => ({ id: s.id, label: s.label, color: s.color }))} onRemove={(id) => setReadings((r) => r.filter((x) => x !== id))} />
                    <MultiPicker groups={readingGroups} selected={readings} onChange={setReadings} max={MAX_PICKS} label="Add reading" searchPlaceholder="Search readings…" />
                  </>
                ) : (
                  <>
                    <FilterChips items={totals.map((id) => ({ id, label: PARAMETER_BY_ID[id]?.label ?? id }))} onRemove={(id) => setTotals((r) => r.filter((x) => x !== id))} />
                    <MultiPicker groups={totalsGroups} selected={totals} onChange={setTotals} max={MAX_PICKS} label="Add figure" searchPlaceholder="Search figures…" />
                  </>
                )}
              </div>
            </div>
            <Separator className="my-3" />
          </>
        )}

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
                <ReportPeriodPicker choice={choice} onChange={setChoice} today={today} firstDay={base.firstDay} />
              </div>
            </div>
          )}

          {mode === "readings" && (
            <>
              <div className="space-y-1">
                <span className={label}>Time of day</span>
                <div>
                  <TimeOfDayFilter value={win} onChange={setWin} />
                </div>
              </div>
              <div className="space-y-1">
                <span className={label}>Interval</span>
                <Select value={String(shownInterval)} onValueChange={(v) => setInterval_(Number(v))}>
                  <SelectTrigger className="h-9 w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plan.options.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {INTERVAL_LABELS[m] ?? REPORT_BUCKET_OPTIONS.find((o) => o.minutes === m)?.label ?? `${m} min`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <Button variant="ghost" size="sm" className="ml-auto h-9 gap-1.5 text-muted-foreground" onClick={reset} disabled={!dirty}>
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>
      </div>

      {mode === "readings" ? (
        seriesList.length === 0 ? (
          <EmptyPick text="Add one or more readings above to see them here." />
        ) : !winOk ? (
          <EmptyPick text="Set a start time that is earlier than the end time." />
        ) : (
          <SeriesReportView data={seriesData} loading={loading} error={loading ? null : (result?.error ?? null)} type={seriesType} series={seriesList} view={view} days={days} start={start} endDay={end} interval={shownInterval} />
        )
      ) : mode === "statement" ? (
        statement && <StatementView s={statement} view={view} />
      ) : custom ? (
        <CustomReportView report={custom} view={view} />
      ) : (
        <EmptyPick text="Add one or more figures above to see them here." />
      )}
    </div>
  );
}

function EmptyPick({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
