import { describe, expect, it } from "vitest";
import { convert, formatConverted, quantityOfUnit } from "./unit-convert";

describe("convert", () => {
  it("moves between the units of a linear quantity", () => {
    expect(convert(2500, "power", "W", "kW")).toBe(2.5);
    expect(convert(1.5, "power", "kW", "W")).toBe(1500);
    expect(convert(1, "energy", "kWh", "Wh")).toBe(1000);
    expect(convert(500, "current", "mA", "A")).toBe(0.5);
    expect(convert(90, "time", "min", "h")).toBe(1.5);
  });
  it("converts temperatures both ways, including Kelvin", () => {
    expect(convert(100, "temperature", "C", "F")).toBeCloseTo(212, 6);
    expect(convert(32, "temperature", "F", "C")).toBeCloseTo(0, 6);
    expect(convert(0, "temperature", "C", "K")).toBeCloseTo(273.15, 6);
    expect(convert(-40, "temperature", "C", "F")).toBeCloseTo(-40, 6);
  });
  it("is null for an unknown quantity or unit, or a value that is not a number", () => {
    expect(convert(1, "mass", "kg", "g")).toBeNull();
    expect(convert(1, "power", "W", "BTU")).toBeNull();
    expect(convert(Number.NaN, "power", "W", "kW")).toBeNull();
  });
});

describe("formatConverted", () => {
  it("shows a tidy number", () => {
    expect(formatConverted(2.5)).toBe("2.5");
    expect(formatConverted(1 / 3)).toBe("0.333333");
    expect(formatConverted(1234567)).toBe("12,34,570"); // six significant digits
    expect(formatConverted(0)).toBe("0");
    expect(formatConverted(null)).toBe("—");
    expect(formatConverted(1e-9)).toBe("1.000e-9");
  });
});

describe("quantityOfUnit", () => {
  it("finds the quantity a setting's unit belongs to", () => {
    expect(quantityOfUnit("kW")).toEqual({ quantity: "power", unit: "kW" });
    expect(quantityOfUnit("V")).toEqual({ quantity: "voltage", unit: "V" });
    expect(quantityOfUnit("°C")).toEqual({ quantity: "temperature", unit: "C" });
    expect(quantityOfUnit("%")).toBeNull();
    expect(quantityOfUnit(null)).toBeNull();
  });
});
