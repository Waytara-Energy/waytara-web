import { Wifi, WifiOff } from "lucide-react";
import type { LastSyncInfo } from "@/lib/device-sync";

function formatAgo(minutesAgo: number): string {
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hours = Math.floor(minutesAgo / 60);
  return `${hours}h ${minutesAgo % 60}m ago`;
}

/** Distinguishes "the inverter has a fault" (FaultBanner's job) from "we
 *  haven't heard from the connection in a while" — a customer bridging
 *  over RS485 should be able to tell the two apart at a glance rather than
 *  wondering whether a blank Overview means the system is broken or the
 *  link just dropped. */
export function LastSyncIndicator({ sync }: { sync: LastSyncInfo }) {
  if (sync.lastTs === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-muted">
        <WifiOff className="size-4" />
        No data received yet.
      </div>
    );
  }

  if (sync.isStale) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
        <WifiOff className="size-4" />
        No data in {formatAgo(sync.minutesAgo ?? 0)} — check the connection. This isn&apos;t necessarily a device
        fault, the link between the device and WayTara may just be down.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-muted">
      <Wifi className="size-4 text-emerald-500" />
      Synced {formatAgo(sync.minutesAgo ?? 0)}
    </div>
  );
}
