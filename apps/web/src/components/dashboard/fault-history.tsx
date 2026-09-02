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
    return <p className="py-4 text-center text-sm text-muted-foreground">No faults reported in this window.</p>;
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
