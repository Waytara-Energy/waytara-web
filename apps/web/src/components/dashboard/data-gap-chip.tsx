"use client";

import Link from "next/link";
import { ChevronDown, LifeBuoy, Stethoscope, WifiOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { clockText, dayText, durationText, explainGap, gapRangeText, type DataGap } from "@/lib/data-gaps";
import { useOutageEvents } from "./use-outage-events";

/** The pattern of a gap on a chart: pale diagonal hatching, no box, no text. Drawn once inside the chart's <defs>; the band uses `fill="url(#id)"`. */
export function GapHatch({ id }: { id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="var(--muted-foreground)" fillOpacity={0.06} />
      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted-foreground)" strokeOpacity={0.35} strokeWidth={1.5} />
    </pattern>
  );
}

const sinceText = (g: DataGap) => `${dayText(g.fromMs) === dayText(Date.now()) ? "" : `${dayText(g.fromMs)} `}${clockText(g.fromMs)}`;

/**
 * Top-right corner of a chart with a gap in it: one small chip saying what was wrong and since when ("Unit offline since 15:30 · 1 h 13 min"),
 * which opens a card with each gap, the reason in words, and the two ways forward: the device health page, and a support ticket with the
 * details already filled in. Nothing when there are no gaps. Put it inside a `relative` box that holds the chart.
 */
export function DataGapChip({ gaps, deviceId, compact = false, className }: { gaps: readonly DataGap[]; deviceId?: string; compact?: boolean; className?: string }) {
  const outages = useOutageEvents(deviceId, gaps.length > 0);
  if (gaps.length === 0) return null;

  const explained = gaps.map((g) => ({ g, reason: explainGap(g, outages) }));
  const latest = explained[explained.length - 1];
  const live = latest.g.ongoing;
  const length = durationText(latest.g.toMs - latest.g.fromMs);
  const short = latest.reason.cause === "unit_offline" ? "Unit offline" : latest.reason.cause === "inverter_unreachable" ? "Inverter not answering" : "No data";
  const label = live ? `${short} since ${sinceText(latest.g)}` : `${short} ${gapRangeText(latest.g)}`;
  const extra = gaps.length - 1;

  const health = deviceId ? `/dashboard/maintenance?device=${deviceId}#health` : "/dashboard/maintenance#health";
  const q = new URLSearchParams({
    new: "1",
    category: "device",
    subject: `No readings ${live ? `since ${sinceText(latest.g)}` : gapRangeText(latest.g, true)}`,
    message: `The charts show no readings ${live ? `since ${sinceText(latest.g)} (${length} so far)` : `for ${gapRangeText(latest.g, true)} (${length})`}. ${latest.reason.title}: ${latest.reason.detail}`,
  });
  if (deviceId) q.set("device", deviceId);
  const report = `/dashboard/support?${q.toString()}`;

  return (
    <div
      className={cn("absolute right-1 top-0 z-10 max-w-[calc(100%-0.5rem)]", className)}
      onClick={(e) => {
        // inside a card that is a link: using the chip must not follow the link (this runs after the popover has toggled)
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background/90 py-1 pl-2 pr-1.5 text-[11px] font-medium shadow-xs backdrop-blur transition-colors hover:bg-muted",
              live ? "border-red-500/30 text-red-600 dark:text-red-400" : "border-amber-500/30 text-amber-700 dark:text-amber-400"
            )}
          >
            <span className="relative flex size-1.5 shrink-0">
              {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500/60" />}
              <span className={cn("relative inline-flex size-1.5 rounded-full", live ? "bg-red-500" : "bg-amber-500")} />
            </span>
            <span className="truncate">{label}</span>
            {!compact && (
              <span className="shrink-0 tabular-nums opacity-70">
                · {length}
                {live ? " so far" : ""}
              </span>
            )}
            {extra > 0 && <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">+{extra}</span>}
            <ChevronDown className="size-3 shrink-0 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-1rem)] rounded-2xl p-0 text-left" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start gap-3 p-4">
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", live ? "bg-red-500/12 text-red-600" : "bg-amber-500/12 text-amber-600")}>
              <WifiOff className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5">{latest.reason.title}</p>
              <p className="text-xs leading-snug text-muted-foreground">{latest.reason.detail}</p>
            </div>
          </div>
          <ul className="max-h-44 divide-y overflow-y-auto border-y text-xs">
            {explained
              .slice()
              .reverse()
              .map(({ g, reason }) => (
                <li key={g.fromMs} className="flex items-baseline justify-between gap-3 px-4 py-2">
                  <span className="min-w-0">
                    <span className="block font-medium tabular-nums text-foreground">{gapRangeText(g, true)}</span>
                    <span className="block text-muted-foreground">{reason.title}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {durationText(g.toMs - g.fromMs)}
                    {g.ongoing ? " so far" : ""}
                  </span>
                </li>
              ))}
          </ul>
          <p className="px-4 pt-3 text-xs leading-snug text-muted-foreground">The line joins across the gap. The figures for it are missing, not zero.</p>
          <div className="flex gap-2 p-4 pt-3">
            <Link href={health} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90">
              <Stethoscope className="size-3.5" />
              Check device health
            </Link>
            <Link href={report} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/70">
              <LifeBuoy className="size-3.5" />
              Report a problem
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
