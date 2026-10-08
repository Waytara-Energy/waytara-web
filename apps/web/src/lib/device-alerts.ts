// What counts as an alert-worthy event for a device, and the wording of the alert and of the e-mail the customer gets.
// Pure logic (no database, no network), so the cron route stays thin and this can be tested.

import { getFaultInfo } from "./deye-fault-codes";

export type AlertKind = "offline" | "fault" | "alarm";

/** Alert messages start with these, which is how the cron finds the alert it opened earlier. */
export const ALERT_PREFIX: Record<AlertKind, string> = {
  offline: "Device offline",
  fault: "Device fault",
  alarm: "Device alarm",
};

export const FAULT_KEY_PREFIX = "fault_message_";
export const ALARM_KEY_PREFIX = "alarm_status_";
export const FAULT_ALARM_KEYS = ["fault_message_1", "fault_message_2", "fault_message_3", "fault_message_4", "alarm_status_1", "alarm_status_2"];

/** A device with no heartbeat (it has never been read by the agent) is only judged by its newest reading, this slowly. */
export const LEGACY_OFFLINE_HOURS = 6;
const MIN_SILENT_MS = 10 * 60_000;

export interface HeartbeatRow {
  last_seen: string | null;
  upload_interval_s: number | null;
  /** How often the agent checks in between uploads (null for an older agent). */
  heartbeat_s?: number | null;
  device_online: boolean | null;
  last_read_at: string | null;
  /** The agent's own words for why the device does not answer (null while it does, or for older agents). */
  device_error?: string | null;
}

export type OfflineReason = "device" | "agent" | "silent" | "never";

export interface OfflineStatus {
  /** The device's agent has reported at least once: its state is known, so alerts about it are e-mailed. */
  monitored: boolean;
  offline: boolean;
  reason: OfflineReason | null;
  /** When the device last really answered (epoch ms). */
  lastReadMs: number | null;
  /** Why the agent says the device is silent, when it said. */
  deviceError: string | null;
}

/** How long the agent may stay quiet before it counts as gone: three of its check-in intervals (its upload interval for an
 *  agent that does not check in between), at least ten minutes. */
export function agentSilentAfterMs(uploadIntervalS: number | null, heartbeatS: number | null = null): number {
  return Math.max(MIN_SILENT_MS, 3 * (heartbeatS ?? uploadIntervalS ?? 60) * 1000);
}

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : null);

/** Is the device offline? With an agent heartbeat: the agent's own word that the device does not answer, or the agent
 *  itself gone quiet. Without one: the old, slow rule on the newest stored reading. */
export function offlineStatus(beat: HeartbeatRow | null, latestTs: string | null, nowMs: number): OfflineStatus {
  const latestMs = ms(latestTs);
  if (!beat) {
    const offline = latestMs === null || nowMs - latestMs > LEGACY_OFFLINE_HOURS * 3_600_000;
    return { monitored: false, offline, reason: offline ? (latestMs === null ? "never" : "silent") : null, lastReadMs: latestMs, deviceError: null };
  }
  const silentAfter = agentSilentAfterMs(beat.upload_interval_s, beat.heartbeat_s ?? null);
  const lastRead = ms(beat.last_read_at) ?? latestMs;
  const lastSeen = ms(beat.last_seen);
  if (beat.device_online === false) return { monitored: true, offline: true, reason: "device", lastReadMs: lastRead, deviceError: beat.device_error ?? null };
  if (lastSeen === null || nowMs - lastSeen > silentAfter) return { monitored: true, offline: true, reason: "agent", lastReadMs: lastRead, deviceError: null };
  if (beat.device_online === null && (lastRead === null || nowMs - lastRead > silentAfter)) {
    return { monitored: true, offline: true, reason: "silent", lastReadMs: lastRead, deviceError: null };
  }
  return { monitored: true, offline: false, reason: null, lastReadMs: lastRead, deviceError: null };
}

/** "7 Oct, 3:45 pm" in Indian time. */
export function fmtIst(epochMs: number): string {
  return new Date(epochMs).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

/** What a device-side error from the agent means for the customer: the adapter can't be reached at all (no power / not on
 *  the network), or it answers but the inverter behind it does not. */
export function deviceErrorHint(error: string | null): string {
  const e = (error ?? "").toLowerCase();
  if (/tcp|connect|refused|unreachable|no route|network|host/.test(e)) {
    return "its network adapter cannot be reached - check that the inverter and its adapter are powered on and on the network.";
  }
  if (/time.?out|no (usable )?(reply|response)|not respond/.test(e)) {
    return "the adapter answers but the inverter does not reply - check that the inverter is switched on and not asleep.";
  }
  return "its data agent is running but cannot read the device - check that it is switched on.";
}

export function offlineMessage(label: string, st: OfflineStatus): string {
  const last = st.lastReadMs !== null ? ` Last reading: ${fmtIst(st.lastReadMs)}.` : "";
  switch (st.reason) {
    case "device":
      return `${ALERT_PREFIX.offline}: ${label} is not responding - ${deviceErrorHint(st.deviceError)}${last}`;
    case "agent":
      return `${ALERT_PREFIX.offline}: ${label} has stopped reporting - nothing has arrived from its monitoring unit recently (it may have lost power or its internet connection).${last}`;
    case "never":
      return `${ALERT_PREFIX.offline}: ${label} has never reported a reading.`;
    default:
      return `${ALERT_PREFIX.offline}: ${label} hasn't reported in over ${LEGACY_OFFLINE_HOURS} hours.${last}`;
  }
}

/** An unresolved, unacknowledged critical alert is e-mailed again this often. */
export const REMINDER_EVERY_MS = 3 * 3_600_000;
// The alert job runs every 5 minutes, so a reminder is due slightly early rather than a whole run late.
const REMINDER_SLACK_MS = 4 * 60_000;

/** Only the alerts that need action (critical) are repeated; warnings are e-mailed once. */
export function needsReminder(severity: string): boolean {
  return severity === "critical";
}

/** Is the next reminder due? `lastNotified` is when the customer was last e-mailed about this alert (null = never). */
export function reminderDue(lastNotified: string | null, nowMs: number): boolean {
  if (lastNotified === null) return true;
  return nowMs - new Date(lastNotified).getTime() >= REMINDER_EVERY_MS - REMINDER_SLACK_MS;
}

export interface RaisedAlert {
  kind: "fault" | "alarm";
  severity: "critical" | "warning";
  message: string;
  /** The register value behind it (a fault code, or an alarm bitmask). */
  code: number;
}

/** The fault and the alarm a device is reporting right now (each at most one alert): the first non-zero register of
 *  its kind. `values` are the newest readings of the fault / alarm registers. */
export function raisedAlerts(label: string, values: Record<string, number | null | undefined>): RaisedAlert[] {
  const out: RaisedAlert[] = [];
  const firstNonZero = (prefix: string) => {
    for (const key of FAULT_ALARM_KEYS.filter((k) => k.startsWith(prefix))) {
      const v = values[key];
      if (typeof v === "number" && v !== 0) return v;
    }
    return null;
  };
  const fault = firstNonZero(FAULT_KEY_PREFIX);
  if (fault !== null) {
    const info = getFaultInfo(fault);
    out.push({
      kind: "fault",
      severity: info?.severity === "warning" ? "warning" : "critical",
      code: fault,
      message: `${ALERT_PREFIX.fault}: ${label} - ${info?.code ?? `F${fault}`} ${info?.label ?? "fault"}. ${info?.solution ?? "Contact WayTara support."}`,
    });
  }
  const alarm = firstNonZero(ALARM_KEY_PREFIX);
  if (alarm !== null) {
    out.push({
      kind: "alarm",
      severity: "warning",
      code: alarm,
      message: `${ALERT_PREFIX.alarm}: ${label} is reporting an alarm (status ${alarm}). Contact WayTara support if it keeps coming back.`,
    });
  }
  return out;
}

export interface AlertEmailInput {
  kind: AlertKind;
  /** "opened" when the problem starts, "reminder" while it is still open and unacknowledged, "resolved" when it clears. */
  event: "opened" | "reminder" | "resolved";
  /** For a reminder: when the alert was raised (epoch ms) and how many e-mails about it have gone out already. */
  since?: number;
  sentBefore?: number;
  customerName: string | null;
  deviceLabel: string;
  siteName: string | null;
  /** The alert's own message (shown as the detail for an opened alert). */
  message: string;
  dashboardUrl: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildAlertEmail(input: AlertEmailInput): { subject: string; text: string; html: string } {
  const { kind, event, deviceLabel } = input;
  const reminder = event === "reminder";
  const opened = event === "opened" || reminder;
  const baseSubject = opened
    ? kind === "offline"
      ? `${deviceLabel} is offline`
      : kind === "fault"
        ? `Fault reported by ${deviceLabel}`
        : `Alarm reported by ${deviceLabel}`
    : kind === "offline"
      ? `${deviceLabel} is back online`
      : kind === "fault"
        ? `Fault on ${deviceLabel} has cleared`
        : `Alarm on ${deviceLabel} has cleared`;
  const subject = reminder ? `Reminder: ${baseSubject}` : baseSubject;
  const lead = opened
    ? (reminder ? "This still needs your attention. " : "") +
      (kind === "offline"
        ? "We can no longer reach your device."
        : kind === "fault"
          ? "Your device has reported a fault."
          : "Your device has reported an alarm.")
    : kind === "offline"
      ? "Good news: your device is reporting again."
      : "The condition we told you about has cleared.";
  const where = input.siteName ? ` (${input.siteName})` : "";
  const detail = opened ? input.message : "";
  const since = reminder && input.since ? `Open since ${fmtIst(input.since)}${input.sentBefore ? ` - we have e-mailed you ${input.sentBefore} time${input.sentBefore === 1 ? "" : "s"} about it` : ""}.` : "";
  const stop = reminder ? "Open the dashboard and press Acknowledge on the alert to stop these reminders (they also stop once it clears)." : "";
  const greeting = `Hi ${input.customerName ?? "there"},`;
  const text = [
    greeting,
    "",
    `${lead} ${deviceLabel}${where}`,
    detail ? "" : null,
    detail || null,
    since ? "" : null,
    since || null,
    stop || null,
    "",
    `Open your dashboard: ${input.dashboardUrl}`,
    "",
    "You get these e-mails because alert e-mails are on for your account (Settings > Application Settings).",
    "- The WayTara Team",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:560px">
<p>${esc(greeting)}</p>
<p><strong>${esc(lead)}</strong><br>${esc(deviceLabel)}${esc(where)}</p>
${detail ? `<p style="background:#f1f5f9;border-radius:8px;padding:10px 12px">${esc(detail)}</p>` : ""}
${since ? `<p style="color:#475569;font-size:13px">${esc(since)}<br>${esc(stop)}</p>` : ""}
<p><a href="${esc(input.dashboardUrl)}" style="background:#16a34a;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none">Open your dashboard</a></p>
<p style="color:#64748b;font-size:12px">You get these e-mails because alert e-mails are on for your account (Settings &gt; Application Settings).<br>- The WayTara Team</p>
</div>`;
  return { subject, text, html };
}
