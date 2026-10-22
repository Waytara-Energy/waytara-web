"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CUSTOM_MAX_DAYS, PERIOD_MODES, choiceLabel, resolveChoice, type PeriodChoice } from "@/lib/reports/period-choice";
import { RangeCalendar } from "./range-calendar";

/** One button showing the period; its calendar holds the presets (Day, 7, 30, 90 days) in a column beside it. In the calendar, tap the first
 *  day and then the last: a range of up to `maxDays` days (90 unless the page needs fewer), or one day when the same day is tapped twice. On a
 *  phone the button shows only the calendar icon. */
export function ReportPeriodPicker({ choice, onChange, today, firstDay, maxDays = CUSTOM_MAX_DAYS }: { choice: PeriodChoice; onChange: (c: PeriodChoice) => void; today: string; firstDay: string | null; maxDays?: number }) {
  const [open, setOpen] = React.useState(false);
  const label = choiceLabel(choice, today);
  const now = resolveChoice(choice, today);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Period: ${label}`} className="h-9 gap-1.5 max-sm:px-2.5">
          <CalendarIcon className="size-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-wrap gap-1 border-b border-theme-border p-2 sm:order-2 sm:w-32 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-l">
            {PERIOD_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange({ ...choice, mode: m.id });
                  setOpen(false);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors",
                  choice.mode === m.id ? "bg-theme-surface-hover text-theme-highlight" : "text-theme-muted hover:bg-theme-surface-hover/60 hover:text-theme-primary"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <RangeCalendar
            start={now.start}
            end={now.end}
            today={today}
            firstDay={firstDay}
            maxDays={maxDays}
            onPick={(from, to) => {
              onChange(from === to ? { ...choice, mode: "day", date: from } : { ...choice, mode: "custom", customStart: from, customEnd: to });
              setOpen(false);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
