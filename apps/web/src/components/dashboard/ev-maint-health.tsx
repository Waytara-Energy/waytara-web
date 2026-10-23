"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agoText } from "@/lib/device-status-summary";
import type { DeviceState } from "@/lib/device-state";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { getConnectorStatusLabel, getErrorCodeLabel } from "@/lib/ev-charger-catalog";
import type { EvMaintData } from "@/lib/ev-maint-data";
import { evEventLine, evHealthChecks, type EvEventTone } from "@/lib/ev-maint-health";
import { checkReportText, checkSubject, problemCount, verdictOf, type HealthCheck, type Verdict } from "@/lib/maintenance-health";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { useDeviceLive } from "@/lib/telemetry/react";
import { cn } from "@/lib/utils";
import { CHECK_ICON, ReportButton, type ReportTarget } from "./maintenance-report";
import { useDeviceState } from "./use-device-state";

const NO_SYNC: DeviceSyncInit = { lastTs: null, agentSeenTs: null, deviceOnline: null, intervalS: null, heartbeatS: null };
const LIVE_KEYS = ["connector_status", "error_code"];
/** How many events the list shows. */
const EVENT_ROWS = 20;

export interface EvHealth {
  checks: HealthCheck[];
  verdict: Verdict;
  problems: number;
  /** The charger's last check-in in words ("12s ago"), or a dash. */
  lastCheckIn: string;
}

/** The charger's health, kept live: its own status, the unit's status, the connector and error codes, and how long ago it last checked in. Null for
 *  a device that is not a charger (the hooks still run, so the board can call this unconditionally). */
export function useEvMaintHealth(deviceId: string, sync: DeviceSyncInit, state: DeviceState, ev: EvMaintData | null): EvHealth | null {
  const unitState = useDeviceState(ev?.unit?.id ?? "", ev?.unit?.sync ?? NO_SYNC);
  const live = useLiveNumbers([deviceId], LIVE_KEYS, { connector_status: ev?.connector.status ?? null, error_code: ev?.connector.error ?? null }, () => "first");
  const tick = useDeviceLive(deviceId);
  const [clock, setClock] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const unitStatus = unitState.status;
  return React.useMemo(() => {
    if (!ev) return null;
    const seenAt = Math.max(sync.agentSeenTs ? Date.parse(sync.agentSeenTs) : 0, tick.lastTickAt ?? 0) || null;
    const code = live.connector_status ?? null;
    const checks = evHealthChecks({
      connection: state.status,
      unit: ev.unit ? { label: ev.unit.label, status: unitStatus } : null,
      lastCheckInAgeS: seenAt === null ? null : Math.max(0, Math.round((clock - seenAt) / 1000)),
      heartbeatS: sync.heartbeatS,
      connector: { label: code === null ? null : getConnectorStatusLabel(code, ev.enums.connector).label, code, error: getErrorCodeLabel(live.error_code ?? null, ev.enums.error) },
      lastCharge: ev.lastCharge,
      firmware: ev.firmware,
    });
    return { checks, verdict: verdictOf(state.status, checks), problems: problemCount(checks), lastCheckIn: seenAt === null ? "—" : agoText(clock - seenAt) };
  }, [ev, sync.agentSeenTs, sync.heartbeatS, tick.lastTickAt, live.connector_status, live.error_code, state.status, unitStatus, clock]);
}

const TONE_DOT: Record<EvEventTone, string> = { good: "bg-emerald-500", info: "bg-sky-500", warn: "bg-amber-500", bad: "bg-destructive" };
const when = (ts: string) => new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** The charger's checks (like the inverter's, each fine, a heads-up or a problem, with a button to get support for the ones that are not fine) and its
 *  recent events in plain words. */
export function EvMaintHealth({ health, events, report, openIssues }: { health: EvHealth; events: EvMaintData["events"]; report: ReportTarget | null; openIssues: string[] }) {
  const lines = React.useMemo(
    () =>
      events
        .map((e) => ({ e, line: evEventLine(e.kind, e.detail) }))
        .filter((x): x is { e: EvMaintData["events"][number]; line: NonNullable<ReturnType<typeof evEventLine>> } => x.line !== null)
        .slice(0, EVENT_ROWS),
    [events]
  );
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-sm">Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border/60">
            {health.checks.map((c) => {
              const { Icon, className } = CHECK_ICON[c.state];
              return (
                <li key={c.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Icon className={cn("mt-0.5 size-4 shrink-0", className)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                  {c.state !== "ok" && report && <ReportButton report={report} tag={checkSubject(c.label)} subject={checkSubject(c.label)} text={checkReportText(c.label, c.detail)} openIssues={openIssues} label="Get support" />}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm">Recent charger events</CardTitle>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been recorded yet. Events appear here when the charger connects, changes state or finishes a charge.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {lines.map(({ e, line }) => (
                <li key={e.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[line.tone])} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{line.text}</p>
                    <p className="text-xs text-muted-foreground">{when(e.ts)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
