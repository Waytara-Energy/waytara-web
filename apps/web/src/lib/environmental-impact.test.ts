import { describe, expect, it } from "vitest";
import { co2AvoidedKg, evCo2SavedKg } from "./environmental-impact";
import { EMISSION_FACTOR, PETROL_CAR } from "./emission-factor";

describe("evCo2SavedKg", () => {
  it("is the petrol car's emissions over the distance when every kWh was clean", () => {
    const r = evCo2SavedKg(100, 0, 6);
    expect(r.km).toBe(600);
    expect(r.kg).toBeCloseTo(600 * PETROL_CAR.kgPerKm, 6);
  });

  it("takes off what the grid part of the charging gave off", () => {
    const r = evCo2SavedKg(100, 40, 6);
    expect(r.kg).toBeCloseTo(600 * PETROL_CAR.kgPerKm - 40 * EMISSION_FACTOR.kgPerKwh, 6);
  });

  it("never goes below zero (a very inefficient car on the grid)", () => {
    expect(evCo2SavedKg(100, 100, 1).kg).toBe(0);
  });

  it("is zero with nothing charged", () => {
    expect(evCo2SavedKg(0, 0, 6)).toEqual({ kg: 0, km: 0 });
  });
});

describe("co2AvoidedKg", () => {
  it("is the energy times the grid's factor", () => {
    expect(co2AvoidedKg(100)).toBeCloseTo(100 * EMISSION_FACTOR.kgPerKwh, 6);
  });
});
