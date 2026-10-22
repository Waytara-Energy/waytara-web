import { describe, expect, it } from "vitest";
import { DEFAULT_UNIT_PREFS, displayValue, formatShown, parseUnitPrefs, quantityLabelOf, seriesConverter, shownUnit } from "./unit-prefs";

const W = { defaults: { power: "W" }, overrides: {} };

describe("parseUnitPrefs", () => {
  it("is empty for nothing or rubbish", () => {
    expect(parseUnitPrefs(null)).toEqual(DEFAULT_UNIT_PREFS);
    expect(parseUnitPrefs("x")).toEqual(DEFAULT_UNIT_PREFS);
    expect(parseUnitPrefs({ units: 3 })).toEqual(DEFAULT_UNIT_PREFS);
  });
  it("keeps only units that belong to their kind", () => {
    expect(parseUnitPrefs({ units: { defaults: { power: "kW", energy: "kW", temperature: "F", bogus: "W" } } }).defaults).toEqual({ power: "kW", temperature: "F" });
  });
  it("keeps overrides with a sane key and a known unit", () => {
    const p = parseUnitPrefs({ units: { overrides: { battery_power_w: "kW", "bad key!": "W", x: "parsec" } } });
    expect(p.overrides).toEqual({ battery_power_w: "kW" });
  });
  it("reads the stored column value (ui_preferences with a units key)", () => {
    expect(parseUnitPrefs({ overview_cards: [], units: { defaults: { energy: "MJ" } } }).defaults).toEqual({ energy: "MJ" });
  });
});

describe("displayValue", () => {
  it("leaves a value alone when nothing was chosen, or when it is already in the chosen unit", () => {
    expect(displayValue(6.5, "kW", DEFAULT_UNIT_PREFS)).toMatchObject({ value: 6.5, unit: "kW", converted: false });
    expect(displayValue(6.5, "kW", { defaults: { power: "kW" }, overrides: {} })).toMatchObject({ value: 6.5, converted: false });
  });
  it("converts a kind everywhere: kW to W, kWh to MJ, degrees to Fahrenheit", () => {
    expect(displayValue(6.5, "kW", W)).toMatchObject({ value: 6500, unit: "W", converted: true });
    expect(displayValue(1, "kWh", { defaults: { energy: "MJ" }, overrides: {} }).value).toBeCloseTo(3.6, 1);
    expect(displayValue(100, "°C", { defaults: { temperature: "F" }, overrides: {} })).toMatchObject({ value: 212, unit: "°F" });
  });
  it("lets one reading differ from its kind", () => {
    const prefs = { defaults: { power: "W" }, overrides: { grid_total_power_w: "kW" } };
    expect(displayValue(1500, "W", prefs, "grid_total_power_w")).toMatchObject({ value: 1.5, unit: "kW" });
    expect(displayValue(1500, "W", prefs, "load_total_power_w")).toMatchObject({ value: 1500, converted: false });
    expect(displayValue(2, "kW", prefs, "load_total_power_w")).toMatchObject({ value: 2000, unit: "W" });
  });
  it("leaves a unit it does not know, a percentage and a bad number alone", () => {
    expect(displayValue(80, "%", W)).toMatchObject({ value: 80, unit: "%", converted: false });
    expect(displayValue(5, "furlongs", W).converted).toBe(false);
    expect(displayValue(Number.NaN, "kW", W).converted).toBe(false);
    expect(displayValue(5, null, W).unit).toBe("");
  });
  it("does not convert across kinds (an energy choice never touches power)", () => {
    expect(displayValue(5, "kW", { defaults: { energy: "Wh" }, overrides: {} }).converted).toBe(false);
  });
});

describe("formatShown / shownUnit / seriesConverter / quantityLabelOf", () => {
  it("prints a converted number with the decimals of its new unit, and an unconverted one with its own", () => {
    expect(formatShown(displayValue(6.5, "kW", W), 2)).toBe("6,500 W");
    expect(formatShown(displayValue(6.5, "kW", DEFAULT_UNIT_PREFS), 2)).toBe("6.50 kW");
    expect(formatShown(displayValue(6.5, "kW", W), 2, false)).toBe("6,500");
    expect(formatShown(displayValue(1234.5678, "W", { defaults: { power: "MW" }, overrides: {} }), 0)).toBe("0.001 MW");
  });
  it("gives the unit text and a mapper for chart data", () => {
    expect(shownUnit("kW", W)).toBe("W");
    expect(shownUnit("kW", DEFAULT_UNIT_PREFS)).toBe("kW");
    const s = seriesConverter("kW", W);
    expect(s?.unit).toBe("W");
    expect(s?.map(2)).toBe(2000);
    expect(seriesConverter("kW", DEFAULT_UNIT_PREFS)).toBeNull();
  });
  it("says what kind a unit is", () => {
    expect(quantityLabelOf("kWh")).toBe("energy");
    expect(quantityLabelOf("%")).toBeNull();
    expect(quantityLabelOf("s")).toBeNull();
  });
});
