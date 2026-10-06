"use client";

import * as React from "react";
import { useTelemetryStore } from "./react";

/** How the same metric of several devices is combined into one site-level number. */
export type Agg = "sum" | "avg" | "max" | "first";

export function combineValues(values: number[], agg: Agg): number | null {
  if (values.length === 0) return null;
  switch (agg) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "max":
      return Math.max(...values);
    case "first":
      return values[0];
  }
}

/**
 * The live value of several metrics across a set of devices, falling back to the value the server rendered until a
 * live one exists. Re-renders its component only when one of these numbers actually changes - never the page.
 *
 *  - `agg` says how each metric combines across devices (default: sum);
 *  - until EVERY device has reported a live value the server's `initial` stays on screen (so a half-updated sum
 *    never flashes), unless there is no initial at all.
 */
export function useLiveNumbers(
  deviceIds: string[],
  keys: string[],
  initial: Record<string, number | null>,
  agg: (key: string) => Agg = () => "sum"
): Record<string, number | null> {
  const store = useTelemetryStore();
  const idsSig = deviceIds.join("|");
  const keysSig = keys.join("|");
  const last = React.useRef<Record<string, number | null> | null>(null);

  const subscribe = React.useCallback(
    (cb: () => void) => {
      const offs = deviceIds.flatMap((id) => keys.map((k) => store.subscribeKey(id, k, cb)));
      return () => offs.forEach((off) => off());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, idsSig, keysSig]
  );

  const compute = (): Record<string, number | null> => {
    const out: Record<string, number | null> = {};
    for (const key of keys) {
      const live = deviceIds.map((id) => store.getLatest(id, key)?.value).filter((v): v is number => typeof v === "number");
      const complete = deviceIds.length > 0 && live.length === deviceIds.length;
      out[key] = complete || (live.length > 0 && initial[key] == null) ? combineValues(live, agg(key)) : (initial[key] ?? null);
    }
    return out;
  };

  const getSnapshot = (): Record<string, number | null> => {
    const next = compute();
    const prev = last.current;
    if (prev && keys.every((k) => prev[k] === next[k])) return prev; // same numbers -> same object: no re-render
    last.current = next;
    return next;
  };

  // The server/hydration snapshot must be one stable object per set of initial numbers.
  const initialSig = keys.map((k) => initial[k] ?? "").join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const serverSnapshot = React.useMemo(() => initial, [initialSig]);
  return React.useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}

export function useLiveNumber(deviceIds: string[], key: string, initial: number | null, agg: Agg = "sum"): number | null {
  const init = React.useMemo(() => ({ [key]: initial }), [key, initial]);
  return useLiveNumbers(deviceIds, [key], init, () => agg)[key];
}
