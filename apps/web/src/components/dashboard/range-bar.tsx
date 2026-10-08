"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { RangePreset } from "@/lib/telemetry/ranges";
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

/** The range picker, one button: it shows the chosen period and opens a calendar with the presets (Today / 7 days / 30 days / 90 days, and
 *  1 / 2 years where offered) above it. Picking a day starts a custom window of up to 30 days from it, from the device's first reading
 *  until today. */
export function RangeBar({ presets = PRESETS }: { presets?: { id: RangePreset; label: string }[] }) {
  const range = useRange();
  const [open, setOpen] = React.useState(false);
  if (!range) return null;
  const { preset, setPreset, setCustomStart, customStart, firstDay, today } = range;
  const label =
    preset === "custom" && customStart
      ? `From ${toDate(customStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
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
          <Calendar
            mode="single"
            selected={customStart && preset === "custom" ? toDate(customStart) : undefined}
            defaultMonth={customStart ? toDate(customStart) : toDate(today)}
            onSelect={(d) => {
              if (d) {
                setCustomStart(toDay(d));
                setOpen(false);
              }
            }}
            disabled={[{ after: toDate(today) }, ...(firstDay ? [{ before: toDate(firstDay) }] : [])]}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
