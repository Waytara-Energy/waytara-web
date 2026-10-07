"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INTERVAL_OPTIONS } from "@/lib/day-buckets";
import { useRange } from "./range-context";
import { useGoLive } from "./go-live";

/** One interval picker (15m / 30m / 1h / 2h) above a group of today's charts, so they all bucket the same way. It steps
 *  aside while a longer range or Go Live is chosen - those bring their own charts. */
export function IntervalHeader({ title, minutes, onChange }: { title: string; minutes: number; onChange: (minutes: number) => void }) {
  const range = useRange();
  const goLive = useGoLive();
  if (goLive?.active || (range && range.preset !== "today")) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <Select value={String(minutes)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-8 w-[110px] shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INTERVAL_OPTIONS.map((o) => (
            <SelectItem key={o.minutes} value={String(o.minutes)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
