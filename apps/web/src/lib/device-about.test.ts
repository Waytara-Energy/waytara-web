import { describe, expect, it } from "vitest";
import { aboutPages, inverterAbout, partAbout, readingText, warranty, type ChildView } from "./device-about";
import type { CustomerDevice } from "./device-display";

const NOW = new Date("2026-10-12T10:00:00Z");

const device: CustomerDevice = {
  id: "d1",
  label: "Roof inverter",
  deviceStatus: "active",
  createdAt: "2026-01-01",
  installedAt: "2026-03-01",
  warrantyStartDate: "2026-03-01",
  warrantyEndDate: "2031-03-01",
  serviceId: null,
  deviceType: { id: "t1", category: "solar_inverter", name: "Deye 8kW Hybrid Inverter", manufacturer: "Deye Inverter", brand: "Deye", model: "SUN-8K", serialNumber: "DY-INV-2026-9811", modelNumber: "SUN-8K-SG01LP1-EU" },
};

const panels: ChildView = {
  id: "p1", label: "Roof panels", quantity: 12, installedAt: "2026-03-01", warrantyEndDate: "2036-03-01", category: "Solar Panels", name: "550W Mono PERC Bifacial Solar Panel", manufacturer: "Canadian Solar", brand: "Canadian",
  model: null, modelNumber: "CS6W-550MB-AG", serialNumber: null, powerValue: 550, powerUnit: "W", specs: { efficiency_pct: 21.3, cell_type: "Mono PERC", voc_v: 49.7 },
};

describe("readingText", () => {
  it("reads numbers plainly and drops empty or zero readings", () => {
    expect(readingText("2.0")).toBe("2");
    expect(readingText(8000, "W")).toBe("8,000 W");
    expect(readingText("0.0")).toBeNull();
    expect(readingText(null)).toBeNull();
    expect(readingText("")).toBeNull();
    expect(readingText("V1.2")).toBe("V1.2");
  });
});

describe("warranty", () => {
  it("says how long is left, or that it has ended", () => {
    expect(warranty("2031-03-01", NOW).line).toBe("Until 1 Mar 2031 (4 years 4 months left)");
    expect(warranty("2031-03-01", NOW).badge?.tone).toBe("good");
    expect(warranty("2026-01-01", NOW).badge).toEqual({ label: "Warranty ended", tone: "warn" });
    expect(warranty(null, NOW)).toEqual({ line: null, short: null, badge: null });
  });
});

describe("inverterAbout", () => {
  const readings = new Map<string, string | number | null>([["rated_power_w", "8000.0"], ["mppt_count", "2.0"], ["phase_count", "1.0"], ["control_board_firmware_version", "21384.0"], ["battery_firmware_version", "0.0"]]);
  const page = inverterAbout(device, { ip_rating: "IP65", max_pv_input_kw: 10.4, mppt_count: 2, phase: 1 }, { value: null, unit: null }, readings, NOW);

  it("names the device, its maker and cover", () => {
    expect(page.title).toBe("Roof inverter");
    expect(page.subtitle).toBe("Deye · SUN-8K");
    expect(page.menuLabel).toBe("Inverter");
    expect(page.badges).toEqual([{ label: "In warranty", tone: "good" }]);
  });

  it("lists the facts in blocks, without repeating a spec the reading also gives", () => {
    const about = page.sections.find((s) => s.title === "About")!;
    expect(about.rows).toContainEqual(["Serial number", "DY-INV-2026-9811"]);
    const power = page.sections.find((s) => s.title === "Power and inputs")!;
    expect(power.rows[0]).toEqual(["Rated power", "8,000 W"]);
    expect(power.rows.filter(([l]) => l === "Solar inputs (MPPT)")).toHaveLength(1);
    expect(power.rows).toContainEqual(["Largest solar input", "10.4 kW"]);
    const software = page.sections.find((s) => s.title === "Software")!;
    expect(software.rows).toContainEqual(["Control board", "21384"]);
    expect(software.rows.find(([l]) => l === "Battery")?.[1]).toBeNull();
  });
});

describe("partAbout", () => {
  it("sums an array of panels", () => {
    const page = partAbout(panels, false, NOW);
    expect(page.menuLabel).toBe("Solar panels");
    expect(page.kind).toBe("panel");
    const array = page.sections.find((s) => s.title === "Array")!;
    expect(array.rows).toEqual([["Panels", "12"], ["Power of each panel", "550 W"], ["Together", "6.60 kWp"]]);
    expect(page.sections.find((s) => s.title === "Electrical")!.rows).toContainEqual(["Efficiency", "21.3 %"]);
  });

  it("tells two parts of one kind apart in the menu", () => {
    expect(partAbout(panels, true, NOW).menuLabel).toBe("Solar panels · Roof panels");
  });
});

describe("aboutPages", () => {
  it("is the device first, then each part", () => {
    const pages = aboutPages(device, null, { value: null, unit: null }, new Map(), [panels], NOW);
    expect(pages.map((p) => p.id)).toEqual(["device", "part-p1"]);
  });
});

describe("power package", () => {
  it("shows the package and what it includes in the device's page", () => {
    const page = inverterAbout(device, null, { value: null, unit: null }, new Map(), NOW, { label: "Solar + Battery + Inverter", includes: ["Solar panels", "Battery", "Inverter"] });
    expect(page.sections.find((s) => s.title === "Power package")?.rows).toEqual([["Package", "Solar + Battery + Inverter"], ["Includes", "Solar panels, Battery, Inverter"]]);
  });
  it("has an empty block (so it is not drawn) when the site has no package", () => {
    expect(inverterAbout(device, null, { value: null, unit: null }, new Map(), NOW).sections.find((s) => s.title === "Power package")?.rows).toEqual([]);
  });
});
