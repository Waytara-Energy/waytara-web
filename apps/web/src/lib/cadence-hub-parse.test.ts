import { describe, expect, it } from "vitest";
import { addRows, keyChunks, splitKnown, timeChunks } from "./cadence-hub-parse";

describe("rows from the readings service become one series per value", () => {
  it("keeps each value's readings with their times and skips what was not read at that moment", () => {
    const series = { pv1_power_w: [] as [number, number][], battery_soc_pct: [] as [number, number][] };
    addRows(series, {
      columns: [{ key: "pv1_power_w" }, { key: "battery_soc_pct" }],
      rows: [
        [1000, 1200, 80],
        [1005, 1210, null], // the battery level is read less often
        [1010, null, null],
        [1015, 1190, 79],
      ],
    });
    expect(series.pv1_power_w).toEqual([[1000, 1200], [1005, 1210], [1015, 1190]]);
    expect(series.battery_soc_pct).toEqual([[1000, 80], [1015, 79]]);
  });

  it("ignores a column nobody asked for, a row without a time, and a value that is not a number", () => {
    const series = { a: [] as [number, number][] };
    addRows(series, {
      columns: [{ key: "a" }, { key: "extra" }],
      rows: [[1, 5, 9], [null as unknown as number, 6, 9], [3, NaN, 9], [4, 7, 9]],
    });
    expect(series.a).toEqual([[1, 5], [4, 7]]);
    expect(Object.keys(series)).toEqual(["a"]);
  });

  it("adds to what is already there, so consecutive pieces join up", () => {
    const series = { a: [[1, 1]] as [number, number][] };
    addRows(series, { columns: [{ key: "a" }], rows: [[2, 2], [3, 3]] });
    expect(series.a).toEqual([[1, 1], [2, 2], [3, 3]]);
  });
});

describe("cutting a request into pieces the service accepts", () => {
  it("cuts a range into consecutive pieces, the last one shorter", () => {
    expect(timeChunks(0, 25, 10)).toEqual([[0, 10], [10, 20], [20, 25]]);
    expect(timeChunks(5, 8, 10)).toEqual([[5, 8]]);
    expect(timeChunks(5, 5, 10)).toEqual([]);
  });

  it("cuts the keys into groups of a given size", () => {
    expect(keyChunks(["a", "b", "c", "d", "e"], 2)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
    expect(keyChunks([], 3)).toEqual([]);
  });

  it("separates what the person may read from what the service does not offer, once each", () => {
    expect(splitKnown(["pv1_power_w", "weather_temperature_c", "pv1_power_w", "battery_soc_pct"], ["pv1_power_w", "battery_soc_pct", "x"])).toEqual({
      use: ["pv1_power_w", "battery_soc_pct"],
      unknown: ["weather_temperature_c"],
    });
  });
});
