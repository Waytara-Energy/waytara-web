"use client";

import * as React from "react";
import { FAULT_BITMASK_KEYS_LIVE } from "@/lib/overview-keys";
import { faultCodeOf } from "@/lib/notification-items";
import { useTelemetryStore } from "@/lib/telemetry/react";

/** The fault each device is reporting right now (null = none), live. `initial` is what the server read; once a device has reported
 *  its fault and alarm registers over the live channel, those replace it. Re-renders only when a device's fault changes. */
export function useDeviceFaultCodes(deviceIds: string[], initial: Record<string, number | null>): Record<string, number | null> {
  const store = useTelemetryStore();
  const idsSig = deviceIds.join("|");
  const last = React.useRef<Record<string, number | null> | null>(null);

  const subscribe = React.useCallback(
    (cb: () => void) => {
      const offs = deviceIds.flatMap((id) => FAULT_BITMASK_KEYS_LIVE.map((k) => store.subscribeKey(id, k, cb)));
      return () => offs.forEach((off) => off());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, idsSig]
  );

  const getSnapshot = (): Record<string, number | null> => {
    const next: Record<string, number | null> = {};
    for (const id of deviceIds) {
      const live: Record<string, number | null> = {};
      let reported = 0;
      for (const k of FAULT_BITMASK_KEYS_LIVE) {
        const v = store.getLatest(id, k)?.value;
        if (typeof v === "number") {
          live[k] = v;
          reported++;
        }
      }
      // Every register has reported: the live reading is the whole truth. Some have: a fault seen live counts, otherwise the
      // server's reading stands until the rest report.
      const fromLive = faultCodeOf(live);
      next[id] = reported === FAULT_BITMASK_KEYS_LIVE.length ? fromLive : (fromLive ?? initial[id] ?? null);
    }
    const prev = last.current;
    if (prev && deviceIds.every((id) => prev[id] === next[id]) && Object.keys(prev).length === deviceIds.length) return prev;
    last.current = next;
    return next;
  };

  const serverSnapshot = React.useMemo(() => initial, [initial]);
  return React.useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}
