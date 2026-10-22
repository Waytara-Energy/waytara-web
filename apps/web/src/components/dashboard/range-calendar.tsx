"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { addDays } from "@/lib/reports/period-math";
import { normalizeRange } from "@/lib/telemetry/ranges";

const toDate = (day: string) => new Date(`${day}T12:00:00`);
const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The calendar every period picker uses: tap the first day, then the last (a second tap on the same day is that single day). The days more
 *  than `maxDays` from the first tap are greyed out while the second is awaited, so a range can never be longer than the page can serve. The
 *  chosen range is handed over once the second day is tapped. */
export function RangeCalendar({
  start,
  end,
  today,
  firstDay,
  maxDays,
  onPick,
}: {
  /** The range now in force (YYYY-MM-DD), shown as selected; null when the period is a preset or a single day. */
  start: string | null;
  end: string | null;
  today: string;
  firstDay: string | null;
  maxDays: number;
  onPick: (start: string, end: string) => void;
}) {
  const [pending, setPending] = React.useState<string | null>(null);
  const shown = pending ? { from: toDate(pending), to: toDate(pending) } : start && end ? { from: toDate(start), to: toDate(end) } : undefined;
  const disabled = [
    { after: toDate(today) },
    ...(firstDay ? [{ before: toDate(firstDay) }] : []),
    ...(pending ? [{ before: toDate(addDays(pending, -(maxDays - 1))) }, { after: toDate(addDays(pending, maxDays - 1)) }] : []),
  ];

  return (
    <div>
      <Calendar
        mode="range"
        selected={shown}
        defaultMonth={toDate(end ?? start ?? today)}
        // The first tap and the second are handled here, not by the library's own range rules (which would stretch an existing range).
        onSelect={() => undefined}
        onDayClick={(day, modifiers) => {
          if (modifiers.disabled) return;
          const tapped = toDay(day);
          if (!pending) {
            setPending(tapped);
            return;
          }
          const r = normalizeRange(pending, tapped, today, firstDay, maxDays);
          setPending(null);
          onPick(r.start, r.end);
        }}
        disabled={disabled}
      />
      {/* a fixed width, so the longer second message wraps instead of stretching the popover */}
      <p className="w-[17.5rem] px-3 pb-3 text-xs text-muted-foreground">
        {pending ? `Now pick the last day (up to ${maxDays} days from the first). Tap the same day for just that day.` : `Pick the first day, then the last day, up to ${maxDays} days.`}
      </p>
    </div>
  );
}
