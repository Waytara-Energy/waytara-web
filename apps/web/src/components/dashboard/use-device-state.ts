"use client";

import * as React from "react";
import { computeDeviceState, type DeviceState } from "@/lib/device-state";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { useDeviceLive } from "@/lib/telemetry/react";
import { useSettledState } from "./status-settle";

/** Is the device really reporting? Starts from what the server rendered and follows the server's verdict, which arrives over the live channel
 *  (Supabase realtime) the moment it CHANGES. Nothing here judges silence with a timer or the browser's clock: a device the server has no verdict
 *  for (older setups) is the only case that still uses the clock. The result is steadied (see status-settle.ts): a device is shown inactive only once the page
 *  has loaded and re-read the status, and a working device only after it has stayed inactive for a short grace period. */
export function useDeviceState(deviceId: string, init: DeviceSyncInit): DeviceState {
  const live = useDeviceLive(deviceId);
  const legacy = !init.verdict && !live.verdict;
  const [clock, setClock] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!legacy) return;
    const id = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [legacy]);
  return useSettledState(deviceId, React.useMemo(() => computeDeviceState(init, live, clock), [init, live, clock]));
}
