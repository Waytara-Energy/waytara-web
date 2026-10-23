// What the Maintenance page's Health tab says about an EV charger, in words a customer can use: a few checks (each fine, a heads-up or a problem), one
// verdict over them (the same one the inverter gets), and a plain-words line for each recent charger event. Pure, so it is tested.

import type { ConnectionStatus } from "./device-state";
import { durationText } from "./data-gaps";
import { stopReasonLabel } from "./ev-sessions";
import type { HealthCheck } from "./maintenance-health";

export interface EvHealthInput {
  /** The charger's own status: online, or "connection_lost" = the unit is online but the charger does not answer it, or offline. */
  connection: ConnectionStatus;
  /** The monitoring unit the charger connects through (null = it connects straight to WayTara, or the link is not known). */
  unit: { label: string | null; status: ConnectionStatus } | null;
  /** Seconds since the charger last checked in (null = never). */
  lastCheckInAgeS: number | null;
  /** The charger's check-in rhythm in seconds, when known. */
  heartbeatS: number | null;
  /** The connector's state in words (Available, Charging, Faulted ...), its enum code, and the error it reports in words (null = none). */
  connector: { label: string | null; code: number | null; error: string | null };
  /** The last charge that ended (null = none yet): how it ended. */
  lastCharge: { status: string; stopReason: string | null } | null;
  /** The firmware the charger told us about when it last started (null = not yet). */
  firmware: string | null;
}

/** The unit's rhythm; a charger behind it is expected to keep step. */
const UNIT_BEAT_S = 10;
/** Connector codes (connector_status enum): 5 = Unavailable, 6 = Faulted. */
const CODE_UNAVAILABLE = 5;
const CODE_FAULTED = 6;
/** Stop reasons that are the charger's or the grid's doing, not the person's. */
const UNEXPECTED_STOPS = new Set(["EmergencyStop", "PowerLoss", "Reboot", "HardReset", "SoftReset", "Other", "MissingStop"]);

const secondsText = (s: number) => durationText(s * 1000);

/** The checks, in the order a customer cares: the unit, the charger's connection, its last check-in, the rhythm, the connector, the last charge, the firmware. */
export function evHealthChecks(i: EvHealthInput): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const unitName = i.unit?.label ? `“${i.unit.label}”` : "the monitoring unit";

  // The unit it connects through
  if (i.unit) {
    if (i.unit.status === "offline") checks.push({ id: "unit", label: "Monitoring unit", state: "bad", detail: `${unitName} is offline, so the charger cannot be reached. Check the unit's power and its internet (SIM or Wi-Fi).` });
    else checks.push({ id: "unit", label: "Monitoring unit", state: "ok", detail: `Connected through ${unitName}, which is online.` });
  }

  // The charger itself
  if (i.connection === "online") checks.push({ id: "connection", label: "Charger connection", state: "ok", detail: "Connected and checking in." });
  else if (i.connection === "connection_lost") checks.push({ id: "connection", label: "Charger connection", state: "bad", detail: `${unitName === "the monitoring unit" ? "The unit" : unitName} is online but the charger is not answering. Check that the charger has power and has joined the unit's Wi-Fi network.` });
  else if (i.unit?.status === "offline") checks.push({ id: "connection", label: "Charger connection", state: "bad", detail: "No news from the charger because its monitoring unit is offline." });
  else checks.push({ id: "connection", label: "Charger connection", state: "bad", detail: "Nothing is arriving from the charger. Check its power and its network." });

  // Its last check-in
  if (i.lastCheckInAgeS === null) checks.push({ id: "checkin", label: "Last check-in", state: "warn", detail: "The charger has not checked in yet." });
  else if (i.lastCheckInAgeS <= 60) checks.push({ id: "checkin", label: "Last check-in", state: "ok", detail: `${secondsText(i.lastCheckInAgeS)} ago.` });
  else if (i.lastCheckInAgeS <= 300) checks.push({ id: "checkin", label: "Last check-in", state: "warn", detail: `${secondsText(i.lastCheckInAgeS)} ago, later than usual.` });
  else checks.push({ id: "checkin", label: "Last check-in", state: "bad", detail: `${secondsText(i.lastCheckInAgeS)} ago.` });

  // The rhythm (only when known)
  if (i.heartbeatS !== null) {
    if (i.heartbeatS <= UNIT_BEAT_S + 5) checks.push({ id: "rhythm", label: "Check-in rhythm", state: "ok", detail: `Every ${i.heartbeatS} s, in step with the monitoring unit.` });
    else checks.push({ id: "rhythm", label: "Check-in rhythm", state: "warn", detail: `Every ${i.heartbeatS} s, slower than the monitoring unit's ${UNIT_BEAT_S} s. A fault is noticed later than it could be.` });
  }

  // The connector
  const { label, code, error } = i.connector;
  if (code === CODE_FAULTED) checks.push({ id: "connector", label: "Connector", state: "bad", detail: `The charger reports a fault${error ? `: ${error}` : ""}. Switch the charger off at its breaker for a minute and on again; if it stays, get support.` });
  else if (code === CODE_UNAVAILABLE) checks.push({ id: "connector", label: "Connector", state: "warn", detail: "The connector is switched off or blocked, so no charge can start." });
  else if (error) checks.push({ id: "connector", label: "Connector", state: "warn", detail: `${label ?? "The connector"} works, but the charger reports: ${error}.` });
  else if (label) checks.push({ id: "connector", label: "Connector", state: "ok", detail: `${label}. No fault reported.` });
  else checks.push({ id: "connector", label: "Connector", state: "ok", detail: "No fault reported." });

  // The last charge that ended
  if (!i.lastCharge) checks.push({ id: "charge", label: "Last charge", state: "ok", detail: "No charge has ended yet." });
  else {
    const why = stopReasonLabel(i.lastCharge.stopReason);
    if (i.lastCharge.status === "suspect") checks.push({ id: "charge", label: "Last charge", state: "warn", detail: "The readings of the last charge looked odd, so it is marked to be checked." });
    else if (i.lastCharge.stopReason && UNEXPECTED_STOPS.has(i.lastCharge.stopReason)) checks.push({ id: "charge", label: "Last charge", state: "warn", detail: `It ended unexpectedly: ${why?.toLowerCase() ?? "unknown reason"}.` });
    else checks.push({ id: "charge", label: "Last charge", state: "ok", detail: why ? `Ended normally (${why.toLowerCase()}).` : "Ended normally." });
  }

  // The firmware
  checks.push({ id: "firmware", label: "Charger firmware", state: "ok", detail: i.firmware ? `Version ${i.firmware}.` : "Not reported yet; it is read when the charger connects." });

  return checks;
}

export type EvEventTone = "good" | "warn" | "bad" | "info";

type Detail = Record<string, unknown> | null;
const str = (d: Detail, k: string): string | null => (d && typeof d[k] === "string" && (d[k] as string) !== "" ? (d[k] as string) : null);
const num = (d: Detail, k: string): number | null => (d && typeof d[k] === "number" && Number.isFinite(d[k] as number) ? (d[k] as number) : null);

/** One recent charger event in words, or null for the ones a customer has no use for (card swipes, raw data transfers). */
export function evEventLine(kind: string, detail: Detail): { text: string; tone: EvEventTone } | null {
  switch (kind) {
    case "connected":
      return { text: "The charger connected.", tone: "good" };
    case "disconnected": {
      const s = num(detail, "seconds");
      return { text: s !== null ? `The charger disconnected after ${secondsText(s)}.` : "The charger disconnected.", tone: "warn" };
    }
    case "boot": {
      const fw = str(detail, "firmware");
      return { text: fw ? `The charger started (firmware ${fw}).` : "The charger started.", tone: "info" };
    }
    case "status": {
      const status = str(detail, "status") ?? "changed";
      const error = str(detail, "error");
      const bad = status === "Faulted";
      const withError = error && error !== "NoError" ? ` (${error})` : "";
      return { text: `Connector ${num(detail, "connector") ?? 1}: ${status}${withError}.`, tone: bad ? "bad" : withError ? "warn" : "info" };
    }
    case "transaction_start": {
      const t = num(detail, "target_kwh");
      return { text: t !== null ? `A charge started (stops at ${t} kWh).` : "A charge started.", tone: "good" };
    }
    case "transaction_stop": {
      const kwh = num(detail, "energy_kwh");
      const why = stopReasonLabel(str(detail, "reason"));
      const bits = [why?.toLowerCase(), kwh !== null ? `${kwh.toFixed(2)} kWh` : null].filter(Boolean).join(", ");
      return { text: `A charge ended${bits ? ` (${bits})` : ""}.`, tone: "info" };
    }
    case "session_suspect":
      return { text: "A charge was marked to be checked: its readings looked odd.", tone: "warn" };
    case "session_closed_without_stop":
    case "stop_without_session":
      return { text: "A charge was closed because the charger did not report its end.", tone: "warn" };
    case "target_reached": {
      const t = num(detail, "target_kwh");
      return { text: t !== null ? `The ${t} kWh target was reached.` : "The kWh target was reached.", tone: "info" };
    }
    case "target_stop_failed":
      return { text: "The charger did not stop at the kWh target. Stop it from the app.", tone: "bad" };
    case "command": {
      const c = str(detail, "command");
      return { text: c ? `A command was sent to the charger: ${c.replace(/-/g, " ")}.` : "A command was sent to the charger.", tone: "info" };
    }
    case "configuration": {
      const key = str(detail, "key");
      const status = str(detail, "status");
      return { text: `A setting${key ? ` (${key})` : ""} was ${status === "Accepted" ? "accepted" : `answered ${status ?? "unknown"}`} by the charger.`, tone: status === "Accepted" ? "info" : "warn" };
    }
    case "firmware_status":
      return { text: `Firmware update: ${str(detail, "status") ?? "status changed"}.`, tone: "info" };
    case "diagnostics_status":
      return { text: `Diagnostics upload: ${str(detail, "status") ?? "status changed"}.`, tone: "info" };
    default:
      return null;
  }
}
