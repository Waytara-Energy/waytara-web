"use client";

import * as React from "react";
import Link from "next/link";
import { CarFront, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EvPerfSession } from "@/lib/ev-perf-stats";
import { formatSeconds, sessionStatusLabel } from "@/lib/ev-sessions";
import { buildEvReport, evSummaryFigures } from "@/lib/reports/ev-report";
import { periodText } from "./perf-data";
import { Panel, StatTile } from "./perf-kit";
import { RangeBar, LONG_PRESETS } from "./range-bar";
import { RangeProvider, useRange } from "./range-context";
import { useDownloadPending } from "./use-download-pending";

const IST_MS = 19_800_000;
const istDay = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10);
const when = (ts: string) => new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
/** The newest sessions listed on the page; the downloads hold all of them. */
const LIST_LIMIT = 25;

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

/** Reports for an EV charger: the period is chosen with the range picker (as on the solar Reports page), the figures and the sessions of it are
 *  shown, and the same report downloads as CSV or PDF. */
export function EvReportsBoard(props: EvReportsProps) {
  return (
    <RangeProvider deviceId={props.deviceId} scope="reports-ev" defaultPreset="30d">
      <Board {...props} />
    </RangeProvider>
  );
}

function Board({ deviceId, deviceLabel, customerName, siteName, tariffRate, tariffNote, sessions }: EvReportsProps) {
  const range = useRange();
  const [csvPending, triggerCsv] = useDownloadPending();
  const [pdfPending, triggerPdf] = useDownloadPending();
  const fromMs = range?.window.fromMs ?? 0;
  const toMs = range?.window.toMs ?? 0;
  const period = range ? periodText(range.preset, { fromMs, toMs }) : "";
  const from = istDay(fromMs);
  const to = istDay(Math.max(fromMs, toMs - 1));

  const report = React.useMemo(
    () => buildEvReport({ customerName, siteName, deviceLabel, generatedAt: "", from, to, tariffRate, tariffNote, sessions }),
    [customerName, siteName, deviceLabel, from, to, tariffRate, tariffNote, sessions],
  );
  const rows = report.stats.rows;
  const has = rows.length > 0;
  const query = `device=${deviceId}&from=${from}&to=${to}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CarFront className="size-7" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-theme-muted">EV charging report · {period}</p>
            <p className="text-sm text-muted-foreground">
              {deviceLabel} · {report.days} {report.days === 1 ? "day" : "days"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeBar presets={LONG_PRESETS} />
          <Button asChild variant="outline" size="sm" className={`h-9 gap-1.5 max-sm:px-2.5 ${has ? "" : "pointer-events-none opacity-50"}`}>
            <a href={`/api/reports/ev.csv?${query}`} onClick={triggerCsv} aria-label="Download CSV" aria-disabled={!has} title="Download CSV">
              <ButtonSpinner show={csvPending} />
              <FileSpreadsheet className="size-4" />
              <span className="hidden sm:inline">CSV</span>
            </a>
          </Button>
          <Button asChild size="sm" className={`h-9 gap-1.5 max-sm:px-2.5 ${has ? "" : "pointer-events-none opacity-50"}`}>
            <a href={`/api/reports/ev.pdf?${query}`} onClick={triggerPdf} aria-label="Download PDF" aria-disabled={!has} title="Download PDF">
              <ButtonSpinner show={pdfPending} />
              <FileText className="size-4" />
              <span className="hidden sm:inline">PDF</span>
            </a>
          </Button>
        </div>
      </div>

      {!has && <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">No charging sessions in this period. Pick a longer period.</p>}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
        {evSummaryFigures(report).map((f) => (
          <StatTile key={f.label} label={`${f.label} · ${period}`} value={has ? f.value : "—"} />
        ))}
      </div>
      {report.stats.sample && has && <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Sample data: this charger has no real charge yet, so this report is made from sample charges.</p>}
      {report.stats.cost && has && (
        <p className="text-xs text-muted-foreground">
          Priced at ₹{report.stats.cost.rate.toFixed(2)}/kWh{tariffNote ? ` (${tariffNote})` : ""}. Energy without a source split counts as grid.
        </p>
      )}

      {has && (
        <Panel title="Charging sessions" description={`${period}${rows.length > LIST_LIMIT ? ` · the newest ${LIST_LIMIT} of ${rows.length}; the downloads list all of them` : ""}`}>
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
              {rows.slice(0, LIST_LIMIT).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-foreground">{when(r.startedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatSeconds(r.durationS)}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{r.energyKwh === null ? "—" : `${r.energyKwh.toFixed(1)} kWh`}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.peakKw === null ? "—" : `${r.peakKw.toFixed(1)} kW`}</TableCell>
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
