import { describe, expect, it } from "vitest";
import { evEventLine, evHealthChecks, type EvHealthInput } from "./ev-maint-health";
import { problemCount, verdictOf } from "./maintenance-health";

const fine: EvHealthInput = {
  connection: "online",
  unit: { label: "Waytara Office unit", status: "online" },
  lastCheckInAgeS: 4,
  heartbeatS: 10,
  connector: { label: "Available", code: 0, error: null },
  lastCharge: { status: "completed", stopReason: "Local" },
  firmware: "2.2.7",
};
const by = (i: EvHealthInput, id: string) => evHealthChecks(i).find((c) => c.id === id);

describe("evHealthChecks", () => {
  it("says everything is fine for a charger that checks in through an online unit", () => {
    const checks = evHealthChecks(fine);
    expect(checks.every((c) => c.state === "ok")).toBe(true);
    expect(checks.map((c) => c.id)).toEqual(["unit", "connection", "checkin", "rhythm", "connector", "charge", "firmware"]);
    expect(verdictOf("online", checks)).toBe("good");
  });

  it("blames the unit when it is offline, and the charger when only the charger does not answer", () => {
    const unitDown = evHealthChecks({ ...fine, connection: "offline", unit: { label: null, status: "offline" } });
    expect(unitDown.find((c) => c.id === "unit")).toMatchObject({ state: "bad" });
    expect(unitDown.find((c) => c.id === "connection")!.detail).toContain("monitoring unit is offline");
    const chargerDown = by({ ...fine, connection: "connection_lost" }, "connection")!;
    expect(chargerDown.state).toBe("bad");
    expect(chargerDown.detail).toContain("online but the charger is not answering");
  });

  it("leaves the unit row out for a charger that connects straight to WayTara", () => {
    expect(evHealthChecks({ ...fine, unit: null }).some((c) => c.id === "unit")).toBe(false);
  });

  it("grades the last check-in: fine up to a minute, a heads-up to five, a problem after, and warns when there was none", () => {
    expect(by({ ...fine, lastCheckInAgeS: 60 }, "checkin")!.state).toBe("ok");
    expect(by({ ...fine, lastCheckInAgeS: 61 }, "checkin")!.state).toBe("warn");
    expect(by({ ...fine, lastCheckInAgeS: 301 }, "checkin")!.state).toBe("bad");
    expect(by({ ...fine, lastCheckInAgeS: null }, "checkin")!.state).toBe("warn");
  });

  it("checks the rhythm only when known and warns when it is slower than the unit's", () => {
    expect(evHealthChecks({ ...fine, heartbeatS: null }).some((c) => c.id === "rhythm")).toBe(false);
    expect(by({ ...fine, heartbeatS: 15 }, "rhythm")!.state).toBe("ok");
    expect(by({ ...fine, heartbeatS: 30 }, "rhythm")!.state).toBe("warn");
  });

  it("calls a faulted connector a problem (with the error), an unavailable one a heads-up, and an error on a working one a heads-up", () => {
    expect(by({ ...fine, connector: { label: "Faulted", code: 6, error: "Over current" } }, "connector")).toMatchObject({ state: "bad" });
    expect(by({ ...fine, connector: { label: "Faulted", code: 6, error: "Over current" } }, "connector")!.detail).toContain("Over current");
    expect(by({ ...fine, connector: { label: "Unavailable", code: 5, error: null } }, "connector")!.state).toBe("warn");
    expect(by({ ...fine, connector: { label: "Charging", code: 2, error: "Ground failure" } }, "connector")!.state).toBe("warn");
  });

  it("warns about a last charge that ended unexpectedly or looked odd, and not about a normal one", () => {
    expect(by({ ...fine, lastCharge: { status: "completed", stopReason: "EVDisconnected" } }, "charge")!.state).toBe("ok");
    expect(by({ ...fine, lastCharge: { status: "aborted", stopReason: "PowerLoss" } }, "charge")!.state).toBe("warn");
    expect(by({ ...fine, lastCharge: { status: "suspect", stopReason: null } }, "charge")!.state).toBe("warn");
    expect(by({ ...fine, lastCharge: null }, "charge")!.detail).toBe("No charge has ended yet.");
  });

  it("gives the verdict of the whole list: offline, needs attention, or good", () => {
    expect(verdictOf("offline", evHealthChecks({ ...fine, connection: "offline" }))).toBe("offline");
    const warn = evHealthChecks({ ...fine, heartbeatS: 30 });
    expect(verdictOf("online", warn)).toBe("attention");
    expect(problemCount(warn)).toBe(1);
  });
});

describe("evEventLine", () => {
  it("puts the charger's events in plain words", () => {
    expect(evEventLine("connected", {})?.text).toBe("The charger connected.");
    expect(evEventLine("disconnected", { seconds: 125 })?.text).toBe("The charger disconnected after 2 min.");
    expect(evEventLine("boot", { firmware: "2.2.7" })?.text).toBe("The charger started (firmware 2.2.7).");
    expect(evEventLine("status", { connector: 1, status: "Faulted", error: "OverCurrentFailure" })).toMatchObject({ text: "Connector 1: Faulted (OverCurrentFailure).", tone: "bad" });
    expect(evEventLine("status", { connector: 1, status: "Charging", error: "NoError" })).toMatchObject({ text: "Connector 1: Charging.", tone: "info" });
    expect(evEventLine("transaction_start", { target_kwh: 10 })?.text).toBe("A charge started (stops at 10 kWh).");
    expect(evEventLine("transaction_stop", { reason: "Remote", energy_kwh: 3.2 })?.text).toBe("A charge ended (stopped from the app, 3.20 kWh).");
    expect(evEventLine("command", { command: "remote-start" })?.text).toBe("A command was sent to the charger: remote start.");
    expect(evEventLine("configuration", { key: "HeartbeatInterval", status: "Rejected" })).toMatchObject({ tone: "warn" });
  });

  it("hides the events a customer has no use for", () => {
    expect(evEventLine("authorize", { tag: "abc" })).toBeNull();
    expect(evEventLine("data_transfer", {})).toBeNull();
    expect(evEventLine("something_new", {})).toBeNull();
  });
});
