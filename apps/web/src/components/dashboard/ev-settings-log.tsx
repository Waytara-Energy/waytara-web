"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatFrame, isLogDay, utcDay, type FrameRow } from "@/lib/ev-settings";
import { cn } from "@/lib/utils";
import { hubDownload, hubJson } from "./ev-settings-hub";

const TIME = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" });
const REFRESH_MS = 5_000;

const KIND_CLASS: Record<FrameRow["kind"], string> = {
  call: "font-medium text-foreground",
  answer: "text-muted-foreground",
  error: "font-medium text-destructive",
  other: "text-muted-foreground",
};

/** The recent OCPP messages between the charger and WayTara (staff only): a readable line each, newest first, refreshed on request or every few
 *  seconds, and the whole day's log as a file. Card identifiers are already hidden by the service; a restart of the service empties the recent list. */
export function EvSettingsLog({ chargerId }: { chargerId: string }) {
  const [rows, setRows] = React.useState<FrameRow[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [auto, setAuto] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [day, setDay] = React.useState(() => utcDay(Date.now()));
  const [downloading, setDownloading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const r = await hubJson<{ frames: { at: string; direction: "in" | "out"; frame: string }[] }>("GET", `/v1/ev/${encodeURIComponent(chargerId)}/frames?limit=100`);
    setLoading(false);
    if (!r.ok) {
      setError(r.status === 404 ? "The message log is for WayTara staff only." : r.message);
      return;
    }
    setError(null);
    setRows(r.data.frames.map(formatFrame).reverse());
  }, [chargerId]);

  React.useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [auto, load]);

  async function download() {
    if (!isLogDay(day)) {
      setError("Choose a day.");
      return;
    }
    setDownloading(true);
    setError(null);
    const r = await hubDownload(`/v1/ev/${encodeURIComponent(chargerId)}/frames/archive?day=${day}`, `ocpp-${chargerId.slice(0, 8)}-${day}.jsonl`);
    setDownloading(false);
    if (!r.ok) setError(r.message);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {rows ? "Refresh" : "Show the recent messages"}
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={auto} onCheckedChange={(v) => { setAuto(v); if (v) void load(); }} aria-label="Refresh every 5 seconds" />
          Refresh every 5 seconds
        </label>
        <span className="grow" />
        <Input type="date" className="h-8 w-40" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day of the log" />
        <Button variant="outline" size="sm" onClick={() => void download()} disabled={downloading}>
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download day log
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {rows ? (
        rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages since the service last started. The day log has the older ones.</p>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto rounded-md border text-xs">
            {rows.map((r, i) => (
              <li key={`${r.at}-${i}`} className="flex items-baseline gap-3 px-3 py-1.5">
                <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{TIME.format(new Date(r.at))}</span>
                <span className="w-4 shrink-0" title={r.direction === "in" ? "From the charger" : "From WayTara"}>
                  {r.direction === "in" ? <ArrowDownLeft className="size-3.5 text-sky-600" aria-label="From the charger" /> : <ArrowUpRight className="size-3.5 text-emerald-600" aria-label="To the charger" />}
                </span>
                <span className={cn("w-36 shrink-0 truncate", KIND_CLASS[r.kind])}>{r.action}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.summary}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
