"use client";

import * as React from "react";
import { FileBarChart, FilePlus2, Zap, type LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/savings";
import { istDate } from "@/lib/telemetry/combine";
import { buildPeriodView, type PeriodView } from "@/lib/reports/period-view";
import type { AvailableReport } from "@/lib/report-types";
import type { ReportsBase } from "@/lib/reports/gather";
import type { RunView, SavedReportView } from "@/lib/reports/saved-report-view";
import { cn } from "@/lib/utils";
import { periodText } from "./perf-data";
import { fmtKwhText } from "./perf-kit";
import { RangeBar, LONG_PRESETS } from "./range-bar";
import { RangeProvider, useRange } from "./range-context";
import { ReportsDownloads } from "./reports-downloads";
import { ReportsEnergy } from "./reports-energy";
import { ReportsSummary } from "./reports-summary";

type SectionId = "summary" | "energy" | "downloads";
const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; active: string }[] = [
  { id: "summary", label: "Summary", icon: FileBarChart, active: "data-[state=active]:border-primary data-[state=active]:text-primary" },
  { id: "energy", label: "Energy", icon: Zap, active: "data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400" },
  { id: "downloads", label: "Generate", icon: FilePlus2, active: "data-[state=active]:border-sky-500 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400" },
];

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
// A refresh after saving, pausing or deleting a report can drop "#downloads" from the address; a tab click always sets one, so an
// empty hash that follows a real one is that refresh and the tab stays where it was (the board forgets it when it unmounts).
let lastHash = "";
const readHash = () => {
  const h = window.location.hash.replace("#", "");
  if (h) lastHash = h;
  return h || lastHash;
};

/** The Reports page for a solar inverter: the period is chosen once at the top and every tab follows it. `detailed` is the
 *  time-series report (server-rendered), shown under Generate. */
export function ReportsBoard({ base, customerId, reports, runs, available }: { base: ReportsBase; customerId: string; reports: SavedReportView[]; runs: RunView[]; available: AvailableReport[] }) {
  return (
    <RangeProvider deviceId={base.deviceId ?? "none"} scope="reports" defaultPreset="30d">
      <Board base={base} customerId={customerId} reports={reports} runs={runs} available={available} />
    </RangeProvider>
  );
}

function Board({ base, customerId, reports, runs, available }: { base: ReportsBase; customerId: string; reports: SavedReportView[]; runs: RunView[]; available: AvailableReport[] }) {
  const range = useRange();
  const hash = React.useSyncExternalStore(subscribeHash, readHash, () => "");
  const section: SectionId = (SECTIONS.map((s) => s.id) as string[]).includes(hash) ? (hash as SectionId) : "summary";

  React.useEffect(() => {
    // Put the dropped hash back so a reload or a copied link opens the same tab.
    if (hash && !window.location.hash) window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${hash}`);
  });
  React.useEffect(() => () => void (lastHash = ""), []);

  const fromMs = range?.window.fromMs ?? 0;
  const toMs = range?.window.toMs ?? 0;
  const view = React.useMemo<PeriodView>(() => {
    const from = fromMs > 0 ? istDate(fromMs) : base.today;
    const lastDay = toMs > 0 ? istDate(toMs - 1) : base.today;
    return buildPeriodView(base, from, lastDay > base.today ? base.today : lastDay);
  }, [base, fromMs, toMs]);
  const label = range ? periodText(range.preset, { fromMs, toMs }) : "";

  return (
    <div className="space-y-5">
      <Headline section={section} view={view} label={label} reports={reports} runs={runs} />

      <Tabs value={section} onValueChange={(v) => (window.location.hash = v)}>
        <TabsList variant="line">
          {SECTIONS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} variant="line" className={t.active}>
              <t.icon className="size-4 shrink-0 group-data-[state=active]:hidden" />
              <span className="text-sm font-medium">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div key={section}>
        {section === "summary" && <ReportsSummary base={base} view={view} label={label} />}
        {section === "energy" && <ReportsEnergy base={base} view={view} />}
        {section === "downloads" && <ReportsDownloads base={base} customerId={customerId} reports={reports} runs={runs} available={available} />}
      </div>
    </div>
  );
}

// The icon and accent of each tab, the same as the tab itself (like the Performance page).
const VISUALS: Record<SectionId, string> = {
  summary: "bg-primary/15 text-primary",
  energy: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  downloads: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};

/** The line above the tabs, like Performance's: the open tab's own headline figure and two more about it. Summary and Energy follow
 *  the period picker at the right; Generate is about the customer's own reports, so it has no period and no picker. */
function Headline({ section, view, label, reports, runs }: { section: SectionId; view: PeriodView; label: string; reports: SavedReportView[]; runs: RunView[] }) {
  const c = view.current;
  const has = c.days > 0;
  const lastSent = runs.filter((r) => r.status === "sent").sort((a, b) => (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt))[0];
  const scheduled = reports.filter((r) => r.schedule.kind !== "none" && r.enabled).length;
  const head: { label: string; value: string; figures: { label: string; value: string; good?: boolean }[]; picker: boolean } =
    section === "energy"
      ? {
          label: `Energy used · ${label}`,
          value: has ? fmtKwhText(c.loadKwh) : "—",
          figures: [
            { label: "Bought from the grid", value: has ? fmtKwhText(c.importKwh) : "—" },
            { label: "Sent to the grid", value: has ? fmtKwhText(c.exportKwh) : "—" },
          ],
          picker: true,
        }
      : section === "downloads"
        ? {
            label: "My reports",
            value: String(reports.length),
            figures: [
              { label: "Scheduled", value: String(scheduled) },
              { label: "Last e-mailed", value: lastSent ? new Date(lastSent.finishedAt ?? lastSent.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "—" },
            ],
            picker: false,
          }
        : {
            label: `Solar generated · ${label}`,
            value: has ? fmtKwhText(c.pvKwh) : "—",
            figures: [
              { label: "Used", value: has ? fmtKwhText(c.loadKwh) : "—" },
              { label: "Saved", value: has ? inr(view.bill.saved) : "—", good: true },
            ],
            picker: true,
          };
  const Icon = SECTIONS.find((s) => s.id === section)?.icon ?? FileBarChart;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", VISUALS[section])}>
          <Icon className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-theme-muted">{head.label}</p>
          <p className="text-4xl font-semibold leading-tight tracking-tight text-theme-primary">{head.value}</p>
        </div>
        <div className="hidden items-center gap-8 pl-6 md:flex">
          {head.figures.map((f) => (
            <Figure key={f.label} label={f.label} value={f.value} good={f.good} />
          ))}
        </div>
      </div>
      {head.picker && <RangeBar presets={LONG_PRESETS} />}
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
