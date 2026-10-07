import { describe, expect, it } from "vitest";
import { fmtKw, lineWidth, summarize } from "./energy-flow-summary";

describe("fmtKw", () => {
  it("always shows kW with two decimals, like the cards", () => {
    expect(fmtKw(6500)).toBe("6.50 kW");
    expect(fmtKw(93)).toBe("0.09 kW");
    expect(fmtKw(-6400)).toBe("6.40 kW");
    expect(fmtKw(0)).toBe("0.00 kW");
    expect(fmtKw(null)).toBe("—");
  });
});

describe("lineWidth", () => {
  it("grows with power and stops growing at 10 kW", () => {
    expect(lineWidth(0)).toBe(1.5);
    expect(lineWidth(5000)).toBeCloseTo(3, 5);
    expect(lineWidth(10_000)).toBe(4.5);
    expect(lineWidth(40_000)).toBe(4.5);
  });
});

describe("summarize", () => {
  it("says so when the device is offline, whatever the last readings were", () => {
    expect(summarize(6500, 129, -6400, 93, true)).toEqual({ mode: "Offline", text: "Device offline - no live readings" });
  });

  it("exporting to the grid", () => {
    expect(summarize(6500, 129, -6400, 93)).toEqual({ mode: "Exporting", text: "Exporting 6.40 kW to the grid · Solar covers 100% of load" });
  });

  it("importing from the grid at night", () => {
    expect(summarize(0, -300, 2400, 2700)).toEqual({ mode: "Importing", text: "Importing 2.40 kW from the grid · Solar covers 0% of load" });
  });

  it("running on battery, then on solar, then idle", () => {
    expect(summarize(0, -1200, 0, 1200).mode).toBe("Battery");
    expect(summarize(3000, 0, 0, 900).mode).toBe("Solar");
    expect(summarize(0, 0, 0, 0)).toEqual({ mode: "Idle", text: "System idle" });
  });
});
