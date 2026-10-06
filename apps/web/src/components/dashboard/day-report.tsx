"use client";

import * as React from "react";
import { Bar, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REPORT_BUCKET_MINUTES,
  DEFAULT_REPORT_TYPE,
  REPORT_TYPES,
  getReportType,
  type AvailableReport,
  todayIst,
  type ReportPoint,
  type ReportSeriesSummary,
} from "@/lib/report-types";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ButtonSpinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartTick } from "./bar-trend-chart";
import { planRange } from "@/lib/telemetry/ranges";
import { useDownloadPending } from "./report-controls";

interface DayReportResponse {
  date: string;
  days: number;
  bucketMinutes: number;
  coarse: boolean;
  isSolar: boolean;
  hasData: boolean;
  points: ReportPoint[];
  summaries: ReportSeriesSummary[];
}

const GROUP_ORDER = ["Solar", "Battery", "Load", "Grid", "Combined", "Health"] as const;

const dateToString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const stringToDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const shiftDay = (s: string, delta: number) => {
  const d = stringToDate(s);
  d.setDate(d.getDate() + delta);
  return dateToString(d);
};

function formatValue(v: number | null, unit: string): string {
  if (v === null) return "—";
  return `${v.toFixed(unit === "kW" ? 2 : 1)} ${unit}`;
}

type Mode = "day" | "7d" | "30d" | "90d" | "custom";
const MODES: { id: Mode; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];
const INTERVAL_LABELS: Record<number, string> = { 15: "15 min", 30: "30 min", 60: "1 hour", 120: "2 hours", 1440: "1 day" };
const fmtDay = (day: string) => stringToDate(day).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const daysBetween = (a: string, b: string) => Math.round((stringToDate(b).getTime() - stringToDate(a).getTime()) / 86_400_000);

export function DayReport({ deviceId, available, firstDay }: { deviceId: string; available: AvailableReport[]; firstDay: string | null }) {
  const today = todayIst();
  const [typeId, setTypeId] = React.useState<string>(available.some((a) => a.id === DEFAULT_REPORT_TYPE) ? DEFAULT_REPORT_TYPE : available[0].id);
  const [date, setDate] = React.useState<string>(today);
  const [mode, setMode] = React.useState<Mode>("day");
  const [customStart, setCustomStart] = React.useState<string>(shiftDay(today, -6));
  const [interval, setIntervalMinutes] = React.useState<number>(DEFAULT_REPORT_BUCKET_MINUTES);
  const [nowMs] = React.useState(() => Date.now());

  // The window the report covers: one day, today and the days before it, or up to 30 days from a chosen first day.
  const start = mode === "day" ? date : mode === "7d" ? shiftDay(today, -6) : mode === "30d" ? shiftDay(today, -29) : mode === "90d" ? shiftDay(today, -89) : customStart;
  const days = mode === "day" ? 1 : mode === "custom" ? Math.min(30, daysBetween(customStart, today) + 1) : mode === "7d" ? 7 : mode === "30d" ? 30 : 90;
  const endDay = shiftDay(start, days - 1);
  // What the database can serve for this window; the picker offers exactly that.
  const plan = React.useMemo(() => {
    const from = new Date(`${start}T00:00:00+05:30`).getTime();
    return planRange({ fromMs: from, toMs: from + days * 86_400_000 }, nowMs);
  }, [start, days, nowMs]);
  const shownInterval = plan.options.includes(interval) ? interval : plan.default;
  // Keyed by the query it answers, so "loading" is simply "the answer on screen is for a
  // different query" - no setState needed in the effect body.
  const [result, setResult] = React.useState<{ key: string; data: DayReportResponse | null; error: string | null } | null>(null);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [customOpen, setCustomOpen] = React.useState(false);
  const [csvPending, triggerCsvPending] = useDownloadPending();
  const [pdfPending, triggerPdfPending] = useDownloadPending();

  // Only the reports, and within them only the series, this device's equipment_metrics enables.
  const enabledSeries = new Set(available.find((a) => a.id === typeId)?.seriesIds);
  const type = getReportType(typeId);
  const query = `device=${deviceId}&type=${typeId}&date=${start}&days=${days}&interval=${shownInterval}`;

  const load = React.useCallback(
    async (signal: AbortSignal) => {
      try {
        const res = await fetch(`/api/reports/day?${query}`, { signal, cache: "no-store" });
        const body = await res.json();
        if (signal.aborted) return;
        setResult(
          res.ok
            ? { key: query, data: body as DayReportResponse, error: null }
            : { key: query, data: null, error: body?.error ?? "Could not load this report." }
        );
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResult({ key: query, data: null, error: "Could not load this report." });
      }
    },
    [query]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    // The only setState is after the awaited fetch (async), not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    // Today's chart is still filling in, so quietly refresh it; a past day is final.
    const timer = endDay >= todayIst() ? setInterval(() => void load(controller.signal), 60_000) : null;
    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [load, endDay]);

  const loading = result?.key !== query;
  const data = result?.data ?? null;
  const error = loading ? null : result?.error ?? null;

  const availableIds = new Set(available.map((a) => a.id));
  const grouped = GROUP_ORDER.map((g) => ({ group: g, items: REPORT_TYPES.filter((t) => t.group === g && availableIds.has(t.id)) })).filter((g) => g.items.length > 0);
  const series = type.series.filter((s) => enabledSeries.has(s.id));
  const unit = series[0].unit;
  const drawAsLines = series.length > 2;
  const bucketMinutes = data?.bucketMinutes ?? shownInterval;

  const chartConfig = React.useMemo(
    () => Object.fromEntries(series.map((s) => [s.id, { label: s.label, color: s.color }])) satisfies ChartConfig,
    [series]
  );

  const unitById = Object.fromEntries(series.map((s) => [s.id, s.unit]));
  const domain: [number | "auto", number | "auto"] = unit === "%" ? [0, 100] : unit === "kW" ? [0, "auto"] : ["auto", "auto"];
  const longDate = stringToDate(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isToday = date === today;
  const windowText = days > 1 ? `${fmtDay(start)} – ${fmtDay(endDay)} (${days} days)` : `${longDate}, 00:00–23:59`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 space-y-1 sm:max-w-xs">
          <label className="text-xs font-medium text-theme-muted">Report</label>
          <Select value={typeId} onValueChange={setTypeId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {grouped.map((g) => (
                <SelectGroup key={g.group}>
                  <SelectLabel>{g.group}</SelectLabel>
                  {g.items.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-theme-muted">Period</label>
          <div className="flex flex-wrap items-center gap-1">
            <div className="flex gap-1 rounded-lg border border-theme-border p-1">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    mode === m.id ? "bg-theme-surface-hover text-theme-highlight" : "text-theme-muted hover:text-theme-primary"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <Popover open={customOpen} onOpenChange={setCustomOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-1.5", mode === "custom" && "border-theme-highlight text-theme-highlight")}>
                  <CalendarIcon className="size-3.5" />
                  {mode === "custom" ? `From ${fmtDay(customStart)}` : "Custom"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={stringToDate(customStart)}
                  defaultMonth={stringToDate(customStart)}
                  onSelect={(d) => {
                    if (d) {
                      setCustomStart(dateToString(d));
                      setMode("custom");
                      setCustomOpen(false);
                    }
                  }}
                  disabled={[{ after: stringToDate(today) }, ...(firstDay ? [{ before: stringToDate(firstDay) }] : [])]}
                />
                <p className="border-t border-theme-border px-3 py-2 text-xs text-theme-muted">
                  Pick the first day; the report covers up to 30 days from it{firstDay ? `, no earlier than ${fmtDay(firstDay)} (first reading)` : ""}.
                </p>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {mode === "day" && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-theme-muted">Date</label>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-9" aria-label="Previous day" onClick={() => setDate(shiftDay(date, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 min-w-[150px] gap-1.5 font-normal">
                  <CalendarIcon className="size-3.5" />
                  {stringToDate(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={stringToDate(date)}
                  onSelect={(d) => {
                    if (d) {
                      setDate(dateToString(d));
                      setCalendarOpen(false);
                    }
                  }}
                  disabled={{ after: stringToDate(today) }}
                  defaultMonth={stringToDate(date)}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Next day"
              disabled={isToday}
              onClick={() => setDate(shiftDay(date, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
            {!isToday && (
              <Button variant="ghost" size="sm" onClick={() => setDate(today)}>
                Today
              </Button>
            )}
          </div>
        </div>

        )}

        <div className="space-y-1">
          <label className="text-xs font-medium text-theme-muted">Interval</label>
          <Select value={String(shownInterval)} onValueChange={(v) => setIntervalMinutes(Number(v))}>
            <SelectTrigger className="h-9 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plan.options.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {INTERVAL_LABELS[m] ?? `${m} min`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className={cn(!data?.hasData && "pointer-events-none opacity-50")}>
            <a href={`/api/reports/day.csv?${query}`} onClick={triggerCsvPending} aria-disabled={!data?.hasData}>
              <ButtonSpinner show={csvPending} />
              Download CSV
            </a>
          </Button>
          <Button asChild size="sm" className={cn(!data?.hasData && "pointer-events-none opacity-50")}>
            <a href={`/api/reports/day.pdf?${query}`} onClick={triggerPdfPending} aria-disabled={!data?.hasData}>
              <ButtonSpinner show={pdfPending} />
              Download PDF
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{type.label}</CardTitle>
          <CardDescription>
            {windowText} ·{" "}
            {data?.coarse ? "hourly averages (older than 8 days)" : `${INTERVAL_LABELS[bucketMinutes] ?? `${bucketMinutes} min`} average`}
            {" · "}
            {type.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <Skeleton className="h-[280px] w-full rounded-lg" />
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : data && !data.isSolar ? (
            <ChartEmptyState label="Daily reports are available for solar inverters" />
          ) : !data?.hasData ? (
            <ChartEmptyState label={days > 1 ? "No readings in this period" : `No readings on ${fmtDay(date)}`} />
          ) : (
            <ChartContainer config={chartConfig} className={cn("aspect-auto h-[280px] w-full transition-opacity", loading && "opacity-60")}>
              <ComposedChart accessibilityLayer data={data.points} margin={{ left: 0, right: 4, top: 8 }}>
                {days > 1 ? (
                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    interval="preserveStartEnd"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickFormatter={(t: string) => `${t.slice(8, 10)}/${t.slice(5, 7)}${bucketMinutes < 1440 ? ` ${t.slice(11, 16)}` : ""}`}
                  />
                ) : (
                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={0}
                    interval={0}
                    tick={(props: { x?: string | number; y?: string | number; payload?: { value: string } }) => (
                      <ChartTick x={props.x} y={props.y} payload={props.payload} />
                    )}
                  />
                )}
                <YAxis
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  domain={domain}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}`}
                  label={{ value: unit, position: "insideTopLeft", offset: 0, fontSize: 10, fill: "var(--muted-foreground)" }}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="dashed"
                      labelFormatter={(l) => {
                        const t = String(l);
                        if (bucketMinutes >= 1440) return fmtDay(t.slice(0, 10));
                        const h = Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16)) + bucketMinutes;
                        const end = `${String(Math.floor((h % 1440) / 60)).padStart(2, "0")}:${String(h % 60).padStart(2, "0")}`;
                        const day = days > 1 ? `${t.slice(8, 10)}/${t.slice(5, 7)} ` : "";
                        return `${day}${t.slice(11, 16)} – ${end}`;
                      }}
                      formatter={(value, name, item) => (
                        <span className="flex w-full items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                            {String(name)}
                          </span>
                          <span className="font-medium text-foreground tabular-nums">
                            {typeof value === "number" ? value.toFixed(unitById[item.dataKey as string] === "kW" ? 2 : 1) : String(value)}{" "}
                            {unitById[item.dataKey as string]}
                          </span>
                        </span>
                      )}
                    />
                  }
                />
                {series.map((s) =>
                  s.kind === "line" || drawAsLines ? (
                    <Line
                      key={s.id}
                      type="monotone"
                      dataKey={s.id}
                      name={s.label}
                      stroke={`var(--color-${s.id})`}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Bar key={s.id} dataKey={s.id} name={s.label} fill={`var(--color-${s.id})`} radius={bucketMinutes <= 15 ? 2 : 4} isAnimationActive={false} />
                  )
                )}
              </ComposedChart>
            </ChartContainer>
          )}

          {data?.hasData && series.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {series.map((s) => (
                <span key={s.id} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px]" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data?.hasData && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.summaries.map((s) => (
            <div key={s.id} className="rounded-xl border border-theme-border bg-theme-bg p-4">
              <p className="text-xs font-medium text-theme-muted">{s.label}</p>
              {s.unit === "kW" ? (
                <>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-theme-primary">
                    {(s.counterKwh ?? s.energyKwh ?? 0).toFixed(1)} <span className="text-sm font-normal text-theme-muted">kWh</span>
                  </p>
                  <p className="text-xs text-theme-muted">
                    {s.counterKwh !== null ? `Inverter's own count for the ${days > 1 ? "period" : "day"}` : "Estimated from the readings"}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-2xl font-semibold tabular-nums text-theme-primary">{formatValue(s.avg, s.unit)}</p>
              )}
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-theme-muted">
                <dt>Peak</dt>
                <dd className="text-right tabular-nums text-foreground">
                  {formatValue(s.max, s.unit)}
                  {s.maxAt ? ` at ${days > 1 ? `${s.maxAt.slice(8, 10)}/${s.maxAt.slice(5, 7)} ` : ""}${s.maxAt.slice(11, 16)}` : ""}
                </dd>
                {s.unit === "kW" ? (
                  <>
                    <dt>Average</dt>
                    <dd className="text-right tabular-nums text-foreground">{formatValue(s.avg, s.unit)}</dd>
                  </>
                ) : (
                  <>
                    <dt>Lowest</dt>
                    <dd className="text-right tabular-nums text-foreground">{formatValue(s.min, s.unit)}</dd>
                  </>
                )}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
