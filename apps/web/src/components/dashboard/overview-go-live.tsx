"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { OVERVIEW_LIVE_KEYS } from "@/lib/overview-keys";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { useTelemetryStore } from "@/lib/telemetry/react";
import type { EnumOption } from "@/lib/enum-labels";
import { DeviceStatusIcon, type StatusDevice } from "./device-status-icons";
import { GoLiveProvider, GoLiveStatusButton, useGoLive } from "./go-live";
import { LiveStatusPill } from "./overview-live";
import { useDeviceState } from "./use-device-state";

/** While Go Live is on, feeds every reading the device sends (at its own rate) into the same live store the Overview
 *  already reads, so the energy flow, status row and numbers follow them in place. When it is paused or stops, nothing
 *  more arrives from here and the page simply keeps following the saved updates from Supabase. */
function OverviewLiveBridge({ deviceId, keys }: { deviceId: string; keys: string[] }) {
  const live = useGoLive();
  const store = useTelemetryStore();
  const register = live?.register;
  const state = live?.state;
  const seen = React.useRef(new Map<string, number>());

  React.useEffect(() => (register ? register(keys) : undefined), [register, keys]);

  React.useEffect(() => {
    if (!state || state.status !== "live") {
      seen.current.clear();
      return;
    }
    const values: Record<string, number> = {};
    let newest = 0;
    for (const [key, s] of state.series) {
      const n = s.t.length;
      if (n === 0 || s.t[n - 1] <= (seen.current.get(key) ?? 0)) continue;
      seen.current.set(key, s.t[n - 1]);
      values[key] = s.v[n - 1];
      newest = Math.max(newest, s.t[n - 1]);
    }
    if (newest > 0) store.applyTick(deviceId, { ts: new Date(newest).toISOString(), values });
  }, [state, store, deviceId]);

  return null;
}

const EV_LIVE_KEYS = ["power_active_import_kw", "power_offered_kw", "current_import_l1_a", "voltage_l1_n_v", "connector_temperature_c"];

/** The device status for the page header (every page), as icons: a server for the inverters and a charger for the EV chargers, each with its
 *  count in the colour of its state - nothing is written out, the colour is the status. Each icon is its own Go Live: clicking it
 *  tries a live connection to that kind of device and feeds the readings into the page (see DeviceStatusIcon). */
export function OverviewHeaderStatus({ devices, pvKeys, defaultSelectedId }: { devices: StatusDevice[]; pvKeys: string[]; defaultSelectedId: string | null }) {
  // The device the page is showing: the page's own ?device=, else the one last picked (the cookie), else the first.
  const param = useSearchParams().get("device");
  const selectedId = devices.some((d) => d.id === param) ? (param as string) : devices.some((d) => d.id === defaultSelectedId) ? (defaultSelectedId as string) : (devices[0]?.id ?? "");
  const groups = (["inverter", "ev"] as const)
    .map((kind) => ({ kind, devices: devices.filter((d) => d.kind === kind) }))
    .filter((g) => g.devices.length > 0);
  return (
    <div className="flex items-center gap-2">
      {groups.map((g, i) => (
        <LiveKind key={g.kind} kind={g.kind} devices={g.devices} index={i} pvKeys={pvKeys} selectedId={selectedId} />
      ))}
    </div>
  );
}

/** One kind of device with its own Go Live session (on its selected device, or its first), its icon, and the bridge that feeds the
 *  readings in. Switching to another device of the kind starts the session over for it. */
function LiveKind({ kind, devices, index, pvKeys, selectedId }: { kind: "inverter" | "ev"; devices: StatusDevice[]; index: number; pvKeys: string[]; selectedId: string }) {
  const target = devices.find((d) => d.id === selectedId) ?? devices[0];
  const keys = React.useMemo(() => (kind === "inverter" ? [...OVERVIEW_LIVE_KEYS, ...pvKeys] : EV_LIVE_KEYS), [kind, pvKeys]);
  return (
    <GoLiveProvider key={target.id} deviceId={target.id} agentOnline history={false}>
      <DeviceStatusIcon kind={kind} devices={devices} selectedId={selectedId} index={index} />
      <OverviewLiveBridge deviceId={target.id} keys={keys} />
    </GoLiveProvider>
  );
}

/** The Overview's status for the page header (top right): the inverter's state with the Go Live icon in front of it, and the time of its last reading under it. */
export function OverviewStatus({
  inverterIds,
  initial,
  inverterStateOptions,
  sync,
  pvKeys = [],
}: {
  inverterIds: string[];
  initial: Record<string, number | null>;
  inverterStateOptions: EnumOption[];
  sync: DeviceSyncInit;
  /** The device's PV power keys, which solar generation is made of. */
  pvKeys?: string[];
}) {
  const deviceId = inverterIds[0];
  if (!deviceId) return <LiveStatusPill inverterIds={inverterIds} initial={initial} inverterStateOptions={inverterStateOptions} sync={sync} />;
  return (
    <WithGoLive deviceId={deviceId} sync={sync} pvKeys={pvKeys}>
      <LiveStatusPill
        inverterIds={inverterIds}
        initial={initial}
        inverterStateOptions={inverterStateOptions}
        sync={sync}
        wrapStatus={(pill) => <GoLiveFromStatus deviceId={deviceId}>{pill}</GoLiveFromStatus>}
      />
    </WithGoLive>
  );
}

/** The Go Live icon in front of the status word, as one button. Starting it also re-reads the device's connection from the server,
 *  so the time under the status is current straight away. */
function GoLiveFromStatus({ deviceId, children }: { deviceId: string; children: React.ReactNode }) {
  const store = useTelemetryStore();
  const refreshConnection = React.useCallback(() => void store.refreshHeartbeat(deviceId), [store, deviceId]);
  return <GoLiveStatusButton onStart={refreshConnection}>{children}</GoLiveStatusButton>;
}

function WithGoLive({ deviceId, sync, pvKeys, children }: { deviceId: string; sync: DeviceSyncInit; pvKeys: string[]; children: React.ReactNode }) {
  // Whether the device is answering only tints the icon: clicking it always tries a live connection, even when it says Offline.
  const { offline } = useDeviceState(deviceId, sync);
  const inverterKeys = React.useMemo(() => [...OVERVIEW_LIVE_KEYS, ...pvKeys], [pvKeys]);
  return (
    <GoLiveProvider deviceId={deviceId} agentOnline={!offline} history={false}>
      <div className="flex items-center justify-end gap-1">{children}</div>
      <OverviewLiveBridge deviceId={deviceId} keys={inverterKeys} />
    </GoLiveProvider>
  );
}
