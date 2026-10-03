import { ChartNoAxesColumn } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared "no data yet" state for any chart/graph area — a device with
 *  equipment_metrics mapped but no equipment_telemetry rows yet (a fresh
 *  install, or a simulator that hasn't run) should read as "waiting for
 *  data", not as a bug. Same visual language as the page-level Empty
 *  component (@/components/ui/empty), just compact enough to sit inside an
 *  existing chart card instead of replacing a whole page. */
export function ChartEmptyState({ label = "No data yet", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-[160px] flex-col items-center justify-center gap-2 py-8 text-center", className)}>
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <ChartNoAxesColumn className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">Readings will appear here once this device starts reporting.</p>
    </div>
  );
}
