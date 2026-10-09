import { describe, expect, it } from "vitest";
import {
  agentSilentAfterMs,
  buildAlertEmail,
  deviceErrorHint,
  needsReminder,
  offlineMessage,
  offlineStatus,
  raisedAlerts,
  reminderDue,
  REMINDER_EVERY_MS,
  type HeartbeatRow,
} from "./device-alerts";

const NOW = Date.parse("2026-10-07T10:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const beat = (over: Partial<HeartbeatRow> = {}): HeartbeatRow => ({ last_seen: ago(1), upload_interval_s: 900, device_online: true, last_read_at: ago(1), ...over });

describe("offlineStatus", () => {
  it("an agent that says the device does not answer is offline at once, however fresh the heartbeat", () => {
    const s = offlineStatus(beat({ device_online: false, last_read_at: ago(30) }), null, NOW);
    expect(s).toMatchObject({ monitored: true, offline: true, reason: "device" });
    expect(s.lastReadMs).toBe(NOW - 30 * 60_000);
  });

  it("an agent that has gone quiet (three upload intervals, at least ten minutes) is offline", () => {
    expect(agentSilentAfterMs(900)).toBe(45 * 60_000);
    expect(agentSilentAfterMs(5)).toBe(10 * 60_000);
    expect(offlineStatus(beat({ last_seen: ago(44) }), null, NOW).offline).toBe(false);
    expect(offlineStatus(beat({ last_seen: ago(50) }), null, NOW)).toMatchObject({ offline: true, reason: "agent" });
  });

  it("a healthy device is online", () => {
    expect(offlineStatus(beat(), null, NOW)).toMatchObject({ monitored: true, offline: false, reason: null });
  });

  it("an agent that does not report connectivity is judged by its last reading", () => {
    expect(offlineStatus(beat({ device_online: null, last_read_at: null }), ago(120), NOW)).toMatchObject({ offline: true, reason: "silent" });
    expect(offlineStatus(beat({ device_online: null, last_read_at: null }), ago(5), NOW).offline).toBe(false);
  });

  it("a device with no heartbeat is only judged slowly and is not monitored (no e-mail)", () => {
    expect(offlineStatus(null, ago(60), NOW)).toMatchObject({ monitored: false, offline: false });
    expect(offlineStatus(null, ago(7 * 60), NOW)).toMatchObject({ monitored: false, offline: true, reason: "silent" });
    expect(offlineStatus(null, null, NOW)).toMatchObject({ monitored: false, offline: true, reason: "never" });
  });
});

describe("messages", () => {
  it("always start with the prefix the cron looks for", () => {
    for (const reason of ["device", "agent", "silent", "never"] as const) {
      expect(offlineMessage("Deye 8 kW", { monitored: true, offline: true, reason, lastReadMs: NOW, deviceError: null })).toMatch(/^Device offline: Deye 8 kW/);
    }
  });

  it("names the last reading in Indian time", () => {
    const m = offlineMessage("Deye 8 kW", { monitored: true, offline: true, reason: "device", lastReadMs: Date.parse("2026-10-07T10:15:00Z"), deviceError: null });
    expect(m).toContain("7 Oct");
    expect(m).toMatch(/3:45 pm/i);
  });
});

describe("raisedAlerts", () => {
  it("nothing when every register is zero or missing", () => {
    expect(raisedAlerts("Deye", { fault_message_1: 0, alarm_status_1: 0, fault_message_2: null })).toEqual([]);
  });

  it("a fault becomes a fault alert with the decoded text, an alarm a separate alarm alert", () => {
    const a = raisedAlerts("Deye", { fault_message_1: 0, fault_message_2: 63, alarm_status_1: 4 });
    expect(a.map((x) => x.kind)).toEqual(["fault", "alarm"]);
    expect(a[0]).toMatchObject({ severity: "critical", code: 63 });
    expect(a[0].message).toMatch(/^Device fault: Deye - F63 Arc fault \(US only\)/);
    expect(a[1]).toMatchObject({ severity: "warning", code: 4 });
    expect(a[1].message).toMatch(/^Device alarm: Deye/);
  });

  it("an unknown fault code still raises an alert", () => {
    expect(raisedAlerts("Deye", { fault_message_3: 9999 })[0].message).toContain("F9999");
  });
});

describe("buildAlertEmail", () => {
  const base = { customerName: "Asha", deviceLabel: "Deye 8 kW", siteName: "Waytara Office", message: "Device offline: Deye 8 kW is not responding.", dashboardUrl: "https://www.waytaraenergy.com/dashboard" };

  it("tells the customer what happened and links to the dashboard", () => {
    const e = buildAlertEmail({ ...base, kind: "offline", event: "opened" });
    expect(e.subject).toBe("Deye 8 kW is offline");
    expect(e.text).toContain("Hi Asha,");
    expect(e.text).toContain("Waytara Office");
    expect(e.text).toContain(base.message);
    expect(e.text).toContain(base.dashboardUrl);
    expect(e.html).toContain(base.dashboardUrl);
  });

  it("has a recovery wording for each kind", () => {
    expect(buildAlertEmail({ ...base, kind: "offline", event: "resolved" }).subject).toBe("Deye 8 kW is back online");
    expect(buildAlertEmail({ ...base, kind: "fault", event: "resolved" }).subject).toBe("Fault on Deye 8 kW has cleared");
    expect(buildAlertEmail({ ...base, kind: "alarm", event: "opened" }).subject).toBe("Alarm reported by Deye 8 kW");
    expect(buildAlertEmail({ ...base, kind: "offline", event: "resolved" }).text).not.toContain(base.message);
  });

  it("escapes what it puts in the HTML", () => {
    const e = buildAlertEmail({ ...base, kind: "fault", event: "opened", message: "<script>alert(1)</script>", customerName: null });
    expect(e.html).not.toContain("<script>");
    expect(e.text).toContain("Hi there,");
  });
});

describe("why the device is silent", () => {
  it("tells an unreachable adapter from a silent inverter", () => {
    expect(deviceErrorHint("could not open a TCP connection to 192.168.29.200:502")).toMatch(/network adapter cannot be reached/);
    expect(deviceErrorHint("timeout")).toMatch(/adapter answers but the inverter does not reply/);
    expect(deviceErrorHint(null)).toMatch(/cannot read the device/);
  });

  it("goes into the alert text, and the agent's reason is carried by the status", () => {
    const st = offlineStatus(beat({ device_online: false, device_error: "could not open a TCP connection to 10.0.0.2:502" }), null, NOW);
    expect(st.deviceError).toContain("TCP connection");
    expect(offlineMessage("Deye", st)).toMatch(/network adapter cannot be reached/);
  });

  it("a silent agent is described as a monitoring unit that lost power or internet", () => {
    const st = offlineStatus(beat({ last_seen: ago(120) }), null, NOW);
    expect(offlineMessage("Deye", st)).toMatch(/monitoring unit/);
  });
});

describe("reminders", () => {
  it("are due 3 hours after the last e-mail (a little early rather than a whole run late), or at once if never sent", () => {
    expect(REMINDER_EVERY_MS).toBe(3 * 3_600_000);
    expect(reminderDue(null, NOW)).toBe(true);
    expect(reminderDue(ago(120), NOW)).toBe(false);
    expect(reminderDue(ago(175), NOW)).toBe(false);
    expect(reminderDue(ago(177), NOW)).toBe(true);
    expect(reminderDue(ago(300), NOW)).toBe(true);
  });

  it("only critical alerts are repeated", () => {
    expect(needsReminder("critical")).toBe(true);
    expect(needsReminder("warning")).toBe(false);
    expect(needsReminder("info")).toBe(false);
  });

  it("the reminder e-mail says it is a reminder, since when, and how to stop it", () => {
    const e = buildAlertEmail({
      kind: "offline",
      event: "reminder",
      customerName: "Asha",
      deviceLabel: "Deye 8 kW",
      siteName: null,
      message: "Device offline: Deye 8 kW is not responding.",
      dashboardUrl: "https://www.waytaraenergy.com/dashboard",
      since: NOW - 4 * 3_600_000,
      sentBefore: 2,
    });
    expect(e.subject).toBe("Reminder: Deye 8 kW is offline");
    expect(e.text).toContain("still needs your attention");
    expect(e.text).toContain("Open since");
    expect(e.text).toContain("2 times");
    expect(e.text).toContain("Acknowledge");
    expect(e.html).toContain("Acknowledge");
    expect(e.text).toContain("Device offline: Deye 8 kW is not responding.");
  });
});
