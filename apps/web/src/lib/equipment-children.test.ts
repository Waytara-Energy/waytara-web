import { describe, expect, it } from "vitest";
import { isMonitoredCategory, solarKwp, type ChildEquipment } from "./equipment-children";

const panel = (over: Partial<ChildEquipment> = {}): ChildEquipment => ({ category: "Solar Panels", quantity: 12, installedAt: null, capacityValue: "550", capacityUnit: "W", specs: null, warranty: null, ...over });

describe("equipment kinds", () => {
  it("only inverters and chargers are monitored devices", () => {
    expect(isMonitoredCategory("solar_inverter")).toBe(true);
    expect(isMonitoredCategory("ev_charger")).toBe(true);
    expect(isMonitoredCategory("Batteries")).toBe(false);
    expect(isMonitoredCategory("Solar Panels")).toBe(false);
    expect(isMonitoredCategory(null)).toBe(false);
  });
});

describe("solarKwp", () => {
  it("is the panel power times the quantity: 12 x 550 W = 6.6 kWp", () => {
    expect(solarKwp([panel()])).toBe(6.6);
  });
  it("adds up several panel rows and ignores other equipment", () => {
    expect(solarKwp([panel(), panel({ quantity: 4, capacityValue: 400 }), { ...panel(), category: "Batteries", capacityValue: 5.12, capacityUnit: "kWh" }])).toBe(8.2);
  });
  it("understands kW per panel", () => {
    expect(solarKwp([panel({ capacityValue: 0.55, capacityUnit: "kW", quantity: 10 })])).toBe(5.5);
  });
  it("says nothing without panels or when a panel does not state its power", () => {
    expect(solarKwp([])).toBeNull();
    expect(solarKwp([{ ...panel(), category: "Batteries" }])).toBeNull();
    expect(solarKwp([panel({ capacityValue: null })])).toBeNull();
    expect(solarKwp([panel({ capacityUnit: "sq m" })])).toBeNull();
  });
});
