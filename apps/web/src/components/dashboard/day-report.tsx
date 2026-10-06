"use client";

import * as React from "react";
import { Bar, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  REPORT_BUCKET_OPTIONS,
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
import { useDownloadPending } from "./report-controls";

interface DayReportResponse {
  date: string;
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

export function DayReport({ deviceId, available }: { deviceId: string; available: AvailableReport[] }) {
  const today = todayIst();
  const [typeId, setTypeId] = React.useState<string>(available.some((a) => a.id === DEFAULT_REPORT_TYPE) ? DEFAULT_REPORT_TYPE : available[0].id);
  const [date, setDate] = React.useState<string>(today);
  const [interval, setIntervalMinutes] = React.useState<number>(DEFAULT_REPORT_BUCKET_MINUTES);
  // Keyed by the query it answers, so "loading" is simply "the answer on screen is for a
  // different query" - no setState needed in the effect body.
  const [result, setResult] = React.useState<{ key: string; data: DayReportResponse | null; error: string | null } | null>(null);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [csvPending, triggerCsvPending] = useDownloadPending();
  const [pdfPending, triggerPdfPending] = useDownloadPending();

  // Only the reports, and within them only the series, this device's equipment_metrics enables.
  const enabledSeries = new Set(available.find((a) => a.id === typeId)?.seriesIds);
  const type = getReportType(typeId);
  const query = `device=${deviceId}&type=${typeId}&date=${date}&interval=${interval}`;

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
    const timer = date === todayIst() ? setInterval(() => void load(controller.signal), 60_000) : null;
    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [load, date]);

  const loading = result?.key !== query;
  const data = result?.data ?? null;
  const error = loading ? null : result?.error ?? null;

  const availableIds = new Set(available.map((a) => a.id));
  const grouped = GROUP_ORDER.map((g) => ({ group: g, items: REPORT_TYPES.filter((t) => t.group === g && availableIds.has(t.id)) })).filter((g) => g.items.length > 0);
  const series = type.series.filter((s) => enabledSeries.has(s.id));
  const unit = series[0].unit;
  const drawAsLines = series.length > 2;
  const bucketMinutes = data?.bucketMinutes ?? interval;

  const chartConfig = React.useMemo(
    () => Object.fromEntries(series.map((s) => [s.id, { label: s.label, color: s.color }])) satisfies ChartConfig,
    [series]
  );

  const unitById = Object.fromEntries(series.map((s) => [s.id, s.unit]));
  const domain: [number | "auto", number | "auto"] = unit === "%" ? [0, 100] : unit === "kW" ? [0, "auto"] : ["auto", "auto"];
  const longDate = stringToDate(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isToday = date === today;

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

        <div className="space-y-1">
          <label className="text-xs font-medium text-theme-muted">Interval</label>
          <Select value={String(interval)} onValueChange={(v) => setIntervalMinutes(Number(v))}>
            <SelectTrigger className="h-9 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_BUCKET_OPTIONS.map((o) => (
                <SelectItem key={o.minutes} value={String(o.minutes)}>
                  {o.label}
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
            {longDate}, 00:00–23:59 ·{" "}
            {data?.coarse ? "hourly averages (older than 90 days)" : `${REPORT_BUCKET_OPTIONS.find((o) => o.minutes === bucketMinutes)?.label ?? `${bucketMinutes} min`} average`}
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
            <ChartEmptyState label={`No readings on ${stringToDate(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`} />
          ) : (
            <ChartContainer config={chartConfig} className={cn("aspect-auto h-[280px] w-full transition-opacity", loading && "opacity-60")}>
              <ComposedChart accessibilityLayer data={data.points} margin={{ left: 0, right: 4, top: 8 }}>
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
                        const start = String(l);
                        const h = Number(start.slice(11, 13)) * 60 + Number(start.slice(14, 16)) + bucketMinutes;
                        const end = `${String(Math.floor((h % 1440) / 60)).padStart(2, "0")}:${String(h % 60).padStart(2, "0")}`;
                        return `${start.slice(11, 16)} – ${end}`;
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
                    {s.counterKwh !== null ? "Inverter's own count for the day" : "Estimated from the readings"}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-2xl font-semibold tabular-nums text-theme-primary">{formatValue(s.avg, s.unit)}</p>
              )}
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-theme-muted">
                <dt>Peak</dt>
                <dd className="text-right tabular-nums text-foreground">
                  {formatValue(s.max, s.unit)}
                  {s.maxAt ? ` at ${s.maxAt}` : ""}
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
