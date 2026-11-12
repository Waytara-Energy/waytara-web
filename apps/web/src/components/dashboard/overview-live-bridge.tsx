"use client";

import * as React from "react";
import { useTelemetryStore } from "@/lib/telemetry/react";
import { useGoLive } from "./go-live";
import { LiveChannelKeeper } from "./overview-live";

export { LiveChannelKeeper };

/** While Go Live is on, feeds every reading the device sends (at its own rate) into the same live store the Overview
 *  already reads, so the energy flow, status row and numbers follow them in place. When it is paused or stops, nothing
 *  more arrives from here and the page simply keeps following the saved updates from Supabase. */
export function OverviewLiveBridge({ deviceId, keys }: { deviceId: string; keys: string[] }) {
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
