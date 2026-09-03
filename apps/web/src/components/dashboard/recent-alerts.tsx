"use client";

import * as React from "react";
import { AlertTriangle, Bell } from "lucide-react";
import { useRealtimeTable, type RealtimeRowEvent } from "@waytara/ui/realtime-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { acknowledgeAlert } from "@/app/dashboard/actions";

export interface AlertRow {
  id: string;
  device_id: string;
  severity: string;
  message: string;
  ts: string;
  acknowledged_at: string | null;
}

/** Overview's "Recent Alerts" card. Realtime rollout: seeded from the
 *  server's initial (unacknowledged-only) query, then kept live by an
 *  `alerts` subscription for this device — a new alert appears the moment
 *  it's created (e.g. the offline-detection cron), and one acknowledged
 *  from anywhere else (another tab, a staff action) disappears without a
 *  refresh. Acknowledging from *this* card still goes through the same
 *  `acknowledgeAlert` Server Action as before — its own write flows back
 *  through this same subscription, so there's nothing special-cased for
 *  "I acknowledged my own alert" vs. "it got acknowledged elsewhere." */
export function RecentAlerts({ deviceId, initialAlerts }: { deviceId: string; initialAlerts: AlertRow[] }) {
  const [alerts, setAlerts] = React.useState<AlertRow[]>(initialAlerts);

  useRealtimeTable<AlertRow>(
    "alerts",
    "INSERT",
    `device_id=eq.${deviceId}`,
    React.useCallback((payload: RealtimeRowEvent<AlertRow>) => {
      setAlerts((prev) =>
        prev.some((a) => a.id === payload.new.id) ? prev : [payload.new, ...prev].slice(0, 5)
      );
    }, [])
  );

  useRealtimeTable<AlertRow>(
    "alerts",
    "UPDATE",
    `device_id=eq.${deviceId}`,
    React.useCallback((payload: RealtimeRowEvent<AlertRow>) => {
      setAlerts((prev) =>
        payload.new.acknowledged_at
          ? prev.filter((a) => a.id !== payload.new.id)
          : prev.map((a) => (a.id === payload.new.id ? payload.new : a))
      );
    }, [])
  );

  if (alerts.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Bell />
          </EmptyMedia>
          <EmptyTitle>No alerts</EmptyTitle>
          <EmptyDescription>
            This device is running clean — we&apos;ll show anything that needs your attention here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <Alert key={a.id} variant={a.severity === "critical" ? "destructive" : "default"}>
          <AlertTriangle />
          <AlertTitle className="flex items-center justify-between gap-3 capitalize">
            {a.severity}
            <span className="text-xs font-normal normal-case text-muted-foreground">
              {new Date(a.ts).toLocaleDateString("en-IN")}
            </span>
          </AlertTitle>
          <AlertDescription>
            <p>{a.message}</p>
            <form action={acknowledgeAlert.bind(null, a.id)}>
              <SubmitButton variant="outline" size="sm" className="mt-1" pendingText="Acknowledging…">
                Acknowledge
              </SubmitButton>
            </form>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
