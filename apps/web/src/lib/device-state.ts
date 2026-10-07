import { isAgentOnline } from "./agent-online";
import type { DeviceSyncInit } from "./device-sync-types";

export interface DeviceState {
  /** When the device last answered a reading. */
  lastReadAt: string | null;
  /** The agent is alive (heard from recently). */
  agentOnline: boolean;
  /** Nothing live is coming from the device: the agent is silent, or the agent says the device does not answer. */
  offline: boolean;
}

function newest(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

/** Combines what the server rendered with what the live messages have said since (epoch ms, or null). */
export function computeDeviceState(
  init: DeviceSyncInit,
  live: { lastTickAt: number | null; lastReadAt: number | null; deviceOnline: boolean | null },
  nowMs: number
): DeviceState {
  const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
  const lastReadAt = newest(init.lastTs, iso(live.lastReadAt));
  const agentSeen = newest(init.agentSeenTs, iso(live.lastTickAt));
  const agentOnline = isAgentOnline(agentSeen, nowMs, init.intervalS);
  // The agent's own word on the device wins; an agent that says nothing is judged by how recent the last reading is.
  const explicit = live.deviceOnline ?? init.deviceOnline;
  const offline = !agentOnline || explicit === false || (explicit === null && !isAgentOnline(lastReadAt, nowMs, init.intervalS));
  return { lastReadAt, agentOnline, offline };
}
