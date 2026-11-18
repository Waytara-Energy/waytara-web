"use client";

import * as React from "react";
import type { ConnectionStatus, DeviceState } from "@/lib/device-state";
import { applyShown, settleStatus, type SettleMemory } from "@/lib/device-state-settle";
import { useTelemetryStore } from "@/lib/telemetry/react";

// What the dashboard shows for a device's connection, steadied (see lib/device-state-settle.ts): nothing inactive is shown from a half-loaded page, the last known
// status is kept between visits, and a working device must stay inactive for a short grace period (after which the server is asked again) before it is shown so.

// ---- "the page has finished loading and re-read the status" ----
let ready = false;
const listeners = new Set<() => void>();
let fallbackStarted = false;

/** Called by the dashboard's device hub once the page has loaded and the status has been re-read. */
export function markStatusReady() {
  if (ready) return;
  ready = true;
  listeners.forEach((l) => l());
}

function subscribeReady(cb: () => void) {
  listeners.add(cb);
  // A page with no hub to say so (it should not happen inside the dashboard) is not held back for ever.
  if (!fallbackStarted) {
    fallbackStarted = true;
    setTimeout(markStatusReady, 8000);
  }
  return () => void listeners.delete(cb);
}

const useStatusReady = () => React.useSyncExternalStore(subscribeReady, () => ready, () => false);
const useIsClient = () => React.useSyncExternalStore(() => () => {}, () => true, () => false);

// ---- what was last shown, kept in the browser between visits ----
const KEY = (id: string) => `waytara:device-status:${id}`;
const memory = new Map<string, SettleMemory>();

function readStored(id: string): ConnectionStatus | null {
  try {
    const v = window.localStorage.getItem(KEY(id));
    return v === "online" || v === "offline" || v === "connection_lost" ? v : null;
  } catch {
    return null;
  }
}

function memoryOf(id: string): SettleMemory {
  let m = memory.get(id);
  if (!m) {
    m = { shown: readStored(id), since: null };
    memory.set(id, m);
  }
  return m;
}

function commit(id: string, mem: SettleMemory) {
  const before = memory.get(id)?.shown ?? null;
  memory.set(id, mem);
  if (mem.shown !== before && mem.shown) {
    try {
      window.localStorage.setItem(KEY(id), mem.shown);
    } catch {
      /* storage is off: the steadying still works within the visit */
    }
  }
}

/** What this device was last shown as, before this visit began (null when never, and on the server). For the toast, which speaks only of a change. */
export function storedStatus(id: string): ConnectionStatus | null {
  return typeof window === "undefined" ? null : readStored(id);
}

/**
 * The devices' raw states, steadied. A device that is online is returned as it is. One that is not is shown as it was last known until the page is ready and, for a
 * device that was working, until it has stayed inactive for the grace period (then the server is asked once more, and the answer decides).
 */
export function useSettledStates(raw: Record<string, DeviceState>): Record<string, DeviceState> {
  const store = useTelemetryStore();
  const isReady = useStatusReady();
  const client = useIsClient();
  const [shown, setShown] = React.useState<Record<string, ConnectionStatus>>({});
  const [tick, bump] = React.useReducer((n: number) => n + 1, 0);
  const sig = Object.entries(raw)
    .map(([id, s]) => `${id}:${s.status}`)
    .join(",");

  React.useEffect(() => {
    if (!client) return;
    const now = Date.now();
    const next: Record<string, ConnectionStatus> = {};
    const waiting: string[] = [];
    let wait: number | null = null;
    for (const entry of sig.split(",")) {
      if (!entry) continue;
      const at = entry.lastIndexOf(":");
      const id = entry.slice(0, at);
      const status = entry.slice(at + 1) as ConnectionStatus;
      const r = settleStatus(status, isReady, now, memoryOf(id));
      commit(id, r.mem);
      next[id] = r.shown;
      if (r.waitMs !== null) {
        waiting.push(id);
        wait = wait === null ? r.waitMs : Math.min(wait, r.waitMs);
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown((prev) => (Object.keys(next).length === Object.keys(prev).length && Object.entries(next).every(([id, s]) => prev[id] === s) ? prev : next));
    if (wait === null) return;
    // When the wait is over, ask the server again: a device is shown inactive only if it still is.
    const timer = setTimeout(() => {
      void Promise.allSettled(waiting.map((id) => store.refreshHeartbeat(id))).finally(bump);
    }, wait + 50);
    return () => clearTimeout(timer);
  }, [client, sig, isReady, tick, store]);

  return Object.fromEntries(
    Object.entries(raw).map(([id, s]) => [id, s.status === "online" ? s : applyShown(s, shown[id] ?? "online")])
  );
}

/** One device's state, steadied. */
export function useSettledState(deviceId: string, raw: DeviceState): DeviceState {
  const map = React.useMemo(() => ({ [deviceId]: raw }), [deviceId, raw]);
  return useSettledStates(map)[deviceId];
}
