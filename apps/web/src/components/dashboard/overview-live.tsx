"use client";

import * as React from "react";
import { useDeviceLive } from "@/lib/telemetry/react";
import { useLiveNumbers, type Agg } from "@/lib/telemetry/live-values";
import { FAULT_BITMASK_KEYS_LIVE, SITE_OVERVIEW_KEYS, siteAgg } from "@/lib/overview-keys";
import type { EnumOption } from "@/lib/enum-labels";
import type { TemplateField } from "@/lib/template-field-format";
import { DeviceStatusPill } from "./device-status-pill";
import { LiveSyncedAgo } from "./live-synced-ago";
import { useDeviceState } from "./use-device-state";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { solarGenerationW } from "@/lib/solar-generation";
import { EnergyFlowDiagram } from "./energy-flow-diagram";
import { FaultBanner } from "./fault-banner";
import { TodaySoFar } from "./today-so-far";

/** Overview's numbers for a set of inverters (one device, or every inverter at a site), live. `initial` is what the
 *  server rendered; each live message then updates the figures in place - no page refresh, no refetch. */
function useSiteNumbers(inverterIds: string[], initial: Record<string, number | null>, pvKeys: string[] = []) {
  const pvSig = pvKeys.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const keys = React.useMemo(() => [...SITE_OVERVIEW_KEYS, ...pvKeys], [pvSig]);
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

/** The top-right status of Overview: the inverter's state as a coloured word with "updated X ago" under it - the time of the device's last reading, not of the agent's last upload. */
export function LiveStatusPill({
  inverterIds,
  initial,
  inverterStateOptions,
  sync,
  wrapStatus,
}: {
  inverterIds: string[];
  initial: Record<string, number | null>;
  inverterStateOptions: EnumOption[];
  sync: DeviceSyncInit;
  /** Wraps the status word (the Overview puts the Go Live icon in front of it and makes the pair one control). */
  wrapStatus?: (status: React.ReactNode) => React.ReactNode;
}) {
  const n = useSiteNumbers(inverterIds, initial);
  return (
    <div className="flex flex-col items-end gap-0.5 text-right">
      {inverterIds[0] ? (
        <StatusWithAgo deviceId={inverterIds[0]} sync={sync} state={n.inverter_run_state ?? null} faultCode={faultCodeOf(n)} options={inverterStateOptions} wrapStatus={wrapStatus} />
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
  wrapStatus,
}: {
  deviceId: string;
  sync: DeviceSyncInit;
  state: number | null;
  faultCode: number | null;
  options: EnumOption[];
  wrapStatus?: (status: React.ReactNode) => React.ReactNode;
}) {
  const { lastReadAt, offline, status } = useDeviceState(deviceId, sync);
  const pill = <DeviceStatusPill inverterState={state} activeFaultCode={faultCode} inverterStateOptions={options} variant="text" connection={status} />;
  return (
    <>
      {wrapStatus ? wrapStatus(pill) : pill}
      <LiveSyncedAgo lastTs={lastReadAt} label={offline ? "Last reading" : "Updated"} icon={false} />
    </>
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
  pvKeys = [],
  fit = false,
  sync,
}: {
  inverterIds: string[];
  chargerIds?: string[];
  initial: Record<string, number | null>;
  initialEvW: number | null;
  powerPackage: string | null;
  powerSourceCategory: string | null;
  /** The device's enabled PV power keys: solar generation is their sum (not the inverter's AC output). */
  pvKeys?: string[];
  /** Size the drawing to the screen's height (the Overview board). */
  fit?: boolean;
  /** The device's connection, so the drawing can freeze while the unit is offline or has lost the device. */
  sync: DeviceSyncInit;
}) {
  const n = useSiteNumbers(inverterIds, initial, pvKeys);
  const { status } = useDeviceState(inverterIds[0] ?? "", sync);
  const ev = useLiveNumbers(chargerIds, ["power_active_import_kw"], { power_active_import_kw: initialEvW === null ? null : initialEvW / 1000 }, () => "sum");
  const evKw = ev.power_active_import_kw;
  const batteryRaw = n.battery_power_w ?? null;
  const flow = {
    solarW: solarGenerationW(n, pvKeys),
    batteryW: batteryRaw === null ? null : -batteryRaw,
    gridW: n.grid_total_power_w ?? null,
    loadW: n.load_total_power_w ?? null,
    batterySocPct: n.battery_soc_pct ?? null,
    evW: evKw === null || evKw === undefined ? null : Math.round(evKw * 1000),
    powerPackage,
    powerSourceCategory,
    fit,
    inverterId: inverterIds[0],
    chargerId: chargerIds[0],
    frozen: status === "online" ? null : status,
    pvInputs: pvKeys.map((k) => ({ label: `PV${/^pv(\d+)_/.exec(k)?.[1] ?? ""}`, watts: n[k] ?? null })),
  };
  return <EnergyFlowDiagram {...flow} />;
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
