"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { CadenceApiError, createCadenceClient, saveBlob, type PreviewAnswer } from "@waytara/cadence/client";
import { cadenceText, filterKeys, groupKeys, keyTitle, type CadenceKey } from "@waytara/cadence/pick";
import { CADENCE_MAX_DAYS, CADENCE_MAX_KEYS, addDays, oldestDay, planPeriod, todayIst } from "@waytara/cadence/range";
import { Button } from "@/components/ui/button";
import { cn } from "@waytara/ui/cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Where the readings service lives. A literal `process.env.NEXT_PUBLIC_*` so Next can put it into the browser bundle.
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://hub.waytaraenergy.com";
const PREVIEW_ROWS = 40;

export interface DeviceOption {
  id: string;
  site: string;
  name: string;
  model: string | null;
}

const timeOf = (ms: number) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(ms);
const numberText = (v: number | null) => (v === null ? "" : Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000));

const field = "h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelCls = "text-xs font-medium text-muted-foreground";

export function CadenceDownload({ devices }: { devices: DeviceOption[] }) {
  const client = useMemo(
    () =>
      createCadenceClient({
        baseUrl: GATEWAY_URL,
        getToken: async () => (await createClient().auth.getSession()).data.session?.access_token ?? null,
      }),
    []
  );

  const today = useMemo(() => todayIst(), []);
  const oldest = useMemo(() => oldestDay(), []);
  const [deviceId, setDeviceId] = useState(devices[0]!.id);
  const [loaded, setLoaded] = useState<{ deviceId: string; keys: CadenceKey[] | null; scope: string | null; error: string | null } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [firstDay, setFirstDay] = useState(today);
  const [days, setDays] = useState(1);
  const [preview, setPreview] = useState<{ key: string; data: PreviewAnswer | null; error: string | null } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const c = new AbortController();
    client
      .keys(deviceId, c.signal)
      .then((a) => setLoaded({ deviceId, keys: a.keys, scope: a.scope, error: null }))
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setLoaded({ deviceId, keys: null, scope: null, error: e instanceof CadenceApiError ? e.message : "Could not load the list of readings." });
      });
    return () => c.abort();
  }, [client, deviceId]);

  const keys = loaded?.deviceId === deviceId ? loaded.keys : null;
  const keysError = loaded?.deviceId === deviceId ? loaded.error : null;
  const byKey = useMemo(() => new Map((keys ?? []).map((k) => [k.key, k])), [keys]);
  const selected = useMemo(() => picked.filter((k) => byKey.has(k)), [picked, byKey]);
  const groups = useMemo(() => groupKeys(filterKeys(keys ?? [], query)), [keys, query]);

  const plan = useMemo(() => planPeriod(firstDay, days), [firstDay, days]);
  const request = plan.ok && selected.length > 0 ? { equipmentId: deviceId, fromMs: plan.fromMs, toMs: plan.toMs, keys: selected } : null;
  const requestKey = request ? `${request.equipmentId}|${request.fromMs}|${request.toMs}|${request.keys.join(",")}` : "";

  useEffect(() => {
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

  const toggle = (key: string) =>
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : p.length >= CADENCE_MAX_KEYS ? p : [...p, key]));

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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-lg border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="cadence-device" className={labelCls}>
              Device
            </label>
            <select
              id="cadence-device"
              className={cn(field, "w-full")}
              value={deviceId}
              onChange={(e) => {
                setDeviceId(e.target.value);
                setPicked([]);
                setQuery("");
              }}
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.site} — {d.name}
                  {d.model ? ` (${d.model})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="cadence-from" className={labelCls}>
                First day
              </label>
              <input id="cadence-from" type="date" className={field} min={oldest} max={today} value={firstDay} onChange={(e) => e.target.value && setFirstDay(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="cadence-days" className={labelCls}>
                Days
              </label>
              <select id="cadence-days" className={field} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {Array.from({ length: CADENCE_MAX_DAYS }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-1 pb-0.5">
              <Button type="button" variant="outline" size="sm" onClick={() => (setFirstDay(today), setDays(1))}>
                Today
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => (setFirstDay(addDays(today, -(CADENCE_MAX_DAYS - 1))), setDays(CADENCE_MAX_DAYS))}>
                Last 7 days
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">One file covers up to {CADENCE_MAX_DAYS} days within the last 4 weeks (from {oldest}).</p>
          {!plan.ok && (
            <p role="alert" className="text-sm text-destructive">
              {plan.error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="button" onClick={() => void onDownload()} disabled={!request || downloading}>
              <Download className="size-4" />
              {downloading ? "Preparing the file…" : "Download CSV"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {selected.length} of {CADENCE_MAX_KEYS} readings picked
            </span>
          </div>
          {downloadError && (
            <p role="alert" className="text-sm text-destructive">
              {downloadError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="cadence-search" className={labelCls}>
              Readings{loaded?.scope === "staff" ? " (every register)" : ""}
            </label>
            {selected.length > 0 && (
              <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setPicked([])}>
                Clear
              </button>
            )}
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((k) => (
                <span key={k} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-secondary pr-1 pl-2.5 text-xs font-medium">
                  {byKey.get(k) ? keyTitle(byKey.get(k)!) : k}
                  <button type="button" onClick={() => toggle(k)} aria-label={`Remove ${k}`} className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input id="cadence-search" type="search" className={cn(field, "w-full")} placeholder="Search readings…" value={query} onChange={(e) => setQuery(e.target.value)} disabled={!keys} />
          <div className="max-h-72 overflow-auto rounded-md border border-border">
            {keysError ? (
              <p role="alert" className="p-3 text-sm text-destructive">
                {keysError}
              </p>
            ) : !keys ? (
              <p className="p-3 text-sm text-muted-foreground">Loading the list…</p>
            ) : groups.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nothing matches.</p>
            ) : (
              groups.map((g) => (
                <div key={g.id}>
                  <div className="sticky top-0 bg-card px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.label}</div>
                  {g.items.map((k) => (
                    <label key={k.key} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent/50">
                      <input type="checkbox" checked={picked.includes(k.key)} onChange={() => toggle(k.key)} disabled={!picked.includes(k.key) && picked.length >= CADENCE_MAX_KEYS} />
                      <span className="flex-1">{keyTitle(k)}</span>
                      <span className="text-xs text-muted-foreground">{cadenceText(k.cadence_s)}</span>
                    </label>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selected.length === 0 ? (
        <Note text="Pick one or more readings to see them here." />
      ) : !plan.ok ? (
        <Note text="Pick a period of up to 7 days to see the readings." />
      ) : !showing ? (
        <Note text="Loading the readings…" />
      ) : showing.error ? (
        <Note text={showing.error} />
      ) : showing.data && showing.data.rows.length === 0 ? (
        <Note text="No readings were recorded for these values in this period." />
      ) : showing.data ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
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

function Note({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
