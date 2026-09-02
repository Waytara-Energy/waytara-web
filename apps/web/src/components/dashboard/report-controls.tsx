"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PERIODS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
] as const;

const MAX_RANGE_DAYS = 365;

export function ReportControls({ defaultDays = 90 }: { defaultDays?: number }) {
  const [days, setDays] = React.useState(defaultDays);
  const [range, setRange] = React.useState<DateRange | undefined>(undefined);

  // The exports only support "N days back from now", not an arbitrary
  // from/to window — so a custom range picks how far back to start,
  // still ending today. Clamped to what the API accepts either way.
  function applyRange(next: DateRange | undefined) {
    setRange(next);
    if (next?.from) {
      const span = differenceInCalendarDays(new Date(), next.from) + 1;
      setDays(Math.min(Math.max(span, 1), MAX_RANGE_DAYS));
    }
  }

  const isPreset = PERIODS.some((p) => p.days === days) && !range?.from;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-theme-border p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => {
                setRange(undefined);
                setDays(p.days);
              }}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                isPreset && days === p.days
                  ? "bg-theme-surface-hover text-theme-highlight"
                  : "text-theme-muted hover:text-theme-primary"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-1.5", !isPreset && "border-theme-highlight text-theme-highlight")}
            >
              <CalendarIcon className="size-3.5" />
              {range?.from ? `Since ${range.from.toLocaleDateString("en-IN")}` : "Custom range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={range}
              onSelect={applyRange}
              disabled={{ after: new Date() }}
              defaultMonth={range?.from}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-wrap gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/reports/energy.csv?days=${days}`}>Download CSV</a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Raw daily yield, {days} days</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild size="sm">
              <a href={`/api/reports/summary.pdf?days=${days}`}>Download PDF summary</a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Formatted summary with totals &amp; savings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
