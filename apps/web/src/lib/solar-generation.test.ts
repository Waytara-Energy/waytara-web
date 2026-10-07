import { describe, expect, it } from "vitest";
import { pvPowerKeys, solarGenerationW, sumPvPower } from "./solar-generation";

describe("pvPowerKeys", () => {
  it("picks the PV power keys of the device in input order and ignores everything else", () => {
    expect(pvPowerKeys(["pv10_power_w", "battery_power_w", "pv2_power_w", "pv1_power_w", "pv1_voltage_v", "inverter_output_power_w"])).toEqual([
      "pv1_power_w",
      "pv2_power_w",
      "pv10_power_w",
    ]);
    expect(pvPowerKeys(new Set(["load_total_power_w"]))).toEqual([]);
  });
});

describe("solar generation", () => {
  it("is the sum of the PV inputs: PV1 0 W + PV2 2,283 W = 2,283 W, not the 2,449 W AC output", () => {
    const v = { pv1_power_w: 0, pv2_power_w: 2283, inverter_output_power_w: 2449 };
    expect(solarGenerationW(v, ["pv1_power_w", "pv2_power_w"])).toBe(2283);
  });

  it("only counts inputs that have a reading, and is null when none has", () => {
    expect(sumPvPower({ pv1_power_w: 500, pv2_power_w: null }, ["pv1_power_w", "pv2_power_w", "pv3_power_w"])).toBe(500);
    expect(sumPvPower({ pv1_power_w: null }, ["pv1_power_w"])).toBeNull();
  });

  it("falls back to the AC output only for a device with no PV power registers", () => {
    expect(solarGenerationW({ inverter_output_power_w: 1800 }, [])).toBe(1800);
    expect(solarGenerationW({}, [])).toBeNull();
  });
});
