"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEvSessionDetail } from "@/app/dashboard/ev-session-detail-action";
import type { EvRow } from "@/lib/ev-perf-stats";
import { formatSeconds, sessionStatusLabel } from "@/lib/ev-sessions";
import { cn } from "@/lib/utils";
import { EvSessionPanel, type EvSessionLoader } from "./ev-session-dialog";

const IST_MS = 19_800_000;
const istDay = (iso: string) => new Date(Date.parse(iso) + IST_MS).toISOString().slice(0, 10);
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const kwhText = (v: number | null) => (v === null ? "—" : `${v.toFixed(v >= 10 ? 1 : 2)} kWh`);
/** How many charges are listed at first, and how many more each press of "Show more" adds. */
const PAGE = 40;

function dayLabel(day: string, today: string): string {
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** The charges of a period as a list grouped by day (newest first, each day with its count and energy) beside the one that is open, shown on the
 *  page itself, like Support's list and conversation. Pressing a charge opens it; on a narrow screen the list and the charge take turns. */
export function EvSessionsBrowser({ rows, periodName, today, load = getEvSessionDetail }: { rows: EvRow[]; periodName: string; today: string; /** How a charge is read (the dashboard's server action unless a page brings its own). */ load?: EvSessionLoader }) {
  // a link from the Overview names the charge to open (?session=): it opens even when it is older than the period the list shows
  const linked = useSearchParams().get("session");
  const [selected, setSelected] = React.useState<string | null>(linked);
  const [narrowOpen, setNarrowOpen] = React.useState(linked !== null);
  const [more, setMore] = React.useState<{ key: string; n: number } | null>(null);
  const key = `${rows.length}|${rows[0]?.id ?? ""}`;
  const shown = more && more.key === key ? more.n : PAGE;
  // the open charge: the one pressed while it is still in the list, else the newest
  const activeId = selected !== null && (selected === linked || rows.some((r) => r.id === selected)) ? selected : (rows[0]?.id ?? null);

  const days = React.useMemo(() => {
    const out: { day: string; rows: EvRow[]; kwh: number }[] = [];
    for (const r of rows.slice(0, shown)) {
      const day = istDay(r.startedAt);
      let g = out[out.length - 1];
      if (!g || g.day !== day) {
        g = { day, rows: [], kwh: 0 };
        out.push(g);
      }
      g.rows.push(r);
      g.kwh += r.energyKwh ?? 0;
    }
    return out;
  }, [rows, shown]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] lg:items-start">
      <Card className={cn("gap-0 overflow-hidden", narrowOpen && "max-lg:hidden")}>
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-sm">Charging sessions</CardTitle>
          <CardDescription>{periodName} · press a charge to see it in full</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="lg:max-h-[72svh] lg:overflow-y-auto">
            {days.map((g) => (
              <section key={g.day}>
                <div className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-y border-border bg-muted/70 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                  <span>{dayLabel(g.day, today)}</span>
                  <span className="tabular-nums">
                    {g.rows.length} {g.rows.length === 1 ? "session" : "sessions"} · {kwhText(g.kwh)}
                  </span>
                </div>
                <ul className="space-y-0.5 p-1.5">
                  {g.rows.map((r) => {
                    const st = sessionStatusLabel(r.status);
                    const open = r.id === activeId;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          aria-current={open ? "true" : undefined}
                          onClick={() => {
                            setSelected(r.id);
                            setNarrowOpen(true);
                          }}
                          className={cn("flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", open ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/60")}
                        >
                          <span className="min-w-0 space-y-1">
                            <span className="block text-sm font-medium tabular-nums text-foreground">{clock(r.startedAt)}</span>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <Badge variant={st.tone === "warn" ? "alert" : st.tone === "good" ? "default" : "secondary"}>{st.label}</Badge>
                              {r.durationS !== null ? <span className="tabular-nums">{formatSeconds(r.durationS)}</span> : null}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-semibold tabular-nums text-foreground">{r.energyKwh === null ? (r.status === "active" ? "in progress" : "—") : kwhText(r.energyKwh)}</span>
                            <span className="block text-xs tabular-nums text-muted-foreground">{r.solarSharePct === null ? " " : `${r.solarSharePct.toFixed(0)}% solar`}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {rows.length > shown && (
              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Showing {shown} of {rows.length}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => setMore({ key, n: shown + PAGE * 2 })}>
                  Show more
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className={cn("lg:sticky lg:top-4", !narrowOpen && "max-lg:hidden")}>
        <CardContent className="p-4 sm:p-5 lg:max-h-[calc(100svh-2rem)] lg:overflow-y-auto">
          {activeId ? <EvSessionPanel id={activeId} load={load} onBack={() => setNarrowOpen(false)} /> : <p className="py-8 text-center text-sm text-muted-foreground">Pick a charge to see it here.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
