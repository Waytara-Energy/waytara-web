"use client";

import * as React from "react";
import { computeDeviceState, type DeviceState } from "@/lib/device-state";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { useDeviceLive } from "@/lib/telemetry/react";

/** Is the device really reporting? Starts from what the server rendered and follows the live messages (which carry
 *  the agent's own view of the device) - so a switched-off device shows as offline instead of "updated a minute ago". */
export function useDeviceState(deviceId: string, init: DeviceSyncInit): DeviceState {
  const live = useDeviceLive(deviceId);
  const [clock, setClock] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  return computeDeviceState(init, live, clock);
}
