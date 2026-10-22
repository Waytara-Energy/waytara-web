import { describe, expect, it } from "vitest";
import { navFeatures, visibleNavItems } from "./nav-config";

const inverter = { deviceType: { category: "solar_inverter" } };
const charger = { deviceType: { category: "ev_charger" } };
const labels = (f: Record<string, boolean>) => visibleNavItems(f).map((i) => i.label);

describe("the menu's charging pages", () => {
  it("appear only while the selected site has an EV charger", () => {
    expect(labels(navFeatures({}, [inverter, charger]))).toContain("Charging sessions");
    expect(labels(navFeatures({}, [inverter]))).not.toContain("Charging sessions");
    expect(labels(navFeatures({}, []))).not.toContain("Charging sessions");
  });

  it("follow the selected site, not the customer's other sites, and not the plan", () => {
    // a plan that lists the feature does not show the page for a site without a charger
    expect(navFeatures({ ev_sessions: true }, [inverter]).ev_sessions).toBe(false);
    // a plan that does not list it still shows the page for a site with a charger
    expect(navFeatures({ ev_sessions: false }, [charger]).ev_sessions).toBe(true);
  });

  it("keep the plan's other features as they are", () => {
    const f = navFeatures({ monitoring: true, reports: false }, [inverter]);
    expect(f.monitoring).toBe(true);
    expect(f.reports).toBe(false);
    expect(labels(f)).toContain("Monitoring");
    expect(labels(f)).not.toContain("Reports");
  });

  it("tolerate a device with no type", () => {
    expect(navFeatures(undefined, [{ deviceType: null }, {}]).ev_sessions).toBe(false);
  });
});

describe("the menu order", () => {
  it("puts Site directly under Maintenance, and the plan does not hide it", () => {
    const l = labels(navFeatures({}, [inverter]));
    expect(l.indexOf("Site")).toBe(l.indexOf("Maintenance") + 1);
    expect(l).toContain("Devices");
  });
});
