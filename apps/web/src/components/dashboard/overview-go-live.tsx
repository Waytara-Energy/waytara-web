"use client";

import * as React from "react";
import { OVERVIEW_LIVE_KEYS } from "@/lib/overview-keys";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { useTelemetryStore } from "@/lib/telemetry/react";
import type { EnumOption } from "@/lib/enum-labels";
import { GoLiveProvider, GoLiveStatusButton } from "./go-live";
import { LiveStatusPill } from "./overview-live";
import { OverviewLiveBridge } from "./overview-live-bridge";
import { useDeviceState } from "./use-device-state";

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
