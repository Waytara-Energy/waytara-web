"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { elapsedText, stripKind } from "@/lib/ev-control";
import type { EvOverview } from "@/lib/ev-overview";
import { EvChargeControl } from "./ev-charge-control";

/**
 * The slim strip under the Overview's energy flow (where the colour key used to be): a "Start charging" button while the charger is free; while
 * a charge is on, its brief details (status, kW, kWh, time) as a link to the charging sessions on Monitoring, with Stop. A charger that is
 * not connected says so instead of offering a start that cannot work.
 */
export function EvChargeStrip({ ev, className }: { ev: EvOverview; className?: string }) {
  const kind = stripKind({ open: ev.open !== null, connected: ev.connected });
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!ev.open) return;
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, [ev.open]);

  if (kind === "start") return <EvChargeControl chargerId={ev.chargerId} sessionOpen={false} transactionId={null} connected={ev.connected} compact className={className} />;
  if (kind === "offline" || kind === "unknown") {
    return (
      <div className={cn("flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs text-muted-foreground", className)}>
        <span className="size-1.5 rounded-full bg-red-500" aria-hidden />
        {kind === "offline" ? "The EV charger is not connected right now" : "Checking the EV charger…"}
      </div>
    );
  }

  const open = ev.open!;
  return (
    <div className={cn("relative rounded-2xl border bg-card/60 px-4 py-2.5 transition-colors hover:bg-accent/40", className)}>
      <Link href={`/dashboard/monitoring?device=${ev.chargerId}#ev`} aria-label="Open the charging session" className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <div className="pointer-events-none flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
          <Zap className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{ev.status ?? "Charging"}</p>
          <p className="truncate text-xs tabular-nums text-muted-foreground">
            {open.kw !== null ? `${open.kw.toFixed(1)} kW · ` : ""}
            {open.kwh !== null ? `${open.kwh.toFixed(open.kwh >= 10 ? 1 : 2)} kWh · ` : ""}
            {elapsedText(Date.parse(open.startedAt), now)}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <div className="relative z-10 mt-2">
        <EvChargeControl chargerId={ev.chargerId} sessionOpen transactionId={open.transactionId} connected={ev.connected} compact />
      </div>
    </div>
  );
}
