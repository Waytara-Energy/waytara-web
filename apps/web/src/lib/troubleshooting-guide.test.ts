import { describe, expect, it } from "vitest";
import { FAULT_LIST, getFaultInfo } from "./deye-fault-codes";
import { evChargerGuide, inverterGuide, isActiveItem } from "./troubleshooting-guide";

describe("fault table", () => {
  it("names each code as the manufacturer does and gives steps for it", () => {
    expect(getFaultInfo(13)?.label).toBe("Working mode changed");
    expect(getFaultInfo(58)?.label).toBe("BMS communication fault");
    expect(FAULT_LIST).toHaveLength(29);
    for (const f of FAULT_LIST) {
      expect(f.steps.length).toBeGreaterThan(0);
      expect(f.solution.length).toBeGreaterThan(0);
    }
  });
  it("still answers for a code it does not know", () => {
    expect(getFaultInfo(999)?.steps.length).toBeGreaterThan(0);
  });
});

describe("troubleshooting guide", () => {
  it("lists every fault of the table once, under inverter, battery or grid", () => {
    const codes = inverterGuide().flatMap((s) => s.items.map((i) => i.code)).filter((c): c is string => !!c && c.startsWith("F"));
    expect(codes.sort()).toEqual(FAULT_LIST.map((f) => f.code).sort());
  });
  it("explains the indicator lights, which have no code", () => {
    const lights = inverterGuide().find((s) => s.id === "lights")!;
    expect(lights.items.length).toBeGreaterThan(0);
    expect(lights.items.every((i) => i.code === null)).toBe(true);
  });
  it("marks the active item by its code", () => {
    const item = inverterGuide().flatMap((s) => s.items).find((i) => i.code === "F58")!;
    expect(isActiveItem(item, ["F58"])).toBe(true);
    expect(isActiveItem(item, ["F13"])).toBe(false);
  });
  it("covers every charger error the device can report", () => {
    const codes = evChargerGuide().flatMap((s) => s.items.map((i) => i.code));
    for (const c of ["GroundFailure", "OverCurrentFailure", "WeakSignal", "Faulted", "Charging", "FAILED_EVShiftPosition"]) expect(codes).toContain(c);
  });
  it("never tells a customer to open the equipment", () => {
    const text = [...inverterGuide(), ...evChargerGuide()].flatMap((s) => s.items.flatMap((i) => i.steps)).join(" ").toLowerCase();
    expect(text).not.toMatch(/open the (inverter|battery|charger)|remove the cover|unscrew/);
  });
});
