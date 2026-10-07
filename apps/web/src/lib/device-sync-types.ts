/** What the server knows about a device's connection when a page is rendered; the live components take it from there. */
export interface DeviceSyncInit {
  /** When the device last answered a reading (null = never / unknown). */
  lastTs: string | null;
  /** When the agent last uploaded anything (the agent being alive, whether or not the device answered). */
  agentSeenTs: string | null;
  /** Whether the agent says the device is answering; null = it does not say (older agents). */
  deviceOnline: boolean | null;
  /** How often the agent uploads (seconds), when it has said. */
  intervalS: number | null;
}
