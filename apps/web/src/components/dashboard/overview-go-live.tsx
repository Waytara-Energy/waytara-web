"use client";

import * as React from "react";
import { OVERVIEW_LIVE_KEYS } from "@/lib/overview-keys";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { useTelemetryStore } from "@/lib/telemetry/react";
import type { EnumOption } from "@/lib/enum-labels";
import { GoLiveButton, GoLiveProvider, useGoLive } from "./go-live";
import { LiveStatusPill } from "./overview-live";
import { useDeviceState } from "./use-device-state";

/** While Go Live is on, feeds every reading the device sends (at its own rate) into the same live store the Overview
 *  already reads, so the energy flow, status row and numbers follow them in place. When it is paused or stops, nothing
 *  more arrives from here and the page simply keeps following the saved updates from Supabase. */
function OverviewLiveBridge({ deviceId }: { deviceId: string }) {
  const live = useGoLive();
  const store = useTelemetryStore();
  const register = live?.register;
  const state = live?.state;
  const seen = React.useRef(new Map<string, number>());

  React.useEffect(() => (register ? register(OVERVIEW_LIVE_KEYS) : undefined), [register]);

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

/** Top right of Overview: the Go Live button, then the inverter's status. */
export function OverviewStatus({
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
  const deviceId = inverterIds[0];
  const status = <LiveStatusPill inverterIds={inverterIds} initial={initial} inverterStateOptions={inverterStateOptions} sync={sync} />;
  if (!deviceId) return status;
  return (
    <WithGoLive deviceId={deviceId} sync={sync}>
      {status}
    </WithGoLive>
  );
}

function WithGoLive({ deviceId, sync, children }: { deviceId: string; sync: DeviceSyncInit; children: React.ReactNode }) {
  // Go Live needs the device to be answering: with the device off there is nothing to stream.
  const { offline } = useDeviceState(deviceId, sync);
  return (
    <GoLiveProvider deviceId={deviceId} agentOnline={!offline} history={false}>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <GoLiveButton />
        {children}
      </div>
      <OverviewLiveBridge deviceId={deviceId} />
    </GoLiveProvider>
  );
}
