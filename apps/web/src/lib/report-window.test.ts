import { describe, expect, it } from "vitest";
import { READING_GROUP, READING_GROUP_ORDER, getSeries, inWindow, readingOptions, unitDecimals, normalizeWindow, resolveSelection, withDistinctColors, windowText } from "./report-types";

describe("time of day window", () => {
  it("keeps a real window and drops the whole day", () => {
    expect(normalizeWindow("13:00", "17:00")).toEqual({ from: "13:00", to: "17:00" });
    expect(normalizeWindow("00:00", "23:59")).toBeNull();
  });
  it("rejects a start that is not before the end, and bad times", () => {
    expect(normalizeWindow("17:00", "13:00")).toBeNull();
    expect(normalizeWindow("13:00", "13:00")).toBeNull();
    expect(normalizeWindow("25:00", "26:00")).toBeNull();
    expect(normalizeWindow(null, "17:00")).toBeNull();
  });
  it("includes the intervals starting from the start up to, not including, the end", () => {
    const w = { from: "13:00", to: "17:00" };
    expect(inWindow("2026-10-09T12:45", w)).toBe(false);
    expect(inWindow("2026-10-09T13:00", w)).toBe(true);
    expect(inWindow("2026-10-09T16:45", w)).toBe(true);
    expect(inWindow("2026-10-09T17:00", w)).toBe(false);
    expect(inWindow("2026-10-09T03:00", null)).toBe(true);
  });
  it("runs to the end of the day when the end is 23:59", () => {
    expect(inWindow("2026-10-09T23:45", { from: "18:00", to: "23:59" })).toBe(true);
  });
  it("describes itself", () => {
    expect(windowText({ from: "13:00", to: "17:00" })).toBe("13:00 to 17:00");
    expect(windowText({ from: "18:00", to: "23:59" })).toBe("18:00 to 24:00");
  });
});

describe("picked readings", () => {
  const enabled = new Set(["pv1_power_w", "pv2_power_w", "load_total_power_w", "battery_soc_pct"]);
  it("builds one report from readings of different categories, in the order picked", () => {
    const t = resolveSelection(["load", "solar", "batterySoc"], enabled);
    expect(t?.series.map((s) => s.id)).toEqual(["load", "solar", "batterySoc"]);
  });
  it("drops readings the device does not report, and unknown ones", () => {
    expect(resolveSelection(["gridImport", "load", "nope"], enabled)?.series.map((s) => s.id)).toEqual(["load"]);
    expect(resolveSelection(["gridImport"], enabled)).toBeNull();
  });
  it("never gives two readings the same colour", () => {
    const list = withDistinctColors([getSeries("load")!, getSeries("gridImport")!, getSeries("solar")!]);
    expect(new Set(list.map((s) => s.color)).size).toBe(3);
    expect(list[0].color).toBe(getSeries("load")!.color);
  });
});

describe("monitoring readings", () => {
  it("offers voltage, current and frequency readings under the Monitoring tabs, including the inverter", () => {
    expect(READING_GROUP_ORDER).toContain("Inverter");
    const names = readingOptions().filter((o) => o.group === "Inverter").map((o) => o.unit);
    expect(names).toEqual(expect.arrayContaining(["kW", "V", "A", "Hz", "°C"]));
    for (const o of readingOptions()) expect(READING_GROUP_ORDER).toContain(READING_GROUP[o.id]);
  });
  it("keeps only the readings the device reports", () => {
    const enabled = new Set(["inverter_l1_voltage_v", "inverter_output_frequency_hz"]);
    expect(resolveSelection(["inverterVoltage", "inverterFrequency", "gridVoltage"], enabled)?.series.map((s) => s.id)).toEqual(["inverterVoltage", "inverterFrequency"]);
  });
  it("shows hertz and kilowatts to two places, volts and amps to one", () => {
    expect([unitDecimals("Hz"), unitDecimals("kW"), unitDecimals("V"), unitDecimals("A")]).toEqual([2, 2, 1, 1]);
  });
});
