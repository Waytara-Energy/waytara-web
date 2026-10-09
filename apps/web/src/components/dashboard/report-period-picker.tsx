"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PERIOD_MODES, choiceLabel, type PeriodChoice } from "@/lib/reports/period-choice";

const toDate = (day: string) => new Date(`${day}T12:00:00`);
const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** One button showing the period; its calendar holds the presets (Day, 7, 30, 90 days) in a column beside it. Picking a day sets that
 *  day (in Day mode) or the first day of a window of up to 30 days. On a phone the button shows only the calendar icon. */
export function ReportPeriodPicker({ choice, onChange, today, firstDay }: { choice: PeriodChoice; onChange: (c: PeriodChoice) => void; today: string; firstDay: string | null }) {
  const [open, setOpen] = React.useState(false);
  const label = choiceLabel(choice, today);
  const selected = choice.mode === "day" ? choice.date : choice.mode === "custom" ? choice.customStart : undefined;
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
          <Calendar
            mode="single"
            selected={selected ? toDate(selected) : undefined}
            defaultMonth={toDate(selected ?? today)}
            onSelect={(d) => {
              if (!d) return;
              const day = toDay(d);
              onChange(choice.mode === "day" ? { ...choice, date: day } : { ...choice, mode: "custom", customStart: day });
              setOpen(false);
            }}
            disabled={[{ after: toDate(today) }, ...(firstDay ? [{ before: toDate(firstDay) }] : [])]}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
