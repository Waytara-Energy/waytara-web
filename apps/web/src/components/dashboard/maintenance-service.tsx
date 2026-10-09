import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ServiceStatus } from "@/lib/service-status";

export const serviceDate = (value: string | null | undefined): string | null => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null);

const DAY_MS = 86_400_000;

/** How much of the warranty has gone and what is left, in words. `now` is passed in so the page decides the clock. */
export function warrantyView(start: string | null, end: string | null, now: number): { pct: number; left: string } | null {
  if (!end) return null;
  const endMs = new Date(end).getTime();
  const startMs = start ? new Date(start).getTime() : null;
  const daysLeft = Math.ceil((endMs - now) / DAY_MS);
  const pct = startMs !== null && endMs > startMs ? Math.min(100, Math.max(0, ((now - startMs) / (endMs - startMs)) * 100)) : 0;
  if (daysLeft <= 0) return { pct: 100, left: "Expired" };
  if (daysLeft < 60) return { pct, left: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` };
  const months = Math.round(daysLeft / 30.4);
  return { pct, left: months >= 24 ? `${(months / 12).toFixed(1).replace(/\.0$/, "")} years left` : `${months} months left` };
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

/** The Service tab: the plan, the warranty and the visits, each shown only for what exists. Nothing is printed as a blank dash. */
export function MaintenanceService({ status, installedAt, warrantyStart, warrantyEnd, now }: { status: ServiceStatus | null; installedAt: string | null; warrantyStart: string | null; warrantyEnd: string | null; now: number }) {
  const warranty = warrantyView(warrantyStart, warrantyEnd, now);
  const visits = status?.visits ?? [];
  if (!status && !warranty && !installedAt) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm font-medium text-foreground">Nothing recorded yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Your service plan, warranty and visits appear here once your WayTara advisor adds them.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Service plan</CardTitle>
          </CardHeader>
          <CardContent>
            {status ? (
              <div className="divide-y divide-border/60">
                <Row label="Plan" value={status.planName ?? "Service plan"} />
                <Row label="Next visit" value={serviceDate(status.nextServiceDate) ?? "Not scheduled yet"} />
                <Row label="Last service" value={serviceDate(status.lastCompletedAt) ?? "None yet"} />
                <Row label="Visits used" value={status.totalIncluded !== null ? `${status.completedCount} of ${status.totalIncluded}` : String(status.completedCount)} />
                <Row label="Plan ends" value={serviceDate(status.contractEndDate) ?? "—"} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No service plan is set up for this device yet. Your WayTara advisor can add one.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Warranty</CardTitle>
          </CardHeader>
          <CardContent>
            {warranty ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-semibold tracking-tight text-foreground">{warranty.left}</p>
                  <p className="text-sm text-muted-foreground">until {serviceDate(warrantyEnd)}</p>
                </div>
                <Progress value={warranty.pct} className="h-1.5" />
                <div className="divide-y divide-border/60">
                  {serviceDate(warrantyStart) && <Row label="Started" value={serviceDate(warrantyStart)!} />}
                  {serviceDate(installedAt) && <Row label="Installed" value={serviceDate(installedAt)!} />}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">No warranty dates are recorded for this device yet. Your WayTara advisor can add them.</p>
                {serviceDate(installedAt) && <Row label="Installed" value={serviceDate(installedAt)!} />}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {visits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {visits.map((v) => {
                const done = v.completedAt !== null;
                return (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{serviceDate(done ? v.completedAt : v.scheduledDate) ?? "Date to be confirmed"}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.isChargeable && v.chargeAmount ? `Chargeable, ₹${v.chargeAmount}` : "Included in your plan"}
                      </p>
                    </div>
                    <Badge variant={done ? "secondary" : "default"}>{done ? "Completed" : "Scheduled"}</Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
