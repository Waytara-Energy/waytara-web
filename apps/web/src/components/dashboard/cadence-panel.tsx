"use client";

import * as React from "react";
import { Download, RotateCcw } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { CadenceApiError, createCadenceClient, saveBlob, type PreviewAnswer } from "@waytara/cadence/client";
import { cadenceText, groupKeys, keyTitle, type CadenceKey } from "@waytara/cadence/pick";
import { CADENCE_MAX_DAYS, CADENCE_MAX_KEYS, oldestDay, planPeriod } from "@waytara/cadence/range";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ButtonSpinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { defaultChoice, resolveChoice, type PeriodChoice } from "@/lib/reports/period-choice";
import { FilterChips, MultiPicker, type PickGroup } from "./report-filters";
import { ReportPeriodPicker } from "./report-period-picker";

// Where the readings service lives. A literal `process.env.NEXT_PUBLIC_*` so Next can put it into the browser bundle.
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://hub.waytaraenergy.com";

const DEFAULT_PICKS = ["pv1_power_w", "battery_soc_pct", "load_total_power_w"];
const PREVIEW_ROWS = 40;

const timeOf = (ms: number) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(ms);
const numberText = (v: number | null) => (v === null ? "" : Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000));

/** The readings exactly as the unit took them (every 5, 10 or 30 seconds), for the last four weeks: pick values and days, look at the
 *  first rows, and download the file. The file is made by the readings service; this page only asks for it. */
export function CadencePanel({ deviceId, today, firstDay }: { deviceId: string; today: string; firstDay: string | null }) {
  const client = React.useMemo(
    () =>
      createCadenceClient({
        baseUrl: GATEWAY_URL,
        getToken: async () => (await createClient().auth.getSession()).data.session?.access_token ?? null,
      }),
    []
  );

  const [loaded, setLoaded] = React.useState<{ deviceId: string; keys: CadenceKey[] | null; error: string | null } | null>(null);
  const [picked, setPicked] = React.useState<string[] | null>(null);
  const [choice, setChoice] = React.useState<PeriodChoice>(() => defaultChoice(today));
  const [preview, setPreview] = React.useState<{ key: string; data: PreviewAnswer | null; error: string | null } | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  // the values this person may pick
  React.useEffect(() => {
    const c = new AbortController();
    client
      .keys(deviceId, c.signal)
      .then((a) => setLoaded({ deviceId, keys: a.keys, error: null }))
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setLoaded({ deviceId, keys: null, error: e instanceof CadenceApiError ? e.message : "Could not load the list of readings." });
      });
    return () => c.abort();
  }, [client, deviceId]);
  const keys = loaded?.deviceId === deviceId ? loaded.keys : null;
  const keysError = loaded?.deviceId === deviceId ? loaded.error : null;

  const available = React.useMemo(() => new Set((keys ?? []).map((k) => k.key)), [keys]);
  const selected = React.useMemo(() => (picked ?? DEFAULT_PICKS).filter((k) => available.has(k)), [picked, available]);
  const byKey = React.useMemo(() => new Map((keys ?? []).map((k) => [k.key, k])), [keys]);

  // the period: a day, 7 days, or from a day (never more than a week per file)
  const resolved = resolveChoice(choice, today);
  const days = choice.mode === "custom" ? Math.min(CADENCE_MAX_DAYS, resolved.days) : resolved.days;
  const plan = React.useMemo(() => planPeriod(resolved.start, days), [resolved.start, days]);
  const request = plan.ok && selected.length > 0 ? { equipmentId: deviceId, fromMs: plan.fromMs, toMs: plan.toMs, keys: selected } : null;
  const requestKey = request ? `${request.fromMs}|${request.toMs}|${request.keys.join(",")}` : "";

  React.useEffect(() => {
    if (!request) return;
    const c = new AbortController();
    const timer = window.setTimeout(() => {
      client
        .preview(request, PREVIEW_ROWS, c.signal)
        .then((data) => setPreview({ key: requestKey, data, error: null }))
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") setPreview({ key: requestKey, data: null, error: e instanceof CadenceApiError ? e.message : "Could not load the readings." });
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      c.abort();
    };
    // `request` is rebuilt every render; `requestKey` is what identifies it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, requestKey]);

  const groups = React.useMemo<PickGroup[]>(
    () => groupKeys(keys ?? []).map((g) => ({ id: g.id, label: g.label, items: g.items.map((k) => ({ id: k.key, label: k.label, ...(k.unit ? { unit: k.unit } : {}), hint: cadenceText(k.cadence_s) })) })),
    [keys]
  );

  const onDownload = async () => {
    if (!request) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const { blob, filename } = await client.download(request);
      saveBlob(blob, filename);
    } catch (e) {
      setDownloadError(e instanceof CadenceApiError ? e.message : "The download did not finish. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  const showing = preview?.key === requestKey ? preview : null;
  const loadingPreview = !!request && !showing;
  const dirty = picked !== null || choice.mode !== "day" || choice.date !== today;
  const label = "text-xs font-medium text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="space-y-2">
          <span className={label}>Readings to include</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {keys === null && !keysError ? (
              <span className="text-sm text-muted-foreground">Loading the list…</span>
            ) : keysError ? (
              <span role="alert" className="text-sm text-destructive">{keysError}</span>
            ) : (
              <>
                <FilterChips items={selected.map((k) => ({ id: k, label: byKey.get(k) ? keyTitle(byKey.get(k)!) : k }))} onRemove={(id) => setPicked(selected.filter((x) => x !== id))} />
                <MultiPicker groups={groups} selected={selected} onChange={setPicked} max={CADENCE_MAX_KEYS} label="Add reading" searchPlaceholder="Search readings…" />
              </>
            )}
          </div>
        </div>
        <Separator className="my-3" />
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <div className="space-y-1">
            <span className={label}>Period</span>
            <div>
              <ReportPeriodPicker choice={choice} onChange={setChoice} today={today} firstDay={firstDay && firstDay > oldestDay() ? firstDay : oldestDay()} maxDays={CADENCE_MAX_DAYS} />
            </div>
          </div>
          <p className="max-w-md pb-2 text-xs text-muted-foreground">
            One file covers up to {CADENCE_MAX_DAYS} days within the last 4 weeks, with every reading as the unit took it.
          </p>
          <Button variant="ghost" size="sm" className="ml-auto h-9 gap-1.5 text-muted-foreground" onClick={() => (setPicked(null), setChoice(defaultChoice(today)))} disabled={!dirty}>
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => void onDownload()} disabled={!request || downloading} aria-label="Download CSV">
            {downloading ? <ButtonSpinner show /> : <Download className="size-4" />}
            Download CSV
          </Button>
        </div>
        {!plan.ok && <p role="alert" className="mt-2 text-sm text-destructive">{plan.error}</p>}
        {downloadError && <p role="alert" className="mt-2 text-sm text-destructive">{downloadError}</p>}
      </div>

      {selected.length === 0 && keys !== null ? (
        <EmptyPick text="Add one or more readings above to see them here." />
      ) : !plan.ok ? (
        <EmptyPick text="Pick a period of up to 7 days to see the readings." />
      ) : loadingPreview ? (
        <EmptyPick text="Loading the readings…" />
      ) : showing?.error ? (
        <EmptyPick text={showing.error} />
      ) : showing?.data && showing.data.rows.length === 0 ? (
        <EmptyPick text="No readings were recorded for these values in this period." />
      ) : showing?.data ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="max-h-[28rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 whitespace-nowrap bg-card">Time (IST)</TableHead>
                  {showing.data.columns.map((c) => (
                    <TableHead key={c.key} className="sticky top-0 whitespace-nowrap bg-card text-right">
                      {keyTitle(c)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {showing.data.rows.map((r) => (
                  <TableRow key={String(r[0])}>
                    <TableCell className="whitespace-nowrap tabular-nums">{timeOf(r[0] as number)}</TableCell>
                    {r.slice(1).map((v, i) => (
                      <TableCell key={i} className="text-right tabular-nums">
                        {numberText(v)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            {showing.data.truncated ? `The first ${PREVIEW_ROWS} readings of the first hour. ` : "All readings of the first hour. "}The downloaded file has every reading of the whole period.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function EmptyPick({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
