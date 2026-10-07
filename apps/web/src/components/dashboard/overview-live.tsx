"use client";

import * as React from "react";
import type { ComponentProps } from "react";
import { useDeviceLive } from "@/lib/telemetry/react";
import { useLiveNumbers, type Agg } from "@/lib/telemetry/live-values";
import { FAULT_BITMASK_KEYS_LIVE, SITE_OVERVIEW_KEYS, siteAgg } from "@/lib/overview-keys";
import type { EnumOption } from "@/lib/enum-labels";
import type { TemplateField } from "@/lib/template-field-format";
import { DeviceStatusPill } from "./device-status-pill";
import { LiveSyncedAgo } from "./live-synced-ago";
import { useDeviceState } from "./use-device-state";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EnergyFlowDiagram } from "./energy-flow-diagram";
import { FaultBanner } from "./fault-banner";
import { TodaySoFar } from "./today-so-far";

/** Overview's numbers for a set of inverters (one device, or every inverter at a site), live. `initial` is what the
 *  server rendered; each live message then updates the figures in place - no page refresh, no refetch. */
function useSiteNumbers(inverterIds: string[], initial: Record<string, number | null>) {
  const keys = React.useMemo(() => [...SITE_OVERVIEW_KEYS], []);
  return useLiveNumbers(inverterIds, keys, initial, (k) => siteAgg(k) as Agg);
}

function faultCodeOf(n: Record<string, number | null>): number | null {
  for (const k of FAULT_BITMASK_KEYS_LIVE) if (n[k]) return n[k];
  return null;
}

/** Keeps every device's live channel open for as long as the Overview is mounted. */
export function LiveChannelKeeper({ deviceIds }: { deviceIds: string[] }) {
  return (
    <>
      {deviceIds.map((id) => (
        <Keeper key={id} deviceId={id} />
      ))}
    </>
  );
}
function Keeper({ deviceId }: { deviceId: string }) {
  useDeviceLive(deviceId);
  return null;
}

/** The top-right status of Overview: the inverter's state as a coloured word ("Offline" when the device is not
 *  reporting) with "updated X ago" under it - the time of the device's last reading, not of the agent's last upload. */
export function LiveStatusPill({
  inverterIds,
  initial,
  inverterStateOptions,
  sync,
}: {
  inverterIds: string[];
  initial: Record<string, number | null>;
  inverterStateOptions: EnumOption[];
  sync: DeviceSyncInit;
}) {
  const n = useSiteNumbers(inverterIds, initial);
  return (
    <div className="flex flex-col items-end gap-1.5">
      {inverterIds[0] ? (
        <StatusWithAgo deviceId={inverterIds[0]} sync={sync} state={n.inverter_run_state ?? null} faultCode={faultCodeOf(n)} options={inverterStateOptions} />
      ) : (
        <DeviceStatusPill inverterState={null} inverterStateOptions={inverterStateOptions} variant="text" />
      )}
    </div>
  );
}

function StatusWithAgo({
  deviceId,
  sync,
  state,
  faultCode,
  options,
}: {
  deviceId: string;
  sync: DeviceSyncInit;
  state: number | null;
  faultCode: number | null;
  options: EnumOption[];
}) {
  const { lastReadAt, offline } = useDeviceState(deviceId, sync);
  return (
    <>
      <DeviceStatusPill inverterState={state} activeFaultCode={faultCode} inverterStateOptions={options} variant="text" offline={offline} />
      <LiveSyncedAgo lastTs={lastReadAt} />
    </>
  );
}

/** A line under the header while the device is not reporting: what is shown is the last it said. */
export function DeviceOfflineNotice({ deviceId, sync }: { deviceId: string; sync: DeviceSyncInit }) {
  const { offline, agentOnline, lastReadAt } = useDeviceState(deviceId, sync);
  if (!offline) return null;
  return (
    <Alert variant="destructive">
      <WifiOff />
      <AlertTitle>Device offline</AlertTitle>
      <AlertDescription>
        {agentOnline
          ? "The agent is running but the device is not answering (is it switched on and reachable?)."
          : "Nothing has been received from the device agent recently."}{" "}
        {lastReadAt ? `The numbers below are from the last reading, ${new Date(lastReadAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.` : "No reading has been received yet."}
      </AlertDescription>
    </Alert>
  );
}

export function LiveFaultBanner({ inverterIds, initial }: { inverterIds: string[]; initial: Record<string, number | null> }) {
  const n = useSiteNumbers(inverterIds, initial);
  return <FaultBanner faultCode={faultCodeOf(n)} />;
}

/** The energy-flow picture. The inverter reports battery power as POSITIVE = DISCHARGING; the diagram's
 *  convention is positive = charging, so the sign is flipped here (once, in one place). */
export function LiveEnergyFlow({
  inverterIds,
  chargerIds = [],
  initial,
  initialEvW,
  powerPackage,
  powerSourceCategory,
  sync,
}: {
  inverterIds: string[];
  chargerIds?: string[];
  initial: Record<string, number | null>;
  initialEvW: number | null;
  powerPackage: string | null;
  powerSourceCategory: string | null;
  /** When given, the picture goes to its "offline" look while the device is not reporting. */
  sync?: DeviceSyncInit;
}) {
  const n = useSiteNumbers(inverterIds, initial);
  const ev = useLiveNumbers(chargerIds, ["power_active_import_kw"], { power_active_import_kw: initialEvW === null ? null : initialEvW / 1000 }, () => "sum");
  const evKw = ev.power_active_import_kw;
  const batteryRaw = n.battery_power_w ?? null;
  const flow = {
    solarW: n.inverter_output_power_w ?? null,
    batteryW: batteryRaw === null ? null : -batteryRaw,
    gridW: n.grid_total_power_w ?? null,
    loadW: n.load_total_power_w ?? null,
    batterySocPct: n.battery_soc_pct ?? null,
    evW: evKw === null || evKw === undefined ? null : Math.round(evKw * 1000),
    powerPackage,
    powerSourceCategory,
  };
  return sync && inverterIds[0] ? <OfflineAwareFlow deviceId={inverterIds[0]} sync={sync} flow={flow} /> : <EnergyFlowDiagram {...flow} />;
}

function OfflineAwareFlow({ deviceId, sync, flow }: { deviceId: string; sync: DeviceSyncInit; flow: ComponentProps<typeof EnergyFlowDiagram> }) {
  const { offline } = useDeviceState(deviceId, sync);
  return <EnergyFlowDiagram {...flow} offline={offline} />;
}

export function LiveTodaySoFar({
  inverterIds,
  initial,
  fields,
  enabledKeys,
}: {
  inverterIds: string[];
  initial: Record<string, number | null>;
  fields: TemplateField[];
  enabledKeys: string[];
}) {
  const n = useSiteNumbers(inverterIds, initial);
  const enabled = React.useMemo(() => new Set(enabledKeys), [enabledKeys]);
  return <TodaySoFar fields={fields} get={(k) => n[k] ?? null} enabledKeys={enabled} />;
}
