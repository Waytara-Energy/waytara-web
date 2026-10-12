import { describe, expect, it } from "vitest";
import { POWER_PACKAGE_LABELS, powerPackageIncludes } from "./site-catalog";

describe("powerPackageIncludes", () => {
  it("lists what each package has", () => {
    expect(powerPackageIncludes("solar_inverter")).toEqual(["Solar panels", "Inverter"]);
    expect(powerPackageIncludes("solar_battery_inverter_ev")).toEqual(["Solar panels", "Battery", "Inverter", "EV charger"]);
    expect(powerPackageIncludes("inverter_battery")).toEqual(["Battery", "Inverter"]);
    expect(powerPackageIncludes("ev_charger_only")).toEqual(["EV charger"]);
    expect(powerPackageIncludes(null)).toEqual([]);
  });
  it("covers every package the catalogue names", () => {
    for (const key of Object.keys(POWER_PACKAGE_LABELS)) expect(powerPackageIncludes(key).length).toBeGreaterThan(0);
  });
});
