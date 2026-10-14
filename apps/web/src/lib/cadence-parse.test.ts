import { describe, expect, it } from "vitest";
import { averageIntoBins, parseCadenceAnswer } from "./cadence-parse";
import { cadenceGroupOf, splitByGroup } from "./cadence-keys";

describe("parseCadenceAnswer", () => {
  it("turns rows into one series per metric, times in ms, skipping empty cells", () => {
    const r = parseCadenceAnswer({ ok: true, keys: ["a", "b"], rows: [[100, 1, null], [105, 2, 5], [110, null, 6]] }, ["a", "b"]);
    expect(r).toEqual({ ok: true, series: { a: [[100000, 1], [105000, 2]], b: [[105000, 5], [110000, 6]] } });
  });

  it("only returns the metrics that were asked for, and uses their order when the answer names no columns", () => {
    const r = parseCadenceAnswer({ ok: true, keys: ["a", "b", "c"], rows: [[1, 1, 2, 3]] }, ["c"]);
    expect(r).toEqual({ ok: true, series: { c: [[1000, 3]] } });
    const r2 = parseCadenceAnswer({ ok: true, rows: [[1, 7, 8]] }, ["x", "y"]);
    expect(r2).toEqual({ ok: true, series: { x: [[1000, 7]], y: [[1000, 8]] } });
  });

  it("accepts millisecond times, sorts, and drops a duplicated time (a retried upload)", () => {
    const r = parseCadenceAnswer({ ok: true, keys: ["a"], rows: [[1_700_000_005_000, 2], [1_700_000_000_000, 1], [1_700_000_000_000, 9]] }, ["a"]);
    expect(r).toEqual({ ok: true, series: { a: [[1_700_000_000_000, 1], [1_700_000_005_000, 2]] } });
  });

  it("reports the script's own error, and unreadable answers", () => {
    expect(parseCadenceAnswer({ ok: false, error: "bad secret" }, ["a"])).toEqual({ ok: false, error: "bad secret" });
    expect(parseCadenceAnswer(null, ["a"]).ok).toBe(false);
    expect(parseCadenceAnswer({ ok: true }, ["a"]).ok).toBe(false);
  });
});

describe("averageIntoBins", () => {
  it("averages the readings of each bin and keeps bins in order", () => {
    const pts: [number, number][] = [[0, 10], [5_000, 20], [60_000, 30], [65_000, 50]];
    expect(averageIntoBins(pts, 60_000, 0)).toEqual([[0, 15], [60_000, 40]]);
  });
});

describe("cadence groups", () => {
  it("knows which group a register is stored in", () => {
    expect(cadenceGroupOf("pv1_power_w")).toBe("fast_5s");
    expect(cadenceGroupOf("fault_message_1")).toBe("mid_10s");
    expect(cadenceGroupOf("total_pv_energy_kwh")).toBe("slow_30s");
    expect(cadenceGroupOf("nope")).toBeNull();
  });
  it("splits a list by group and reports unknown keys", () => {
    const s = splitByGroup(["pv1_power_w", "battery_soc_pct", "total_pv_energy_kwh", "weather_temperature_c"]);
    expect(s.groups.fast_5s).toEqual(["pv1_power_w", "battery_soc_pct"]);
    expect(s.groups.slow_30s).toEqual(["total_pv_energy_kwh"]);
    expect(s.unknown).toEqual(["weather_temperature_c"]);
  });
});

import { bucketCadenceForReport } from "./cadence-parse";
import { istBucketKey } from "./report-types";

describe("bucketCadenceForReport", () => {
  // 2026-10-13 00:00 IST = 2026-10-12T18:30Z
  const t0 = Date.parse("2026-10-12T18:30:00Z");
  const series = { p: [[t0, 10], [t0 + 5_000, 20], [t0 + 60_000, -30], [t0 + 65_000, 50]] as [number, number][] };

  it("averages a bucket, and keeps the positive and negative parts apart", () => {
    const { raw, covered } = bucketCadenceForReport(series, () => 5, 1, "avg", (ms, m) => istBucketKey(new Date(ms), m));
    expect(raw.get("2026-10-13T00:00")?.p).toEqual({ avg: 15, pos: 15, neg: 0 });
    expect(raw.get("2026-10-13T00:01")?.p).toEqual({ avg: 10, pos: 25, neg: 15 });
    expect(covered.get("2026-10-13T00:00")?.p).toBe(10);
  });

  it("'last' gives the reading at the end of the bucket", () => {
    const { raw } = bucketCadenceForReport(series, () => 5, 1, "last", (ms, m) => istBucketKey(new Date(ms), m));
    expect(raw.get("2026-10-13T00:00")?.p).toEqual({ avg: 20, pos: 20, neg: 0 });
    expect(raw.get("2026-10-13T00:01")?.p).toEqual({ avg: 50, pos: 50, neg: 0 });
  });

  it("never counts more seconds than the bucket holds", () => {
    const { covered } = bucketCadenceForReport(series, () => 60, 1, "avg", (ms, m) => istBucketKey(new Date(ms), m));
    expect(covered.get("2026-10-13T00:00")?.p).toBe(60);
  });
});
