import { describe, expect, it } from "vitest";
import { MAX_ITEMS_PER_EMAIL, MIN_GAP_MS, buildHubEmail, buildStatusDigest, fmtDuration, itemOf, planBatch, type OutboxRow } from "./device-status-mail";

const NOW = Date.UTC(2026, 9, 21, 8, 0, 0);
const row = (id: number, over: Partial<OutboxRow> = {}): OutboxRow => ({
  id,
  audience: "customer",
  kind: "offline",
  customer_id: "c1",
  device_id: `d${id}`,
  alert_id: `a${id}`,
  payload: { device_label: `Inverter ${id}`, site_name: "Home", message: `Device offline: Inverter ${id} has stopped reporting.`, since: new Date(NOW - 5 * 60_000).toISOString() },
  created_at: new Date(NOW).toISOString(),
  attempts: 0,
  ...over,
});

describe("one e-mail at a time", () => {
  it("puts every due row of one customer into one e-mail", () => {
    const plan = planBatch([row(1), row(2), row(3)], new Map(), NOW);
    expect([...plan.customers.keys()]).toEqual(["c1"]);
    expect(plan.customers.get("c1")!.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(plan.waiting).toEqual([]);
  });

  it("makes one e-mail per customer", () => {
    const plan = planBatch([row(1), row(2, { customer_id: "c2" })], new Map(), NOW);
    expect([...plan.customers.keys()].sort()).toEqual(["c1", "c2"]);
  });

  it("keeps a customer's rows waiting for 10 minutes after their last e-mail, then lets them through", () => {
    const recent = new Map([["c1", new Date(NOW - (MIN_GAP_MS - 1000)).toISOString()]]);
    expect(planBatch([row(1)], recent, NOW).waiting.map((r) => r.id)).toEqual([1]);
    const old = new Map([["c1", new Date(NOW - MIN_GAP_MS).toISOString()]]);
    expect(planBatch([row(1)], old, NOW).customers.get("c1")).toHaveLength(1);
  });

  it("does not hold another customer back, and never holds admin messages back", () => {
    const recent = new Map([["c1", new Date(NOW - 60_000).toISOString()]]);
    const plan = planBatch([row(1), row(2, { customer_id: "c2" }), row(3, { audience: "admin", customer_id: null, kind: "hub_down" })], recent, NOW);
    expect([...plan.customers.keys()]).toEqual(["c2"]);
    expect(plan.admin.map((r) => r.id)).toEqual([3]);
    expect(plan.waiting.map((r) => r.id)).toEqual([1]);
  });

  it("caps one e-mail and leaves the rest for the next", () => {
    const rows = Array.from({ length: MAX_ITEMS_PER_EMAIL + 3 }, (_, i) => row(i + 1));
    const plan = planBatch(rows, new Map(), NOW);
    expect(plan.customers.get("c1")).toHaveLength(MAX_ITEMS_PER_EMAIL);
    expect(plan.waiting).toHaveLength(3);
  });
});

describe("how long it was down", () => {
  it("reads naturally", () => {
    expect(fmtDuration(20)).toBe("under a minute");
    expect(fmtDuration(60)).toBe("1 minute");
    expect(fmtDuration(7 * 60)).toBe("7 minutes");
    expect(fmtDuration(3600)).toBe("1 hour");
    expect(fmtDuration(3600 + 5 * 60)).toBe("1 hour 5 minutes");
    expect(fmtDuration(2 * 86_400 + 3 * 3600)).toBe("2 days 3 hours");
    expect(fmtDuration(-5)).toBe("under a minute");
  });
});

describe("the digest", () => {
  const dash = "https://example.test/dashboard";
  const items = (rows: OutboxRow[]) => rows.map(itemOf).filter((i) => i !== null);

  it("names the device in the subject when there is one", () => {
    const m = buildStatusDigest({ customerName: "Asha", items: items([row(1)]), dashboardUrl: dash });
    expect(m.subject).toBe("Inverter 1 is offline");
    expect(m.text).toContain("Hi Asha,");
    expect(m.text).toContain("Offline since");
    expect(m.html).toContain(dash);
  });

  it("counts the devices when several went offline together, in one e-mail", () => {
    const m = buildStatusDigest({ customerName: null, items: items([row(1), row(2), row(3)]), dashboardUrl: dash });
    expect(m.subject).toBe("3 of your devices are offline");
    expect(m.text).toContain("Hi there,");
    for (const n of [1, 2, 3]) expect(m.text).toContain(`Inverter ${n}`);
  });

  it("mixes sections when events of different kinds are due together", () => {
    const back = row(4, { kind: "back_online", payload: { device_label: "Inverter 4", site_name: "Home", back_at: new Date(NOW).toISOString(), down_for_s: 3900 } });
    const still = row(5, { kind: "still_offline", payload: { device_label: "Inverter 5", site_name: "Home", message: "Device offline: Inverter 5 has stopped reporting.", since: new Date(NOW - 3 * 3600_000).toISOString(), offline_for_s: 3 * 3600 } });
    const m = buildStatusDigest({ customerName: "Asha", items: items([back, still]), dashboardUrl: dash });
    expect(m.subject).toBe("Updates about your devices");
    expect(m.text).toMatch(/Still offline:[\s\S]*Inverter 5[\s\S]*Back online:[\s\S]*Inverter 4 \(Home\) is reporting again; it was down for 1 hour 5 minutes/);
    expect(m.text).toContain("Acknowledge");
  });

  it("says how long a single device was down when it is back", () => {
    const back = row(4, { kind: "back_online", payload: { device_label: "Inverter 4", back_at: new Date(NOW).toISOString(), down_for_s: 600 } });
    const m = buildStatusDigest({ customerName: "Asha", items: items([back]), dashboardUrl: dash });
    expect(m.subject).toBe("Inverter 4 is back online");
    expect(m.text).toContain("it was down for 10 minutes");
  });

  it("escapes what it puts into the HTML", () => {
    const bad = row(6, { payload: { device_label: "<b>x</b>", message: "a < b & \"c\"" } });
    const m = buildStatusDigest({ customerName: "<i>n</i>", items: items([bad]), dashboardUrl: dash });
    expect(m.html).not.toContain("<b>x</b>");
    expect(m.html).not.toContain("<i>n</i>");
    expect(m.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("ignores a row of another kind and reads a broken payload without failing", () => {
    expect(itemOf(row(7, { kind: "hub_down" }))).toBeNull();
    expect(itemOf(row(8, { payload: {} }))).toMatchObject({ deviceLabel: "Your device", message: null, sinceMs: null, seconds: null });
  });
});

describe("the hub's e-mail to admins", () => {
  it("says it is down, and that customers are not e-mailed meanwhile", () => {
    const m = buildHubEmail([row(1, { audience: "admin", customer_id: null, kind: "hub_down", payload: { since: new Date(NOW - 180_000).toISOString() } })], "https://example.test");
    expect(m.subject).toBe("The WayTara hub is not answering");
    expect(m.text).toContain("NOT e-mailed");
  });
  it("says it is back and for how long it was down", () => {
    const m = buildHubEmail([row(2, { audience: "admin", customer_id: null, kind: "hub_back", payload: { down_for_s: 420 } })], "https://example.test");
    expect(m.subject).toBe("The WayTara hub is back");
    expect(m.text).toContain("after 7 minutes");
  });
});

describe("the cause is told in the e-mail", () => {
  const dash = "https://example.test/dashboard";
  const items = (rows: OutboxRow[]) => rows.map(itemOf).filter((i) => i !== null);
  const silentInverter = (id: number) =>
    row(id, { payload: { device_label: `Inverter ${id}`, site_name: "Home", status: "device_unreachable", message: `Device offline: Inverter ${id} is not responding - its monitoring unit is online but the inverter does not answer it.`, since: new Date(NOW - 5 * 60_000).toISOString() } });
  const silentUnit = (id: number) => row(id, { payload: { device_label: `Inverter ${id}`, site_name: "Home", status: "offline", message: `Device offline: Inverter ${id} has stopped reporting.`, since: new Date(NOW - 5 * 60_000).toISOString() } });
  const back = (id: number, extra: Record<string, unknown>) => row(id, { kind: "back_online", payload: { device_label: `Inverter ${id}`, site_name: "Home", back_at: new Date(NOW).toISOString(), down_for_s: 240, ...extra } });

  it("says the inverter is not answering when the unit is online but cannot read it", () => {
    const m = buildStatusDigest({ customerName: "Asha", items: items([silentInverter(1)]), dashboardUrl: dash });
    expect(m.subject).toBe("Inverter 1 is not answering its monitoring unit");
    expect(m.text).toContain("Inverter not answering:");
    expect(m.text).toContain("cable between the unit and the inverter");
    expect(m.text).not.toContain("If power or internet was cut");
  });

  it("keeps the power-or-internet wording when the unit itself stopped checking in", () => {
    const m = buildStatusDigest({ customerName: "Asha", items: items([silentUnit(1)]), dashboardUrl: dash });
    expect(m.subject).toBe("Inverter 1 is offline");
    expect(m.text).toContain("If power or internet was cut");
    expect(m.text).not.toContain("Inverter not answering:");
  });

  it("separates the two causes when both are due together", () => {
    const m = buildStatusDigest({ customerName: null, items: items([silentUnit(1), silentInverter(2)]), dashboardUrl: dash });
    expect(m.subject).toBe("2 of your devices are offline");
    expect(m.text).toMatch(/Offline:[\s\S]*Inverter 1[\s\S]*Inverter not answering:[\s\S]*Inverter 2/);
    expect(m.text).toContain("Some monitoring units have stopped checking in");
  });

  it("counts inverters, not devices, when they all failed the same way", () => {
    const m = buildStatusDigest({ customerName: null, items: items([silentInverter(1), silentInverter(2)]), dashboardUrl: dash });
    expect(m.subject).toBe("2 of your inverters are not answering");
  });

  it("says what the outage was when the device is back: power, the connection, or the inverter", () => {
    const power = buildStatusDigest({ customerName: "A", items: items([back(1, { was_status: "offline", restarted: true })]), dashboardUrl: dash });
    expect(power.text).toContain("The monitoring unit restarted, so power was probably lost.");
    const net = buildStatusDigest({ customerName: "A", items: items([back(2, { was_status: "offline", restarted: false })]), dashboardUrl: dash });
    expect(net.text).toContain("stayed on, so the Wi-Fi or internet connection was the problem");
    const inv = buildStatusDigest({ customerName: "A", items: items([back(3, { was_status: "device_unreachable", restarted: false })]), dashboardUrl: dash });
    expect(inv.text).toContain("The inverter is answering the monitoring unit again.");
    const old = buildStatusDigest({ customerName: "A", items: items([back(4, {})]), dashboardUrl: dash });
    expect(old.text).toContain("it was down for 4 minutes.");
    expect(old.text).not.toMatch(/restarted|stayed on|answering the monitoring unit again/);
  });
});
