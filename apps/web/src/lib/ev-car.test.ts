import { describe, expect, it } from "vitest";
import { carToJson, chargeProgress, kmText, minutesText, parseCarInput, parseCarProfile } from "./ev-car";

const car = { batteryKwh: 24, kmPerKwh: 6 };

describe("the saved car", () => {
  it("reads what carToJson wrote, and nothing else", () => {
    expect(parseCarProfile(carToJson(car))).toEqual(car);
    expect(parseCarProfile({})).toBeNull();
    expect(parseCarProfile(null)).toBeNull();
    expect(parseCarProfile({ ev_car: { battery_kwh: "24", km_per_kwh: 6 } })).toBeNull();
    expect(parseCarProfile({ ev_car: { battery_kwh: 2, km_per_kwh: 6 } })).toBeNull();
    expect(parseCarProfile({ ev_car: { battery_kwh: 24, km_per_kwh: 40 } })).toBeNull();
  });
  it("checks what is typed in the form, accepting a decimal comma", () => {
    expect(parseCarInput("24", "6")).toEqual({ ok: true, car });
    expect(parseCarInput("39,2", "5,5")).toEqual({ ok: true, car: { batteryKwh: 39.2, kmPerKwh: 5.5 } });
    expect(parseCarInput("", "6")).toMatchObject({ ok: false });
    expect(parseCarInput("24", "abc")).toMatchObject({ ok: false });
    expect(parseCarInput("1000", "6")).toMatchObject({ ok: false });
  });
});

describe("chargeProgress", () => {
  it("measures a charge against the amount booked, with the time left at the power now", () => {
    const p = chargeProgress({ deliveredKwh: 2, targetKwh: 5, powerKw: 7.5, car });
    expect(p.percent).toBeCloseTo(40);
    expect(p.percentOf).toBe("booked");
    expect(p.remainingKwh).toBeCloseTo(3);
    expect(p.minutesLeft).toBe(24); // 3 kWh at 7.5 kW
    expect(p.kmAdded).toBeCloseTo(12);
  });
  it("measures a charge with nothing booked against the battery, and gives no time (there is no end to count to)", () => {
    const p = chargeProgress({ deliveredKwh: 6, targetKwh: null, powerKw: 7, car });
    expect(p.percent).toBeCloseTo(25);
    expect(p.percentOf).toBe("battery");
    expect(p.minutesLeft).toBeNull();
    expect(p.remainingKwh).toBeNull();
  });
  it("has no percentage with neither a booked amount nor a car, but still no invented figures", () => {
    const p = chargeProgress({ deliveredKwh: 1.2, targetKwh: null, powerKw: 7, car: null });
    expect(p).toEqual({ percent: null, percentOf: null, remainingKwh: null, minutesLeft: null, kmAdded: null });
  });
  it("never goes past 100 %, and gives no time once the amount is reached or while the charger idles", () => {
    expect(chargeProgress({ deliveredKwh: 0.64, targetKwh: 0.2, powerKw: 7, car }).percent).toBe(100);
    expect(chargeProgress({ deliveredKwh: 5, targetKwh: 5, powerKw: 7, car }).minutesLeft).toBeNull();
    expect(chargeProgress({ deliveredKwh: 1, targetKwh: 5, powerKw: 0.1, car }).minutesLeft).toBeNull();
    expect(chargeProgress({ deliveredKwh: null, targetKwh: 5, powerKw: 7, car }).percent).toBeNull();
  });
  it("says at least a minute when a little is left", () => {
    expect(chargeProgress({ deliveredKwh: 4.99, targetKwh: 5, powerKw: 7, car }).minutesLeft).toBe(1);
  });
});

describe("the words", () => {
  it("writes minutes and kilometres", () => {
    expect(minutesText(7)).toBe("7 min");
    expect(minutesText(65)).toBe("1 h 05 min");
    expect(kmText(0.4)).toBe("< 1 km");
    expect(kmText(89.4)).toBe("89 km");
  });
});
