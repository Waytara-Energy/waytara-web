"use client";

import * as React from "react";
import { CarFront, FileSpreadsheet, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonSpinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEvSessionDetail } from "@/app/dashboard/ev-session-detail-action";
import type { EvPerfSession, EvSpan } from "@/lib/ev-perf-stats";
import { formatSeconds, sessionStatusLabel } from "@/lib/ev-sessions";
import { buildEvReport, evSummaryFigures } from "@/lib/reports/ev-report";
import { cn } from "@/lib/utils";
import { EvSessionDialog } from "./ev-session-dialog";
import { periodText } from "./perf-data";
import { StatTile, useKwhText } from "./perf-kit";
import { RangeBar, LONG_PRESETS } from "./range-bar";
import { RangeProvider, useRange } from "./range-context";
import { useDownloadPending } from "./use-download-pending";

const IST_MS = 19_800_000;
const istDay = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10);
const when = (ts: string) => new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
/** How many sessions the list shows at first, and how many more each press of "Show more" adds. */
const PAGE = 25;
/** What the headline already says: not listed a second time in the figures. */
const IN_HEADLINE = new Set(["Charging sessions", "Energy delivered", "Saved by solar and battery"]);

export interface EvReportsProps {
  deviceId: string;
  deviceLabel: string;
  customerName: string;
  siteName: string | null;
  tariffRate: number | null;
  tariffNote: string;
  /** The charger's sessions of the last two years, as many as the page read. */
  sessions: EvPerfSession[];
}

/** The period of the page's picker, as the report reads it (India days, both ends included). */
function useReport(props: EvReportsProps, span: EvSpan) {
  const { customerName, siteName, deviceLabel, tariffRate, tariffNote, sessions } = props;
  const from = istDay(span.fromMs);
  const to = istDay(Math.max(span.fromMs, span.toMs - 1));
  const report = React.useMemo(
    () => buildEvReport({ customerName, siteName, deviceLabel, generatedAt: "", from, to, tariffRate, tariffNote, sessions }),
    [customerName, siteName, deviceLabel, from, to, tariffRate, tariffNote, sessions],
  );
  return { report, from, to };
}

/** Reports for an EV charger when it is the whole page (a site without an inverter): the headline with its period picker, then the body. */
export function EvReportsBoard(props: EvReportsProps) {
  return (
    <RangeProvider deviceId={props.deviceId} scope="reports-ev" defaultPreset="30d">
      <Standalone {...props} />
    </RangeProvider>
  );
}

function Standalone(props: EvReportsProps) {
  const range = useRange();
  const fromMs = range?.window.fromMs ?? 0;
  const toMs = range?.window.toMs ?? 0;
  const span = React.useMemo(() => ({ fromMs, toMs }), [fromMs, toMs]);
  const period = range ? periodText(range.preset, span) : "";
  return (
    <div className="space-y-5">
      <EvReportsHeadline {...props} span={span} periodText={period} />
      <EvReportsBody {...props} span={span} periodText={period} />
    </div>
  );
}

/** The line above the Reports tabs for the EV Charger, like the other tabs': the energy delivered in the period, two more figures about it and the
 *  one period picker at the right. */
export function EvReportsHeadline({ span, periodText: period, ...props }: EvReportsProps & { span: EvSpan; periodText: string }) {
  const kwh = useKwhText();
  const { report } = useReport(props, span);
  const has = report.stats.rows.length > 0;
  const cost = report.stats.cost;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CarFront className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-theme-muted">Energy delivered · {period}</p>
          <p className="text-4xl font-semibold leading-tight tracking-tight text-theme-primary">{has ? kwh(report.stats.energyKwh) : "—"}</p>
        </div>
        <div className="hidden items-center gap-8 pl-6 md:flex">
          <Figure label="Charging sessions" value={has ? String(report.stats.sessions) : "—"} />
          {cost ? <Figure label="Saved by solar and battery" value={has ? `₹${cost.saved.toFixed(0)}` : "—"} good /> : null}
        </div>
      </div>
      <RangeBar presets={LONG_PRESETS} />
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

/** What is under the headline: the period's figures, then every charge of it (filter by status, open one in full) with the CSV and PDF of the
 *  same period. The period is the page's one picker. */
export function EvReportsBody({ span, periodText: period, ...props }: EvReportsProps & { span: EvSpan; periodText: string }) {
  const { report, from, to } = useReport(props, span);
  const [csvPending, triggerCsv] = useDownloadPending();
  const [pdfPending, triggerPdf] = useDownloadPending();
  const [status, setStatus] = React.useState<string>("all");
  // how many rows are listed; a new period or filter starts at the top of the list again (the count belongs to the key it was raised under)
  const [more, setMore] = React.useState<{ key: string; n: number } | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const rows = report.stats.rows;
  const has = rows.length > 0;
  const query = `device=${props.deviceId}&from=${from}&to=${to}`;

  // The statuses this period has, each with its count, for the filter (a status nobody has is not offered).
  const statuses = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    return [...counts].map(([key, count]) => ({ key, count, label: sessionStatusLabel(key).label }));
  }, [rows]);
  const active = statuses.some((s) => s.key === status) ? status : "all";
  const visible = active === "all" ? rows : rows.filter((r) => r.status === active);

  const listKey = `${active}|${from}|${to}`;
  const shown = more && more.key === listKey ? more.n : PAGE;

  return (
    <div className="space-y-5">
      {!has && <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">No charging sessions in this period. Pick a longer period.</p>}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
        {evSummaryFigures(report)
          .filter((f) => !IN_HEADLINE.has(f.label))
          .map((f) => (
            <StatTile key={f.label} label={`${f.label} · ${period}`} value={has ? f.value : "—"} />
          ))}
      </div>
      {report.stats.sample && has && <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Sample data: this charger has no real charge yet, so this report is made from sample charges.</p>}
      {report.stats.cost && has && (
        <p className="text-xs text-muted-foreground">
          Priced at ₹{report.stats.cost.rate.toFixed(2)}/kWh{props.tariffNote ? ` (${props.tariffNote})` : ""}. Energy without a source split counts as grid.
        </p>
      )}

      {has && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-sm">Charging sessions</CardTitle>
              <CardDescription>
                {period} · {visible.length} {visible.length === 1 ? "session" : "sessions"}. Press one to see that charge in full.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 max-sm:px-2.5">
                <a href={`/api/reports/ev.csv?${query}`} onClick={triggerCsv} aria-label="Download CSV" title="Download CSV">
                  <ButtonSpinner show={csvPending} />
                  <FileSpreadsheet className="size-4" />
                  <span className="hidden sm:inline">CSV</span>
                </a>
              </Button>
              <Button asChild size="sm" className="h-9 gap-1.5 max-sm:px-2.5">
                <a href={`/api/reports/ev.pdf?${query}`} onClick={triggerPdf} aria-label="Download PDF" title="Download PDF">
                  <ButtonSpinner show={pdfPending} />
                  <FileText className="size-4" />
                  <span className="hidden sm:inline">PDF</span>
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {statuses.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Show sessions">
                {[{ key: "all", label: "All", count: rows.length }, ...statuses].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={active === s.key}
                    onClick={() => setStatus(s.key)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      active === s.key ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s.label} · {s.count}
                  </button>
                ))}
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Charging time</TableHead>
                  <TableHead className="text-right">Energy</TableHead>
                  <TableHead className="text-right">Peak</TableHead>
                  <TableHead className="text-right">Solar</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.slice(0, shown).map((r) => {
                  const st = sessionStatusLabel(r.status);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="tabular-nums">
                        <button type="button" onClick={() => setOpenId(r.id)} className="font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                          {when(r.startedAt)}
                        </button>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{r.durationS === null ? "—" : formatSeconds(r.durationS)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.energyKwh === null ? "—" : `${r.energyKwh.toFixed(r.energyKwh >= 10 ? 1 : 2)} kWh`}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{r.peakKw === null ? "—" : `${r.peakKw.toFixed(1)} kW`}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{r.solarSharePct === null ? "—" : `${r.solarSharePct.toFixed(0)}%`}</TableCell>
                      <TableCell>
                        <Badge variant={st.tone === "warn" ? "alert" : st.tone === "good" ? "default" : "secondary"}>{st.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {visible.length > shown && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Showing {shown} of {visible.length}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => setMore({ key: listKey, n: shown + PAGE * 2 })}>
                  Show more
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <EvSessionDialog sessionId={openId} onClose={() => setOpenId(null)} load={getEvSessionDetail} />
    </div>
  );
}
