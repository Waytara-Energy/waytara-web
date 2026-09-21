import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FaultEvent } from "@/lib/deye-fault-codes";

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Distinct fault episodes (see deriveFaultEvents) over the window
 *  Maintenance queried — decoded via the same fault-code lookup
 *  FaultBanner uses for the *current* state, so a customer sees the same
 *  code/label/description vocabulary in both places. */
export function FaultHistory({ events }: { events: FaultEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="size-5" />
        </span>
        <p className="text-sm font-medium text-theme-primary">No faults reported</p>
        <p className="text-xs text-theme-muted">This device has been running clean over this window.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, i) => (
        <div key={`${event.code}-${event.startedAt}-${i}`} className="rounded-lg border border-theme-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-theme-primary">
              {event.info.code} — {event.info.label}
            </p>
            {event.resolvedAt === null ? (
              <Badge variant="alert">Ongoing</Badge>
            ) : (
              <Badge variant="secondary">Resolved</Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-theme-muted">
            {formatDate(event.startedAt)}
            {event.resolvedAt !== null ? ` – ${formatDate(event.resolvedAt)}` : " – now"}
          </p>
          <p className="mt-2 text-sm text-theme-secondary">{event.info.description}</p>
        </div>
      ))}
    </div>
  );
}
