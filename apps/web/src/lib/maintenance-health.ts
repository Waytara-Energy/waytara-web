// What the Maintenance page's Health tab says about a solar inverter, in words a customer can use: a few checks (each fine, a
// heads-up, or a problem) and one verdict over them. The raw alarm words, the sensor registers and the wiring flags are turned into
// this and shown only when something is wrong; the registers themselves stay in the page's collapsed "Technical details". Pure, so
// it is tested.

import type { ConnectionStatus } from "./device-state";
import { getFaultInfo } from "./deye-fault-codes";
import { TEMPERATURE_MAX_C } from "./temperature-thresholds";

export type CheckState = "ok" | "warn" | "bad";

export interface HealthCheck {
  id: string;
  label: string;
  state: CheckState;
  /** One line of detail: what is fine, or what is wrong and what to do. */
  detail: string;
}

export interface HealthInput {
  connection: ConnectionStatus;
  /** The fault code the inverter reports now (null = none). */
  faultCode: number | null;
  /** Any reading by key (the registers named below); null = not reported. */
  value: (key: string) => number | null;
}

/** The registers the checks read; the page keeps them live. */
export const HEALTH_KEYS = [
  "battery_alarm",
  "battery_fault",
  "grid_phase_error",
  "generator_phase_error",
  "clock_out_of_sync",
  "inverter_overheat_warning",
  "battery_temperature_c",
  "inverter_dc_temperature_c",
  "inverter_ac_temperature_c",
];

const TEMP_LABEL: Record<string, string> = {
  battery_temperature_c: "Battery",
  inverter_dc_temperature_c: "Inverter heat-sink (DC)",
  inverter_ac_temperature_c: "Inverter heat-sink (AC)",
};

/** The checks, in the order a customer cares: connection, faults, temperatures, the battery, then wiring and clock. Wiring, clock and
 *  battery rows appear only when something is wrong or has been reported at all, so a healthy system reads as a short list. */
export function buildHealthChecks(input: HealthInput): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const num = input.value;

  // Connection
  if (input.connection === "online") checks.push({ id: "connection", label: "Connection", state: "ok", detail: "Sending readings." });
  else if (input.connection === "connection_lost") checks.push({ id: "connection", label: "Connection", state: "bad", detail: "The monitoring unit is on but cannot reach the inverter. Check that the inverter is switched on." });
  else checks.push({ id: "connection", label: "Connection", state: "bad", detail: "Nothing is arriving from the monitoring unit. Check its power and internet." });

  // Faults
  const fault = input.faultCode ? getFaultInfo(input.faultCode) : null;
  if (fault) checks.push({ id: "fault", label: "Inverter fault", state: fault.severity === "critical" ? "bad" : "warn", detail: `${fault.code} ${fault.label}. ${fault.solution}` });
  else checks.push({ id: "fault", label: "Inverter fault", state: "ok", detail: "No fault reported." });

  // Temperatures against each sensor's safe limit
  const hot: string[] = [];
  const warm: string[] = [];
  for (const key of Object.keys(TEMP_LABEL)) {
    const t = num(key);
    const max = TEMPERATURE_MAX_C[key];
    if (t === null || max === undefined) continue;
    if (t >= max) hot.push(TEMP_LABEL[key]);
    else if (t >= max * 0.85) warm.push(TEMP_LABEL[key]);
  }
  const overheat = num("inverter_overheat_warning");
  if (hot.length > 0 || overheat) checks.push({ id: "temperature", label: "Temperature", state: "bad", detail: `${hot.length > 0 ? hot.join(", ") : "The inverter"} is above the safe limit. Keep the vents clear and call your advisor if it stays hot.` });
  else if (warm.length > 0) checks.push({ id: "temperature", label: "Temperature", state: "warn", detail: `${warm.join(", ")} is running warm, close to its limit.` });
  else checks.push({ id: "temperature", label: "Temperature", state: "ok", detail: "All sensors are within their safe range." });

  // Battery alarm or fault
  const batteryFault = num("battery_fault");
  const batteryAlarm = num("battery_alarm");
  if (batteryFault) checks.push({ id: "battery", label: "Battery", state: "bad", detail: "The battery reports a fault. Call your advisor." });
  else if (batteryAlarm) checks.push({ id: "battery", label: "Battery", state: "warn", detail: "The battery reports an alarm. If it keeps showing, call your advisor." });
  else if (batteryFault !== null || batteryAlarm !== null) checks.push({ id: "battery", label: "Battery", state: "ok", detail: "No battery alarm or fault." });

  // Wiring and clock: only when wrong
  if (num("grid_phase_error")) checks.push({ id: "grid-phase", label: "Grid wiring", state: "bad", detail: "The grid phase looks wrong. Ask an electrician or your advisor to check the connection." });
  if (num("generator_phase_error")) checks.push({ id: "generator-phase", label: "Generator wiring", state: "bad", detail: "The generator phase looks wrong. Ask an electrician or your advisor to check the connection." });
  if (num("clock_out_of_sync")) checks.push({ id: "clock", label: "Inverter clock", state: "warn", detail: "The inverter's clock is more than 2 minutes off. Your advisor can reset it." });

  return checks;
}

/** The text a customer's report starts with for a fault the page has shown them. It carries the code, so a second report is not offered. */
export function faultReportText(code: string, label: string, what: string): string {
  return `Fault ${code} ${label} is showing on my inverter. ${what} I have tried the steps in the troubleshooting guide.`;
}

/** The text for a check that is not fine (connection, temperature, battery...). It starts with a tag so the same report is not offered twice. */
export const checkReportTag = (label: string) => `Health check: ${label}.`;
export function checkReportText(label: string, detail: string): string {
  return `${checkReportTag(label)} ${detail}`;
}

/** Has this already been reported and is still open? `openIssues` are the descriptions of the customer's open requests. */
export const alreadyReported = (openIssues: readonly string[], tag: string): boolean => openIssues.some((d) => d.includes(tag));

export type Verdict = "good" | "attention" | "offline";

/** One word for the whole system: offline when it is not reporting, attention when anything is not fine, otherwise good. */
export function verdictOf(connection: ConnectionStatus, checks: HealthCheck[]): Verdict {
  if (connection !== "online") return "offline";
  return checks.some((c) => c.state !== "ok") ? "attention" : "good";
}

export const VERDICT_LABEL: Record<Verdict, string> = { good: "All good", attention: "Needs attention", offline: "Not reporting" };

/** How many checks are not fine. */
export const problemCount = (checks: HealthCheck[]) => checks.filter((c) => c.state !== "ok").length;
