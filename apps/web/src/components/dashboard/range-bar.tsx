"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CUSTOM_MAX_DAYS, DAY_MS, type RangePreset } from "@/lib/telemetry/ranges";
import { useRange } from "./range-context";

export const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

/** The longer list the Performance page offers. */
export const LONG_PRESETS: { id: RangePreset; label: string }[] = [...PRESETS, { id: "1y", label: "1 year" }, { id: "2y", label: "2 years" }];

const toDate = (day: string) => new Date(`${day}T12:00:00`);
const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function formatDay(ms: number): string {
  return new Date(ms + 19_800_000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** The range picker: Today / 7 days / 30 days / 90 days (and 1 / 2 years where offered) / a custom window of up to 30 days starting on any day
 *  from the device's first reading until today. */
export function RangeBar({ presets = PRESETS }: { presets?: { id: RangePreset; label: string }[] }) {
  const range = useRange();
  const [open, setOpen] = React.useState(false);
  if (!range) return null;
  const { preset, setPreset, setCustomStart, customStart, window: w, firstDay, today } = range;
  const lastDayMs = w.toMs - DAY_MS;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1 rounded-lg border border-theme-border p-1">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              preset === p.id ? "bg-theme-surface-hover text-theme-highlight" : "text-theme-muted hover:text-theme-primary"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("gap-1.5", preset === "custom" && "border-theme-highlight text-theme-highlight")}>
            <CalendarIcon className="size-3.5" />
            {preset === "custom" && customStart ? `From ${toDate(customStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={customStart ? toDate(customStart) : undefined}
            defaultMonth={customStart ? toDate(customStart) : toDate(today)}
            onSelect={(d) => {
              if (d) {
                setCustomStart(toDay(d));
                setOpen(false);
              }
            }}
            disabled={[{ after: toDate(today) }, ...(firstDay ? [{ before: toDate(firstDay) }] : [])]}
          />
          <p className="border-t border-theme-border px-3 py-2 text-xs text-theme-muted">
            Pick the first day; the chart shows up to {CUSTOM_MAX_DAYS} days from it{firstDay ? `, starting no earlier than ${toDate(firstDay).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} (first reading)` : ""}.
          </p>
        </PopoverContent>
      </Popover>

      <span className="text-xs text-theme-muted">
        {preset === "today" ? formatDay(w.fromMs) : `${formatDay(w.fromMs)} – ${formatDay(lastDayMs)}`}
      </span>
    </div>
  );
}
