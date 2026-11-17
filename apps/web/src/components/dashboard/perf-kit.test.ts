import { describe, expect, it } from "vitest";
import { fmtNum, fmtPct } from "./perf-kit";

// A figure that is not there (yet) reads as 0, never as a dash.
describe("the Performance figures", () => {
  it("show 0 for a missing number, with the digits asked for", () => {
    expect(fmtNum(null)).toBe("0.0");
    expect(fmtNum(undefined, 2)).toBe("0.00");
    expect(fmtNum(Number.NaN, 0)).toBe("0");
    expect(fmtNum(3.14159, 2)).toBe("3.14");
  });
  it("show 0% for a missing percentage", () => {
    expect(fmtPct(null)).toBe("0%");
    expect(fmtPct(undefined)).toBe("0%");
    expect(fmtPct(Number.NaN)).toBe("0%");
    expect(fmtPct(62.4)).toBe("62%");
  });
  it("never produce a dash", () => {
    for (const v of [null, undefined, Number.NaN, Infinity]) {
      expect(fmtNum(v)).not.toContain("—");
      expect(fmtPct(v)).not.toContain("—");
    }
  });
});
