"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ButtonSpinner } from "@/components/ui/spinner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { saveReportAction, sendReportNowAction } from "@/app/dashboard/reports/actions";
import { MAX_SERIES, PERIOD_PRESETS, buildCustomReport, formatValue, type PeriodPreset } from "@/lib/reports/custom-report";
import { PARAMETER_BY_ID, PARAM_CATEGORIES, parametersOf } from "@/lib/reports/parameters";
import { MAX_RECIPIENTS, parseEmails } from "@/lib/reports/recipients";
import { reportFormSchema } from "@/lib/reports/saved-report";
import type { SavedReportView } from "@/lib/reports/saved-report-view";
import { WEEKDAYS, describeSchedule, type ScheduleKind } from "@/lib/reports/schedule";
import type { ReportsBase } from "@/lib/reports/gather";

interface Row {
  key: number;
  param: string;
  label: string;
}

let nextKey = 1;
const newRow = (param = "pv", label = ""): Row => ({ key: nextKey++, param, label });

/** The "Create a report" panel (slides in from the right, like the notifications): name it, pick parameters from any category - more
 *  than one makes a comparison - give each its own display name, choose the period, and say if and when it is e-mailed, and to whom. */
export function ReportBuilderSheet({ open, onOpenChange, base, editing }: { open: boolean; onOpenChange: (open: boolean) => void; base: ReportsBase; editing: SavedReportView | null }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>([newRow()]);
  const [period, setPeriod] = React.useState<PeriodPreset>("last30");
  const [pdf, setPdf] = React.useState(true);
  const [csv, setCsv] = React.useState(false);
  const [compare, setCompare] = React.useState(false);
  const [kind, setKind] = React.useState<ScheduleKind>("none");
  const [time, setTime] = React.useState("08:00");
  const [dow, setDow] = React.useState(1);
  const [dom, setDom] = React.useState(1);
  const [sendToMe, setSendToMe] = React.useState(true);
  const [extra, setExtra] = React.useState<string[]>([]);
  const [typed, setTyped] = React.useState("");
  const [sendOnce, setSendOnce] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, startSaving] = React.useTransition();

  // Fill the form when the panel opens: from the report being edited, or empty.
  React.useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setError(null);
    setTyped("");
    setSendOnce("");
    if (editing) {
      setName(editing.name);
      setRows(editing.params.series.map((s) => newRow(s.param, s.label ?? "")));
      setPeriod(editing.params.period);
      setPdf(editing.params.formats.includes("pdf"));
      setCsv(editing.params.formats.includes("csv"));
      setCompare(!!editing.params.comparePrevious);
      setKind(editing.schedule.kind);
      setTime(editing.schedule.time);
      setDow(editing.schedule.dow ?? 1);
      setDom(editing.schedule.dom ?? 1);
      setSendToMe(editing.sendToMe);
      setExtra(editing.recipients);
    } else {
      setName("");
      setRows([newRow()]);
      setPeriod("last30");
      setPdf(true);
      setCsv(false);
      setCompare(false);
      setKind("none");
      setTime("08:00");
      setDow(1);
      setDom(1);
      setSendToMe(true);
      setExtra([]);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editing]);

  const comparison = rows.length > 1;
  const monthly = rows.some((r) => PARAMETER_BY_ID[r.param]?.monthlyOnly);

  // A quick look at what the report would say, worked out from the data already on the page.
  const preview = React.useMemo(() => {
    try {
      return buildCustomReport(base, { name: name || "Report", series: rows.map((r) => ({ param: r.param, label: r.label })), period, comparePrevious: compare }, base.today);
    } catch {
      return null;
    }
  }, [base, rows, period, compare, name]);

  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addEmails = () => {
    const { valid, invalid } = parseEmails(typed);
    if (invalid.length > 0) {
      setError(`Not a valid e-mail address: ${invalid.join(", ")}`);
      return;
    }
    const merged = [...new Set([...extra, ...valid])];
    if (merged.length > MAX_RECIPIENTS) {
      setError(`Add up to ${MAX_RECIPIENTS} addresses.`);
      return;
    }
    setError(null);
    setExtra(merged);
    setTyped("");
  };

  const submit = (alsoSend: boolean) => {
    setError(null);
    // A half-typed address is added rather than lost.
    const pending = parseEmails(typed);
    if (pending.invalid.length > 0) return setError(`Not a valid e-mail address: ${pending.invalid.join(", ")}`);
    const recipients = [...new Set([...extra, ...pending.valid])];
    const input = {
      name,
      params: { series: rows.map((r) => ({ param: r.param, label: r.label.trim() || undefined })), period, formats: [...(pdf ? ["pdf"] : []), ...(csv ? ["csv"] : [])], comparePrevious: compare },
      schedule: { kind, time, dow: kind === "weekly" ? dow : null, dom: kind === "monthly" ? dom : null },
      sendToMe,
      recipients,
      enabled: editing?.enabled ?? true,
    };
    const check = reportFormSchema.safeParse(input);
    if (!check.success) return setError(check.error.issues[0]?.message ?? "Check the report's settings.");
    const once = parseEmails(sendOnce);
    if (alsoSend && once.invalid.length > 0) return setError(`Not a valid e-mail address: ${once.invalid.join(", ")}`);

    startSaving(async () => {
      const saved = await saveReportAction(input, editing?.id ?? null, base.deviceId);
      if (!saved.ok) return setError(saved.error);
      if (alsoSend && saved.id) {
        const sent = await sendReportNowAction(saved.id, sendOnce);
        if (!sent.ok) toast.error(sent.error);
      }
      toast.success(editing ? "Report updated" : "Report created", { description: alsoSend ? "It is being e-mailed now." : kind === "none" ? "Open it any time from My reports." : describeSchedule({ kind, time, dow, dom }) });
      onOpenChange(false);
      router.refresh();
    });
  };

  const field = "space-y-1.5";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="space-y-1 border-b border-theme-border p-5 pr-12 text-left">
          <SheetTitle>{editing ? "Edit report" : "Create a report"}</SheetTitle>
          <SheetDescription>Choose what it shows, how it is named, and whether it is e-mailed on a schedule.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <div className={field}>
            <Label htmlFor="report-name">Report name</Label>
            <Input id="report-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Solar vs home use" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Parameters</Label>
              {comparison && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Comparison report</span>}
            </div>
            {rows.map((r, i) => {
              const p = PARAMETER_BY_ID[r.param];
              return (
                <div key={r.key} className="space-y-2 rounded-lg border border-theme-border p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Category</span>
                      <Select value={p?.category} onValueChange={(c) => setRow(r.key, { param: parametersOf(c as (typeof PARAM_CATEGORIES)[number]["id"])[0].id })}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PARAM_CATEGORIES.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Parameter</span>
                      <Select value={r.param} onValueChange={(v) => setRow(r.key, { param: v })}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>{PARAM_CATEGORIES.find((c) => c.id === p?.category)?.label}</SelectLabel>
                            {parametersOf(p?.category ?? "solar").map((x) => (
                              <SelectItem key={x.id} value={x.id}>
                                {x.label} · {x.unit}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <span className="text-xs text-muted-foreground">Display name in the report</span>
                      <Input value={r.label} onChange={(e) => setRow(r.key, { label: e.target.value })} maxLength={40} placeholder={p?.label} className="h-9" />
                    </div>
                    {rows.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label={`Remove parameter ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  {p && <p className="text-xs text-muted-foreground">{p.description}</p>}
                </div>
              );
            })}
            {rows.length < MAX_SERIES && (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRows((rs) => [...rs, newRow(rs[rs.length - 1] ? (rs[rs.length - 1].param === "load" ? "pv" : "load") : "pv")])}>
                <Plus className="size-4" />
                Add another parameter
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Add a parameter from another category to compare them in one report.{monthly ? " A money figure groups the report by month." : ""}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={field}>
              <Label>Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <Label>Files</Label>
              <div className="flex h-9 items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={pdf} onCheckedChange={(v) => setPdf(v === true)} /> PDF
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={csv} onCheckedChange={(v) => setCsv(v === true)} /> CSV
                </label>
              </div>
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Compare with the period before
              <span className="block text-xs text-muted-foreground">Adds the same figures for the stretch just before, and the change.</span>
            </span>
            <Switch checked={compare} onCheckedChange={setCompare} />
          </label>

          {preview && preview.series.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs">
              <p className="mb-1 font-medium text-foreground">What it would say now · {preview.period.label.toLowerCase()}</p>
              <ul className="space-y-0.5 text-muted-foreground">
                {preview.series.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3">
                    <span className="truncate">{s.label}</span>
                    <span className="tabular-nums text-foreground">{formatValue(s.total, s.unit)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3 border-t border-theme-border pt-5">
            <div className={field}>
              <Label>E-mail it</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ScheduleKind)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Never, I will open it here</SelectItem>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekly">Every week</SelectItem>
                  <SelectItem value="monthly">Every month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {kind !== "none" && (
              <div className="grid grid-cols-2 gap-3">
                {kind === "weekly" && (
                  <div className={field}>
                    <Label>On</Label>
                    <Select value={String(dow)} onValueChange={(v) => setDow(Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((d, i) => (
                          <SelectItem key={d} value={String(i)}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {kind === "monthly" && (
                  <div className={field}>
                    <Label>On day</Label>
                    <Select value={String(dom)} onValueChange={(v) => setDom(Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {d}
                          </SelectItem>
                        ))}
                        <SelectItem value="0">Last day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className={field}>
                  <Label htmlFor="report-time">At, India time</Label>
                  <Input id="report-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Send to</Label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-theme-border px-3 py-2 text-sm">
                <span className="min-w-0">
                  Me
                  <span className="block truncate text-xs text-muted-foreground">{base.customerEmail ?? "your account e-mail"}</span>
                </span>
                <Switch checked={sendToMe} onCheckedChange={setSendToMe} />
              </label>
              {extra.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {extra.map((e) => (
                    <span key={e} className="inline-flex items-center gap-1 rounded-full border border-theme-border bg-muted/40 py-0.5 pl-2.5 pr-1 text-xs">
                      {e}
                      <button type="button" aria-label={`Remove ${e}`} className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setExtra((x) => x.filter((y) => y !== e))}>
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addEmails();
                    }
                  }}
                  placeholder="Add more e-mail addresses"
                  inputMode="email"
                  className="h-9"
                />
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={addEmails} disabled={!typed.trim()}>
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Up to {MAX_RECIPIENTS} addresses besides your own. Separate several with commas.</p>
            </div>

            <div className="space-y-1.5 rounded-lg border border-dashed border-theme-border p-3">
              <Label htmlFor="send-once" className="flex items-center gap-1.5">
                <Mail className="size-3.5" />
                Send a copy now, just this once
              </Label>
              <Input id="send-once" value={sendOnce} onChange={(e) => setSendOnce(e.target.value)} placeholder="Leave empty to send it to the usual people" inputMode="email" className="h-9" />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-theme-border p-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={() => submit(true)} disabled={saving}>
            <ButtonSpinner show={saving} />
            Save and send now
          </Button>
          <Button type="button" onClick={() => submit(false)} disabled={saving}>
            <ButtonSpinner show={saving} />
            {editing ? "Save changes" : "Save report"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
