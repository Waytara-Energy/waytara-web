"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { useDeviceLive } from "@/lib/telemetry/react";
import { getConnectorStatusLabel } from "@/lib/ev-charger-catalog";
import type { EnumOption } from "@/lib/enum-labels";
import { StatusPill } from "./status-pill";

/**
 * The line over the charger's Monitoring page: its state in a word (Available, Charging, Offline...), how it is connected, and since when a charge
 * has been running. It follows the charger's live channel, and a change of the connector's state fetches the page's session data again (once now
 * and once a few seconds later, when the charger's final report has been written), so the live tiles, today's curve and today's list never sit on
 * what was true before a charge started or ended.
 */
export function EvStatusLine({
  deviceId,
  name,
  options,
  initialCode,
  connectedAtLoad,
  runningSince,
}: {
  deviceId: string;
  name: string;
  options: EnumOption[];
  initialCode: number | null;
  /** as the server saw it when the page loaded (null = no verdict yet); the live channel takes over */
  connectedAtLoad: boolean | null;
  /** the clock time the running charge began, when one runs */
  runningSince: string | null;
}) {
  const router = useRouter();
  const n = useLiveNumbers([deviceId], ["connector_status"], { connector_status: initialCode });
  const live = useDeviceLive(deviceId);
  const connected = live.verdict ? live.verdict.status === "online" : connectedAtLoad;
  const status = connected === false ? { label: "Offline", tone: "bad" as const } : getConnectorStatusLabel(n.connector_status, options);

  const last = React.useRef(n.connector_status);
  React.useEffect(() => {
    if (last.current === n.connector_status) return;
    last.current = n.connector_status;
    router.refresh();
    const t = setTimeout(() => router.refresh(), 4_000);
    return () => clearTimeout(t);
  }, [n.connector_status, router]);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-sm font-semibold text-foreground">{name}</span>
      <StatusPill label={status.label} tone={status.tone} />
      <span className="text-xs text-muted-foreground">
        {connected === false ? "Not connected right now" : connected === true ? "Connected through the monitoring unit" : "Connection not known yet"}
        {runningSince && connected !== false ? ` · charging since ${runningSince}` : ""}
      </span>
    </div>
  );
}
