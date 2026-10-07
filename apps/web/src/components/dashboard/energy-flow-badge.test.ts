import { describe, expect, it } from "vitest";
import { badgeFor, homeSourceOf } from "./energy-flow-badge";

describe("badgeFor", () => {
  it("solar: producing or idle", () => {
    expect(badgeFor("solar", 3200)).toMatchObject({ label: "Producing", tone: "producing" });
    expect(badgeFor("solar", 0).label).toBe("Idle");
    expect(badgeFor("solar", null).label).toBe("Idle");
  });

  it("grid: import, export or idle", () => {
    expect(badgeFor("grid", 500)).toMatchObject({ label: "Importing", tone: "drawing" });
    expect(badgeFor("grid", -500)).toMatchObject({ label: "Exporting", tone: "consuming" });
    expect(badgeFor("grid", 0).label).toBe("Idle");
  });

  it("battery and UPS: positive is charging, negative is discharging", () => {
    expect(badgeFor("battery", 134).label).toBe("Charging");
    expect(badgeFor("battery", -134).label).toBe("Discharging");
    expect(badgeFor("ups", -10).label).toBe("Discharging");
    expect(badgeFor("battery", 0).label).toBe("Idle");
  });

  it("home shows its source, EV and generator show activity", () => {
    expect(badgeFor("home", 900, "solar").label).toBe("Solar-powered");
    expect(badgeFor("home", 900, "grid").label).toBe("Grid power");
    expect(badgeFor("home", 900, "battery").label).toBe("Battery-powered");
    expect(badgeFor("home", 0, "idle").label).toBe("Idle");
    expect(badgeFor("ev", 7400)).toMatchObject({ label: "Charging", tone: "consuming" });
    expect(badgeFor("ev", 0).label).toBe("Idle");
    expect(badgeFor("generator", 5000)).toMatchObject({ label: "Running" });
  });
});

describe("homeSourceOf", () => {
  it("grid import wins, then the larger of battery and solar", () => {
    expect(homeSourceOf(900, 3000, 0, 200)).toBe("grid");
    expect(homeSourceOf(900, 3000, -500, -100)).toBe("solar");
    expect(homeSourceOf(900, 100, -800, 0)).toBe("battery");
    expect(homeSourceOf(900, 0, 0, 0)).toBe("idle");
    expect(homeSourceOf(0, 3000, 0, 0)).toBe("idle");
    expect(homeSourceOf(null, 3000, 0, 0)).toBe("idle");
  });
});
