"use client";

import * as React from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FaultEvent } from "@/lib/deye-fault-codes";
import { addDays } from "@/lib/reports/period-math";
import { choiceLabel, resolveChoice, type PeriodChoice } from "@/lib/reports/period-choice";
import { FaultHistory } from "./fault-history";
import { ReportPeriodPicker } from "./report-period-picker";

interface Result {
  events: FaultEvent[];
  failed: boolean;
}

const rangeText = (start: string, end: string) => {
  const f = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return start === end ? f(start) : `${f(start)} to ${f(end)}`;
};

/** The device's faults for a period the customer picks (30 days to begin with, which the page has already read). A new period is read
 *  when chosen. A read that fails says so; it never reads as "no faults". */
export function FaultHistoryCard({ deviceId, today, firstDay, initial }: { deviceId: string; today: string; firstDay: string | null; initial: Result }) {
  const [choice, setChoice] = React.useState<PeriodChoice>({ mode: "30d", date: today, customStart: addDays(today, -6) });
  const { start, days, end } = resolveChoice(choice, today);
  const isInitial = choice.mode === "30d";
  const key = `${start}|${days}`;
  const [loaded, setLoaded] = React.useState<{ key: string; result: Result | null } | null>(null);

  React.useEffect(() => {
    if (isInitial) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/maintenance/faults?device=${deviceId}&date=${start}&days=${days}`, { signal: controller.signal, cache: "no-store" });
        const body = (await res.json()) as Result;
        if (!controller.signal.aborted) setLoaded({ key, result: res.ok ? body : null });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setLoaded({ key, result: null });
      }
    })();
    return () => controller.abort();
  }, [isInitial, deviceId, start, days, key]);

  const loading = !isInitial && loaded?.key !== key;
  const result: Result | null = isInitial ? initial : loading ? null : (loaded?.result ?? { events: [], failed: true });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-sm">Faults</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">{choiceLabel(choice, today) === "30 days" ? "Last 30 days" : rangeText(start, end)}</p>
        </div>
        <ReportPeriodPicker choice={choice} onChange={setChoice} today={today} firstDay={firstDay} />
      </CardHeader>
      <CardContent>
        {loading || !result ? (
          <Skeleton className="h-10 w-full rounded-lg" />
        ) : result.failed && result.events.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TriangleAlert className="size-4 text-amber-500" />
            The history could not be loaded just now. Try again in a moment.
          </p>
        ) : result.events.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-500" />
            None in this period. The device has been running clean.
          </p>
        ) : (
          <FaultHistory events={result.events} />
        )}
      </CardContent>
    </Card>
  );
}
