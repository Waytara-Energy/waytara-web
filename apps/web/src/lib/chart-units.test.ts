import { describe, expect, it } from "vitest";
import { applyChartUnits, linearUnit } from "./chart-units";
import { DEFAULT_UNIT_PREFS, parseUnitPrefs } from "./unit-prefs";

const W = parseUnitPrefs({ units: { defaults: { power: "W" } } });

describe("linearUnit", () => {
  it("is 1 and the same label with no choice, and the factor and new label with one", () => {
    expect(linearUnit("kW", DEFAULT_UNIT_PREFS)).toEqual({ factor: 1, unit: "kW" });
    expect(linearUnit("kW", W)).toEqual({ factor: 1000, unit: "W" });
    expect(linearUnit("%", W)).toEqual({ factor: 1, unit: "%" });
  });
  it("leaves temperature alone (it is not a straight factor)", () => {
    expect(linearUnit("°C", parseUnitPrefs({ units: { defaults: { temperature: "F" } } }))).toEqual({ factor: 1, unit: "°C" });
  });
});

type TestSeries = { key: string; label: string; unit?: string; scale?: number; footerUnit?: string; footerScale?: number; cumulativeOf?: string };
type TestProps = { series: TestSeries[]; valueScale?: number; unit?: string; footerUnit?: string; referenceLines?: { value: number; unit: string; label: string }[] };

describe("applyChartUnits", () => {
  const props: TestProps = { series: [{ key: "load_total_power_w", label: "Load" }, { key: "battery_soc_pct", label: "SOC", unit: "%", scale: 1 }], valueScale: 0.001, unit: "kW", footerUnit: "kWh" };

  it("returns the props untouched when nothing is chosen", () => {
    expect(applyChartUnits(props, DEFAULT_UNIT_PREFS)).toBe(props);
  });
  it("scales watts to the chosen power unit, relabels the series and follows with the totals (kW -> W means kWh -> Wh)", () => {
    const out = applyChartUnits(props, W);
    expect(out.valueScale).toBeCloseTo(1, 9); // raw watts, now printed in W
    expect(out.unit).toBe("W");
    expect(out.footerUnit).toBe("Wh");
    expect(out.series[0]).toMatchObject({ unit: "W", footerUnit: "Wh", footerScale: 1 });
    expect(out.series[0].scale).toBeCloseTo(1, 9);
    expect(out.series[1]).toMatchObject({ unit: "%", scale: 1 });
  });
  it("converts totals to an energy unit chosen separately", () => {
    const out = applyChartUnits(props, parseUnitPrefs({ units: { defaults: { energy: "MJ" } } }));
    expect(out.unit).toBe("kW");
    expect(out.series[0].footerUnit).toBe("MJ");
    expect(out.series[0].footerScale).toBeCloseTo(3.6, 1);
  });
  it("honours a choice made for one reading only", () => {
    const out = applyChartUnits(props, parseUnitPrefs({ units: { overrides: { load_total_power_w: "MW" } } }));
    expect(out.series[0]).toMatchObject({ unit: "MW" });
    expect(out.series[0].scale).toBeCloseTo(0.000001, 12);
    expect(out.series[1].unit).toBe("%");
  });
  it("gives a running total the energy unit of the series it adds up, and moves reference lines with their unit", () => {
    const withTotal: TestProps = { series: [{ key: "p", label: "P" }, { key: "c", label: "Total", unit: "kWh", cumulativeOf: "p" }], valueScale: 0.001, unit: "kW", footerUnit: "kWh", referenceLines: [{ value: 5, unit: "kW", label: "limit" }] };
    const out = applyChartUnits(withTotal, W);
    expect(out.series[1]).toMatchObject({ unit: "Wh", footerUnit: "Wh", footerScale: 1 });
    expect(out.referenceLines?.[0]).toMatchObject({ value: 5000, unit: "W" });
  });
});
