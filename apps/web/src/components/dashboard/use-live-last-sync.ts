"use client";

import { useDeviceLive } from "@/lib/telemetry/react";

/** "Last synced" for a device: the newer of what the server knew and the last live message this tab received.
 *  (Also keeps the device's live channel open while the calling component is mounted.) */
export function useLiveLastSync(deviceId: string, initial: string | null): string | null {
  const { lastTickAt } = useDeviceLive(deviceId);
  if (lastTickAt === null) return initial;
  const tick = new Date(lastTickAt).toISOString();
  return initial && initial > tick ? initial : tick;
}
