import { describe, expect, it } from "vitest";
import { alertTitleAndBody, applyFilter, faultCodeOf, faultItems, filterCounts, unreadTotal, type AlertLike } from "./notification-items";

const alert = (over: Partial<AlertLike> = {}): AlertLike => ({ id: "a", device_id: "d1", severity: "warning", message: "m", ts: "2026-10-08T10:00:00Z", acknowledged_at: null, ...over });

describe("faultCodeOf", () => {
  it("is the first non-zero fault or alarm register, null when all are clear", () => {
    expect(faultCodeOf({ fault_message_1: 0, fault_message_2: 13, alarm_status_1: 4 })).toBe(13);
    expect(faultCodeOf({ fault_message_1: 0, fault_message_2: null })).toBeNull();
    expect(faultCodeOf({})).toBeNull();
  });
});

describe("faultItems", () => {
  it("lists the devices that have a fault, the critical ones first", () => {
    const items = faultItems({ d1: 13, d2: null, d3: 63 });
    expect(items.map((i) => i.deviceId)).toContain("d1");
    expect(items.map((i) => i.deviceId)).not.toContain("d2");
    expect(items).toHaveLength(2);
    const critical = items.filter((i) => i.info.severity === "critical");
    if (critical.length > 0) expect(items[0].info.severity).toBe("critical");
  });
});

describe("the filter chips", () => {
  const faults = faultItems({ d1: 13 });
  const alerts = [alert({ id: "1", severity: "critical" }), alert({ id: "2", severity: "warning", acknowledged_at: "2026-10-08T11:00:00Z" }), alert({ id: "3", severity: "warning" })];

  it("All shows everything; Faults only the faults; Alerts only the alerts", () => {
    expect(applyFilter(faults, alerts, "all")).toEqual({ faults, alerts });
    expect(applyFilter(faults, alerts, "faults")).toEqual({ faults, alerts: [] });
    expect(applyFilter(faults, alerts, "alerts")).toEqual({ faults: [], alerts });
  });

  it("Unread keeps active faults and the alerts not marked as read", () => {
    const r = applyFilter(faults, alerts, "unread");
    expect(r.faults).toHaveLength(1);
    expect(r.alerts.map((a) => a.id)).toEqual(["1", "3"]);
  });

  it("Critical and Warning narrow faults and alerts by severity", () => {
    expect(applyFilter(faults, alerts, "critical").alerts.map((a) => a.id)).toEqual(["1"]);
    expect(applyFilter(faults, alerts, "warning").alerts.map((a) => a.id)).toEqual(["2", "3"]);
    const totals = filterCounts(faults, alerts);
    expect(totals.critical + totals.warning).toBe(totals.all);
  });

  it("counts what each chip would show, and the bell's number", () => {
    expect(filterCounts(faults, alerts)).toMatchObject({ all: 4, faults: 1, alerts: 3, unread: 3 });
    expect(unreadTotal(faults, alerts)).toBe(3);
    expect(unreadTotal([], [])).toBe(0);
  });
});

describe("alertTitleAndBody", () => {
  it("splits a message at its short heading", () => {
    expect(alertTitleAndBody("Device offline: Deye 8kW has stopped reporting.", "critical")).toEqual({ title: "Device offline", body: "Deye 8kW has stopped reporting." });
  });
  it("falls back to the severity when there is no short heading", () => {
    expect(alertTitleAndBody("Battery is getting hot", "warning")).toEqual({ title: "Warning", body: "Battery is getting hot" });
    expect(alertTitleAndBody("A very long first sentence that goes on and on and on before any colon: then more", "critical").title).toBe("Critical");
  });
});
