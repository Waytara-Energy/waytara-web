"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarClock, CheckCircle2, Eye, EyeOff, FileSpreadsheet, FileText, Loader2, Mail, MoreHorizontal, Pause, Pencil, Play, Plus, Send, Table2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeTable } from "@waytara/ui/realtime-provider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { deleteReportAction, sendReportNowAction, setReportEnabledAction } from "@/app/dashboard/reports/actions";
import { PARAMETER_BY_ID } from "@/lib/reports/parameters";
import { PERIOD_PRESETS, buildCustomReport } from "@/lib/reports/custom-report";
import type { ReportsBase } from "@/lib/reports/gather";
import { toRunView, type RunView, type SavedReportView } from "@/lib/reports/saved-report-view";
import { describeSchedule } from "@/lib/reports/schedule";
import { CustomReportView } from "./custom-report-view";
import { RealtimeRefresh } from "./realtime-refresh";
import { ReportBuilderSheet } from "./report-builder-sheet";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }) : "—");

interface RunRow {
  id: string;
  report_id: string;
  status: string;
  trigger: string;
  recipients: string[];
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

/** The customer's own reports, under the tabs: each with what it shows, when it is e-mailed, and the result of its latest e-mail,
 *  which updates live (a toast says when one is being sent and when it has gone). */
export function MyReports({ base, customerId, reports, runs }: { base: ReportsBase; customerId: string; reports: SavedReportView[]; runs: RunView[] }) {
  const router = useRouter();
  const [latest, setLatest] = React.useState<Record<string, RunView>>(() => {
    const m: Record<string, RunView> = {};
    for (const r of [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) m[r.reportId] = r;
    return m;
  });
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SavedReportView | null>(null);
  const [viewingId, setViewingId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<"graph" | "table">("graph");
  const [deleting, setDeleting] = React.useState<SavedReportView | null>(null);
  const names = React.useRef(new Map<string, string>());
  React.useEffect(() => {
    names.current = new Map(reports.map((r) => [r.id, r.name]));
  }, [reports]);
  const notified = React.useRef(new Map<string, number>());

  // Live: a run starts (a toast with a spinner), then ends (the same toast turns into "sent" or "failed").
  const onRun = React.useCallback((row: RunRow) => {
    const run = toRunView(row);
    setLatest((l) => ({ ...l, [run.reportId]: run }));
    const name = names.current.get(run.reportId);
    if (!name) return;
    if (run.status === "sending") toast.loading(`Sending "${name}"…`, { id: run.id });
    else {
      notified.current.set(run.reportId, Date.now());
      if (run.status === "sent") toast.success(`"${name}" was e-mailed`, { id: run.id, description: `To ${run.recipients.join(", ")}` });
      else toast.error(`"${name}" could not be sent`, { id: run.id, description: run.error ?? undefined });
    }
  }, []);
  const filter = `customer_id=eq.${customerId}`;
  useRealtimeTable<RunRow>("customer_report_runs", "INSERT", filter, (p) => onRun(p.new));
  useRealtimeTable<RunRow>("customer_report_runs", "UPDATE", filter, (p) => onRun(p.new));

  const viewing = reports.find((r) => r.id === viewingId) ?? null;
  const viewingReport = React.useMemo(() => {
    if (!viewing) return null;
    return buildCustomReport(base, { name: viewing.name, series: viewing.params.series, period: viewing.params.period, comparePrevious: viewing.params.comparePrevious }, base.today);
  }, [viewing, base]);

  const create = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const edit = (r: SavedReportView) => {
    setEditing(r);
    setSheetOpen(true);
  };

  return (
    <section className="space-y-3">
      <RealtimeRefresh table="customer_reports" event="UPDATE" filter={filter} debounceMs={800} />
      <RealtimeRefresh table="customer_reports" event="INSERT" filter={filter} debounceMs={800} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">My reports</h2>
          <p className="text-xs text-muted-foreground">Reports you made yourself, with the parameters you chose. Schedule one to have it e-mailed.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={create}>
          <Plus className="size-4" />
          Create report
        </Button>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium text-foreground">No reports of your own yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">Name a report, pick what it shows from any category, two or more make a comparison, and choose whether it is e-mailed every day, week or month.</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={create}>
            <Plus className="size-4" />
            Create your first report
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              r={r}
              run={latest[r.id]}
              active={viewingId === r.id}
              onView={() => setViewingId((v) => (v === r.id ? null : r.id))}
              onEdit={() => edit(r)}
              onDelete={() => setDeleting(r)}
              onToggle={async () => {
                const res = await setReportEnabledAction(r.id, !r.enabled);
                if (!res.ok) toast.error(res.error);
                else router.refresh();
              }}
              onSend={async (emails) => {
                const res = await sendReportNowAction(r.id, emails);
                if (!res.ok && !res.recorded) toast.error(res.error);
                // The live message normally says it; if none arrived, say it here.
                if (res.ok) {
                  window.setTimeout(() => {
                    if (Date.now() - (notified.current.get(r.id) ?? 0) > 3000) toast.success(`"${r.name}" was e-mailed`);
                  }, 1500);
                }
              }}
            />
          ))}
        </div>
      )}

      {viewing && viewingReport && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">{viewing.name}</h3>
              <p className="text-xs text-muted-foreground">{viewingReport.comparison ? "Comparison report" : "Report"} · {viewingReport.period.label}</p>
            </div>
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
              <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 max-sm:px-2.5">
                <a href={`/api/reports/custom?report=${viewing.id}&format=csv`} aria-label="Download CSV" title="Download CSV">
                  <FileSpreadsheet className="size-4" />
                  <span className="hidden sm:inline">CSV</span>
                </a>
              </Button>
              <Button asChild size="sm" className="h-9 gap-1.5 max-sm:px-2.5">
                <a href={`/api/reports/custom?report=${viewing.id}&format=pdf`} aria-label="Download PDF" title="Download PDF">
                  <FileText className="size-4" />
                  <span className="hidden sm:inline">PDF</span>
                </a>
              </Button>
            </div>
          </div>
          <CustomReportView report={viewingReport} view={view} />
        </div>
      )}

      <ReportBuilderSheet open={sheetOpen} onOpenChange={setSheetOpen} base={base} editing={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleting?.name}&quot; and its schedule are removed. Reports already e-mailed stay in the inbox they went to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                const res = await deleteReportAction(deleting.id);
                if (!res.ok) toast.error(res.error);
                else {
                  if (viewingId === deleting.id) setViewingId(null);
                  router.refresh();
                }
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ReportCard({ r, run, active, onView, onEdit, onDelete, onToggle, onSend }: { r: SavedReportView; run: RunView | undefined; active: boolean; onView: () => void; onEdit: () => void; onDelete: () => void; onToggle: () => void; onSend: (emails: string) => Promise<void> }) {
  const names = r.params.series.map((s) => s.label?.trim() || PARAMETER_BY_ID[s.param]?.label || s.param);
  const period = PERIOD_PRESETS.find((p) => p.id === r.params.period)?.label ?? "";
  const scheduled = r.schedule.kind !== "none";
  const [sendOpen, setSendOpen] = React.useState(false);
  const [emails, setEmails] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const to = [...(r.sendToMe ? ["you"] : []), ...r.recipients];

  const shown = names.slice(0, 3);
  return (
    <div className={`flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors ${active ? "border-primary" : "border-border"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <h3 className="truncate text-sm font-semibold text-foreground">{r.name}</h3>
          <div className="flex flex-wrap items-center gap-1">
            {shown.map((n, i) => (
              <span key={`${n}-${i}`} className="max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">
                {n}
              </span>
            ))}
            {names.length > shown.length && <span className="text-[11px] text-muted-foreground">+{names.length - shown.length}</span>}
            <span className="text-[11px] text-muted-foreground">· {period}</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`More for ${r.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Edit
            </DropdownMenuItem>
            {scheduled && (
              <DropdownMenuItem onSelect={onToggle}>
                {r.enabled ? <Pause /> : <Play />}
                {r.enabled ? "Pause the schedule" : "Resume the schedule"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-auto flex items-start justify-between gap-3 border-t border-border/60 pt-3">
        <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5 shrink-0" />
            <span className={`truncate ${scheduled && r.enabled ? "text-foreground" : ""}`}>{scheduled ? describeSchedule(r.schedule) : "Not scheduled"}</span>
            {scheduled && !r.enabled && <span className="shrink-0 rounded bg-muted px-1 text-[10px] uppercase tracking-wide">Paused</span>}
          </p>
          {scheduled && (
            <p className="truncate pl-5">
              {r.enabled && r.nextRunAt ? `Next ${when(r.nextRunAt)} · ` : ""}to {to.join(", ") || "nobody"}
            </p>
          )}
          <RunLine run={run} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant={active ? "secondary" : "ghost"} size="icon" className="size-8" onClick={onView} aria-label={active ? "Hide report" : "View report"} title={active ? "Hide" : "View"}>
            {active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <Popover open={sendOpen} onOpenChange={setSendOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="E-mail this report now" title="E-mail this report now">
                <Mail className="size-4" />
              </Button>
            </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-2 p-3">
            <p className="text-sm font-medium text-foreground">Send {`"${r.name}"`} now</p>
            <Input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="E-mail address(es), or leave empty" inputMode="email" className="h-9" />
            <p className="text-xs text-muted-foreground">Empty sends it to the usual people. An address here gets it just this once.</p>
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={sending}
                onClick={async () => {
                  setSending(true);
                  await onSend(emails);
                  setSending(false);
                  setSendOpen(false);
                  setEmails("");
                }}
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
                Send
              </Button>
            </div>
          </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

function RunLine({ run }: { run: RunView | undefined }) {
  if (!run) return null;
  if (run.status === "sending")
    return (
      <p className="flex items-center gap-1.5 text-foreground">
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
        Sending now…
      </p>
    );
  if (run.status === "sent")
    return (
      <p className="flex items-center gap-1.5">
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
        <span className="truncate">
          Sent {when(run.finishedAt ?? run.startedAt)} to {run.recipients.join(", ")}
        </span>
      </p>
    );
  return (
    <p className="flex items-center gap-1.5 text-destructive">
      <XCircle className="size-3.5 shrink-0" />
      <span className="truncate">Not sent {when(run.finishedAt ?? run.startedAt)}{run.error ? `: ${run.error}` : ""}</span>
    </p>
  );
}
