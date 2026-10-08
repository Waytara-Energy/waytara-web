import { isAgentOnline } from "./agent-online";
import type { DeviceSyncInit } from "./device-sync-types";

/** online: readings are coming in. connection_lost: the monitoring unit is alive but cannot reach the device (the
 *  inverter's adapter is off or unreachable). offline: nothing is arriving from the unit at all (it lost power or its
 *  internet - for example an adapter fed by an inverter that was switched off). */
export type ConnectionStatus = "online" | "connection_lost" | "offline";

export interface DeviceState {
  /** When the device last answered a reading. */
  lastReadAt: string | null;
  /** The agent is alive (heard from recently). */
  agentOnline: boolean;
  /** Nothing live is coming from the device: the agent is silent, or the agent says the device does not answer. */
  offline: boolean;
  status: ConnectionStatus;
}

export const CONNECTION_LABEL: Record<Exclude<ConnectionStatus, "online">, string> = {
  connection_lost: "Connection lost",
  offline: "Offline",
};

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
  // The unit checks in every heartbeat_s (when it says), so its silence is judged by that rather than by its (much
  // slower) upload interval: a unit that lost power shows within minutes.
  const agentOnline = isAgentOnline(agentSeen, nowMs, init.heartbeatS ?? init.intervalS);
  // The agent's own word on the device wins; an agent that says nothing is judged by how recent the last reading is.
  const explicit = live.deviceOnline ?? init.deviceOnline;
  const deviceSilent = explicit === false || (explicit === null && !isAgentOnline(lastReadAt, nowMs, init.intervalS));
  const status: ConnectionStatus = !agentOnline ? "offline" : deviceSilent ? "connection_lost" : "online";
  return { lastReadAt, agentOnline, offline: status !== "online", status };
}
