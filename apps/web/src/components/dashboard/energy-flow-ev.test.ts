import { describe, expect, it } from "vitest";
import { evLabel } from "./energy-flow-diagram";

describe("evLabel (the two lines under the charger's circle)", () => {
  it("shows the live power while charging, and the status with today's energy under it", () => {
    expect(evLabel(6900, "Charging", 3.24, true)).toEqual({ line1: "6.9 kW", line2: "Charging · 3.2 kWh today" });
  });

  it("shows the status when nothing is flowing", () => {
    expect(evLabel(0, "Available", 0, true)).toEqual({ line1: "Available", line2: "Available · 0.0 kWh today" });
    expect(evLabel(null, "Preparing", 1.5, true)).toEqual({ line1: "Preparing", line2: "Preparing · 1.5 kWh today" });
  });

  it("says Idle when the charger has no status yet, and leaves the energy out when it is not known", () => {
    expect(evLabel(null, null, null, true)).toEqual({ line1: "Idle", line2: "Idle" });
    expect(evLabel(0, "Finishing", null, null)).toEqual({ line1: "Finishing", line2: "Finishing" });
  });

  it("says Offline for a charger that is not connected, whatever else it knows", () => {
    expect(evLabel(6900, "Charging", 3.2, false)).toEqual({ line1: "Offline", line2: "Offline" });
  });

  it("writes the power the way the caller formats it", () => {
    expect(evLabel(7400, "Charging", 0.5, true, (w) => `${w} W`).line1).toBe("7400 W");
  });
});
