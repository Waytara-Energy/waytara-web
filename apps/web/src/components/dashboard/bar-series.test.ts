import { describe, expect, it } from "vitest";
import { expandSums, fetchKeysOf, type BarTrendSeries } from "./bar-trend-chart";

const total: BarTrendSeries = { key: "solar_total_w", label: "Solar", color: "c", sumOf: ["pv1_power_w", "pv2_power_w"] };

describe("summed series", () => {
  it("fetch the parts, not the derived key, and skip cumulative series", () => {
    expect(fetchKeysOf([total])).toEqual(["pv1_power_w", "pv2_power_w"]);
    expect(
      fetchKeysOf([total, { key: "pv1_power_w", label: "PV1", color: "c" }, { key: "cum", label: "Total", color: "c", cumulativeOf: "pv1_power_w" }])
    ).toEqual(["pv1_power_w", "pv2_power_w"]);
  });

  it("show as their parts (named PV1, PV2) in the raw Go Live view", () => {
    expect(expandSums([total]).map((s) => [s.key, s.label])).toEqual([
      ["pv1_power_w", "PV1"],
      ["pv2_power_w", "PV2"],
    ]);
    const plain: BarTrendSeries = { key: "load_total_power_w", label: "Load", color: "c" };
    expect(expandSums([plain])).toEqual([plain]);
  });
});
