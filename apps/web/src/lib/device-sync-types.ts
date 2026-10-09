/** The server's verdict on a device (the equipment_status view): worked out by the server from the unit's check-ins and its own
 *  clock, so it does not depend on the browser's clock or on any timer here. */
export interface ServerVerdict {
  status: "online" | "device_unreachable" | "offline" | "never_seen";
  /** Why it is not online, in short. */
  reason: string | null;
  /** The unit's last check-in, by the server's clock (epoch ms). */
  lastSeenMs: number | null;
  /** Silence longer than this (seconds) means offline: 3 check-in intervals, at least 30. */
  offlineAfterS: number;
  /** The server's clock when it said this (epoch ms): the browser measures every age against it. */
  serverNowMs: number;
}

/** What the server knows about a device's connection when a page is rendered; the live components take it from there. */
export interface DeviceSyncInit {
  /** The server's verdict when the page was rendered. */
  verdict?: ServerVerdict | null;
  /** When the device last answered a reading (null = never / unknown). */
  lastTs: string | null;
  /** When the agent last uploaded anything (the agent being alive, whether or not the device answered). */
  agentSeenTs: string | null;
  /** Whether the agent says the device is answering; null = it does not say (older agents). */
  deviceOnline: boolean | null;
  /** How often the agent uploads (seconds), when it has said. */
  intervalS: number | null;
  /** How often the agent checks in between uploads (seconds); null for an older agent that does not. */
  heartbeatS: number | null;
}
