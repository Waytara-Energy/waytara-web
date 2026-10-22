"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { istDate } from "@/lib/telemetry/combine";
import { CUSTOM_MAX_DAYS, rangeLabel, type RangePreset } from "@/lib/telemetry/ranges";
import { useRange } from "./range-context";
import { RangeCalendar } from "./range-calendar";

export const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

/** The longer list the Performance page offers. */
export const LONG_PRESETS: { id: RangePreset; label: string }[] = [...PRESETS, { id: "1y", label: "1 year" }, { id: "2y", label: "2 years" }];

/** The range picker, one button: it shows the chosen period and opens a calendar with the presets (Today / 7 days / 30 days / 90 days, and
 *  1 / 2 years where offered) beside it. In the calendar, tap the first day and then the last: a custom window of up to 90 days (a second
 *  tap on the same day is that single day), from the device's first reading until today. */
export function RangeBar({ presets = PRESETS }: { presets?: { id: RangePreset; label: string }[] }) {
  const range = useRange();
  const [open, setOpen] = React.useState(false);
  if (!range) return null;
  const { preset, setPreset, setCustomRange, customStart, firstDay, today, window: win } = range;
  // the last day of the custom window: what the window really covers (an older saved choice without an end runs 30 days)
  const customEnd = istDate(win.toMs - 1);
  const label =
    preset === "custom" && customStart
      ? rangeLabel(customStart, customEnd)
      : (presets.find((p) => p.id === preset)?.label ?? "Today");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={label} className="gap-1.5 max-sm:px-2.5">
          <CalendarIcon className="size-3.5" />
          <span className="hidden sm:inline">{label}</span>
          <span className="sr-only sm:hidden">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="end">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-wrap gap-1 border-b border-theme-border p-2 sm:order-2 sm:w-32 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-l">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPreset(p.id);
                  setOpen(false);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors",
                  preset === p.id ? "bg-theme-surface-hover text-theme-highlight" : "text-theme-muted hover:bg-theme-surface-hover/60 hover:text-theme-primary"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <RangeCalendar
            start={preset === "custom" ? customStart : null}
            end={preset === "custom" ? customEnd : null}
            today={today}
            firstDay={firstDay}
            maxDays={CUSTOM_MAX_DAYS}
            onPick={(from, to) => {
              setCustomRange(from, to);
              setOpen(false);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
