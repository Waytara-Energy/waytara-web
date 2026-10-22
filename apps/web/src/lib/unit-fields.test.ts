import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@waytara/supabase/server", () => ({ createClient: vi.fn() }));

import { convertibleFields } from "./unit-fields";

const row = (key: string, name: string, unit: string | null, category = "Battery", group: string | null = null, section: string | null = "Monitoring") => ({
  key_name: key,
  equipment_templates: { display_name: name, unit, category, group_name: group, dashboard_section: section },
});

describe("convertibleFields", () => {
  it("keeps readings in a unit that can be converted, once per key, sorted by kind then name", () => {
    const out = convertibleFields([
      row("battery_soc_pct", "Battery SOC", "%"),
      row("load_total_power_w", "Load power", "W", "Home Load"),
      row("battery_temperature_c", "Battery temperature", "°C"),
      row("load_total_power_w", "Load power again", "W", "Elsewhere"),
      row("day_pv_energy_kwh", "Solar today", "kWh", "Solar Array", null, "Overview"),
      row("no_unit", "No unit", null),
    ]);
    expect(out.map((f) => f.key)).toEqual(["day_pv_energy_kwh", "load_total_power_w", "battery_temperature_c"]);
    expect(out.map((f) => f.quantity)).toEqual(["energy", "power", "temperature"]);
    expect(out[1].label).toBe("Load power");
  });
  it("says where a reading is shown", () => {
    expect(convertibleFields([row("a_w", "A", "W", "Grid", "CT clamp", "Monitoring")])[0].where).toBe("Monitoring · CT clamp");
    expect(convertibleFields([row("a_w", "A", "W", "Grid", null, null)])[0].where).toBe("Grid");
  });
  it("is empty for nothing", () => {
    expect(convertibleFields([])).toEqual([]);
  });
});
