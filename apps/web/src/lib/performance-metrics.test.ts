import { describe, expect, it } from "vitest";
import {
  averageBetweenHours,
  homeSupply,
  pct,
  pvImbalance,
  roundTripPct,
  selfConsumptionPct,
  selfSufficiencyPct,
  solarInsights,
  solarSplit,
  type DayRow,
} from "./performance-metrics";

const days = (kwhs: number[], inputs: [number, number] = [0, 0]): DayRow[] =>
  kwhs.map((kwh, i) => ({ day: `2026-09-${String(i + 1).padStart(2, "0")}`, kwh, inputs: inputs[0] ? [kwh * inputs[0], kwh * inputs[1]] : [kwh / 2, kwh / 2] }));

describe("ratios from the lifetime counters", () => {
  it("self-consumption and self-sufficiency match the figures worked out by hand for the live device", () => {
    expect(selfConsumptionPct(127.5, 116.3)).toBeCloseTo(8.8, 1);
    expect(selfSufficiencyPct(12.6, 7.6)).toBeCloseTo(39.7, 1);
  });

  it("say nothing when there is nothing to divide by", () => {
    expect(pct(1, 0)).toBeNull();
    expect(selfConsumptionPct(0, 0)).toBeNull();
    expect(selfSufficiencyPct(null, 3)).toBeNull();
  });

  it("never go below 0 or above 100", () => {
    expect(selfConsumptionPct(10, 12)).toBe(0);
    expect(selfSufficiencyPct(10, 0)).toBe(100);
  });

  it("round-trip efficiency waits until the battery has really cycled", () => {
    expect(roundTripPct(15.9, 6.6)).toBeCloseTo(41.5, 1);   // 15.9 kWh in is above the 5 kWh floor...
    expect(roundTripPct(3, 2)).toBeNull();                 // ...but this battery has hardly been used
    expect(roundTripPct(100, 120)).toBe(100);
  });
});

describe("where the energy went / came from", () => {
  it("splits the solar energy into grid, battery and home, never more than was produced", () => {
    const s = solarSplit(127.5, 116.3, 15.9)!;
    expect(s.map((x) => x.label)).toEqual(["Sent to the grid", "Stored in the battery", "Used at home"]);
    expect(s[0].kwh).toBeCloseTo(116.3);
    expect(s[1].kwh).toBeCloseTo(11.2);                      // only what is left after the export
    expect(s[2].kwh).toBeCloseTo(0);
    expect(s.reduce((a, b) => a + b.kwh, 0)).toBeCloseTo(127.5);
    expect(solarSplit(0, 0, 0)).toBeNull();
  });

  it("splits the home's energy into solar, battery and grid", () => {
    const h = homeSupply(12.6, 7.6, 6.6)!;
    expect(h.map((x) => x.label)).toEqual(["Solar", "Battery", "Grid"]);
    expect(h[2].kwh).toBeCloseTo(7.6);
    expect(h[1].kwh).toBeCloseTo(5.0);                       // capped by what the grid left to supply
    expect(h[0].kwh).toBeCloseTo(0);
    expect(homeSupply(null, 1, 1)).toBeNull();
  });
});

describe("pvImbalance", () => {
  it("names the weaker input and the gap", () => {
    expect(pvImbalance(8, 10)).toEqual({ weaker: 1, gapPct: 20 });
    expect(pvImbalance(10, 8)?.weaker).toBe(2);
    expect(pvImbalance(10, 10)).toEqual({ weaker: null, gapPct: 0 });
  });
  it("needs both inputs to have produced something", () => {
    expect(pvImbalance(0.2, 10)).toBeNull();
    expect(pvImbalance(null, 10)).toBeNull();
  });
});

describe("solarInsights", () => {
  const base = { tariffPerKwh: 8, hottestRatio: null };

  it("says it is still learning in the first week and makes no dust claim", () => {
    const out = solarInsights({ ...base, days: days([30, 31]) });
    expect(out[0]).toMatchObject({ id: "learning", tone: "info" });
    expect(out[0].title).toContain("2 of 7");
    expect(out.find((i) => i.id === "soiling")).toBeUndefined();
  });

  it("recommends cleaning when the best recent days fall well below the earlier best", () => {
    const kwhs = [40, 38, 41, 39, 40, 42, 41, 40, 39, 41, 40, 41, 40, 39, 36, 35, 34];
    const out = solarInsights({ ...base, days: days(kwhs) });
    const soiling = out.find((i) => i.id === "soiling")!;
    expect(soiling.tone).toBe("warn");
    expect(soiling.title).toMatch(/cleaning/i);
    expect(soiling.body).toMatch(/dry and sunny/);
  });

  it("is not fooled by a cloudy day or two: the best recent day still matches", () => {
    const kwhs = [40, 38, 41, 39, 40, 42, 41, 40, 39, 41, 40, 41, 40, 39, 41, 18, 22];
    const soiling = solarInsights({ ...base, days: days(kwhs) }).find((i) => i.id === "soiling")!;
    expect(soiling.tone).toBe("good");
  });

  it("a small dip is only worth watching", () => {
    const earlier = [40, 38, 41, 39, 40, 42, 41, 40, 39, 41, 40, 41, 40, 39];
    const tone = (recent: number[]) => solarInsights({ ...base, days: days([...earlier, ...recent]) }).find((i) => i.id === "soiling")!.tone;
    expect(tone([41, 40, 39])).toBe("good");              // best of the last 3 days is within 3% of 42
    expect(tone([40.5, 40, 39])).toBe("info");            // 3.6% below
    expect(tone([38, 37, 36])).toBe("warn");              // 9.5% below
  });

  it("flags a PV input that makes much less than the other", () => {
    const out = solarInsights({ ...base, days: days([30, 30, 30, 30, 30, 30, 30], [0.5, 0.35]) });
    const i = out.find((x) => x.id === "imbalance")!;
    expect(i.tone).toBe("warn");
    expect(i.title).toMatch(/PV2 is producing 30% less than PV1/);
  });

  it("reports balanced inputs as good news", () => {
    const i = solarInsights({ ...base, days: days([30, 30, 30, 30, 30, 30, 30], [0.5, 0.48]) }).find((x) => x.id === "imbalance")!;
    expect(i.tone).toBe("good");
  });

  it("warns about a hot inverter, and not about a cool one", () => {
    const hot = solarInsights({ ...base, days: days([30]), hottestRatio: 0.95 }).find((i) => i.id === "heat");
    expect(hot?.tone).toBe("warn");
    expect(solarInsights({ ...base, days: days([30]), hottestRatio: 0.82 }).find((i) => i.id === "heat")?.tone).toBe("info");
    expect(solarInsights({ ...base, days: days([30]), hottestRatio: 0.5 }).find((i) => i.id === "heat")).toBeUndefined();
  });
});

describe("averageBetweenHours", () => {
  const H = 3_600_000;
  const axis = Array.from({ length: 96 }, (_, i) => i * 900_000);
  it("averages the readings inside the hours only", () => {
    const values = axis.map((t) => (t >= 2 * H && t < 4 * H ? 100 : 900));
    expect(averageBetweenHours(axis, values, 0, 2, 4)).toBe(100);
  });
  it("ignores missing readings and gives null when there are none", () => {
    const values = axis.map((t) => (t === 2 * H ? 50 : null));
    expect(averageBetweenHours(axis, values, 0, 2, 4)).toBe(50);
    expect(averageBetweenHours(axis, axis.map(() => null), 0, 2, 4)).toBeNull();
  });
});
