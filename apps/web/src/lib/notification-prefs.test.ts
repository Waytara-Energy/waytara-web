import { describe, expect, it } from "vitest";
import { NOTIFICATION_KEYS, alertKey, digestKey, mergeNotificationPrefs, resolveNotificationPrefs, wants } from "./notification-prefs";

describe("wants", () => {
  it("takes the default when nothing was chosen: security sign-ins on, sign-outs off, the rest on", () => {
    expect(wants(null, "auth_signin")).toBe(true);
    expect(wants({}, "auth_signout")).toBe(false);
    expect(wants({}, "faults")).toBe(true);
    expect(wants(undefined, "support_emails")).toBe(true);
  });
  it("uses the person's own choice over everything else", () => {
    expect(wants({ faults: false }, "faults")).toBe(false);
    expect(wants({ email_alerts: false, faults: true }, "faults")).toBe(true);
    expect(wants({ auth_signout: true }, "auth_signout")).toBe(true);
  });
  it("lets the old alert switch, when it was off, silence the alert e-mails but not the others", () => {
    const old = { email_alerts: false };
    for (const k of ["network_lost", "device_offline", "device_online", "faults", "alarms", "tariff"] as const) expect(wants(old, k), k).toBe(false);
    expect(wants(old, "auth_signin")).toBe(true);
    expect(wants(old, "support_emails")).toBe(true);
  });
  it("ignores a value that is not a true or false", () => {
    expect(wants({ faults: "no" }, "faults")).toBe(true);
    expect(wants("x", "faults")).toBe(true);
  });
});

describe("resolveNotificationPrefs / mergeNotificationPrefs", () => {
  it("resolves every known key", () => {
    expect(Object.keys(resolveNotificationPrefs({})).sort()).toEqual([...NOTIFICATION_KEYS].sort());
  });
  it("keeps other keys, replaces known ones and keeps email_alerts in step", () => {
    const all = resolveNotificationPrefs({});
    const merged = mergeNotificationPrefs({ email_maintenance_updates: false, keep: 1 }, { ...all, faults: false, alarms: false, network_lost: false, device_offline: false, device_online: false, tariff: false });
    expect(merged.keep).toBe(1);
    expect(merged.email_maintenance_updates).toBe(false);
    expect(merged.faults).toBe(false);
    expect(merged.email_alerts).toBe(false);
    expect(mergeNotificationPrefs({}, { ...all, faults: false }).email_alerts).toBe(true);
    expect(wants(merged, "support_emails")).toBe(true);
  });
});

describe("which switch an e-mail belongs to", () => {
  it("maps the alert cron's e-mails", () => {
    expect(alertKey("offline", "opened")).toBe("network_lost");
    expect(alertKey("offline", "reminder")).toBe("network_lost");
    expect(alertKey("offline", "resolved")).toBe("device_online");
    expect(alertKey("fault", "resolved")).toBe("faults");
    expect(alertKey("alarm", "opened")).toBe("alarms");
  });
  it("maps the device digest's lines", () => {
    expect(digestKey("offline")).toBe("network_lost");
    expect(digestKey("still_offline", "offline")).toBe("network_lost");
    expect(digestKey("offline", "device_unreachable")).toBe("device_offline");
    expect(digestKey("still_offline", "device_unreachable")).toBe("device_offline");
    expect(digestKey("back_online")).toBe("device_online");
  });
});
