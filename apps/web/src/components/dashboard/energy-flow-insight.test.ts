import { describe, expect, it } from "vitest";
import { insightFor, loadSupply, type FlowReadings } from "./energy-flow-insight";

const base: FlowReadings = { solarW: 2283, batteryW: -143, gridW: -2414, loadW: 35, evW: null, pvInputs: [{ label: "PV1", watts: 0 }, { label: "PV2", watts: 2283 }] };
const with_ = (over: Partial<FlowReadings>): FlowReadings => ({ ...base, ...over });

describe("loadSupply", () => {
  it("fills the load from solar first, then the battery, then the grid", () => {
    expect(loadSupply(with_({ loadW: 1000, solarW: 600, batteryW: -300, gridW: 100 }))).toEqual({ solar: 60, battery: 30, grid: 10 });
    expect(loadSupply(with_({ loadW: 35 }))).toEqual({ solar: 100, battery: 0, grid: 0 });
  });
  it("is null when nothing is using power", () => {
    expect(loadSupply(with_({ loadW: 0 }))).toBeNull();
  });
});

describe("insightFor", () => {
  it("solar: how much of the load it covers, with its inputs", () => {
    const i = insightFor("solar", base);
    expect(i.headline).toBe("Covers all of your load");
    expect(i.rows).toEqual([{ label: "PV1", value: "0.00 kW" }, { label: "PV2", value: "2.28 kW" }]);
    expect(insightFor("solar", with_({ loadW: 4566 })).headline).toBe("Covers 50% of your load");
    expect(insightFor("solar", with_({ solarW: 0 })).headline).toMatch(/Not generating/);
  });

  it("load: where the power comes from", () => {
    const i = insightFor("home", with_({ loadW: 1000, solarW: 600, batteryW: -300, gridW: 100 }));
    expect(i.rows).toEqual([{ label: "Solar", value: "60%" }, { label: "Battery", value: "30%" }, { label: "Grid", value: "10%" }]);
    expect(insightFor("home", with_({ loadW: 0 })).headline).toMatch(/Nothing is using/);
  });

  it("grid: how much solar is sold, or how much of the load it supplies", () => {
    expect(insightFor("grid", base).headline).toBe("100% of your solar is being sold to the grid");
    expect(insightFor("grid", with_({ solarW: 0, gridW: 800, loadW: 1000 })).headline).toBe("The grid is supplying 80% of your load");
    expect(insightFor("grid", with_({ gridW: 0 })).headline).toMatch(/Not exchanging/);
  });

  it("battery: what it is doing for the site", () => {
    expect(insightFor("battery", with_({ batteryW: -500, loadW: 1000 })).headline).toBe("Covering 50% of your load");
    expect(insightFor("battery", with_({ batteryW: 500, solarW: 3000, loadW: 1000 })).headline).toBe("Storing your surplus solar");
    expect(insightFor("battery", with_({ batteryW: 0 })).headline).toBe("Holding its charge");
  });
});
