import { describe, expect, it } from "vitest";
import type { TemplateField } from "@/lib/template-field-format";
import { groupByPhase } from "./phase-meter-card";
import { groupByIndex } from "./indexed-group-card";

const f = (key: string, label = key): TemplateField => ({ key, label, unit: null, valueKind: "number", enumRef: null, source: null });

describe("groupByPhase", () => {
  it("groups L1/L2/L3 readings per measurement and keeps the rest separate", () => {
    const fields = [
      f("inverter_l1_power_w"), f("inverter_l2_power_w"), f("inverter_l3_power_w"),
      f("inverter_l1_voltage_v"), f("inverter_l2_voltage_v"), f("inverter_l3_voltage_v"),
      f("inverter_output_frequency_hz"),
    ];
    const g = groupByPhase(fields)!;
    expect(g.measurements.map((m) => m.key)).toEqual(["inverter::power_w", "inverter::voltage_v"]);
    expect(g.measurements[0].phases.map((p) => p.phase)).toEqual(["1", "2", "3"]);
    expect(g.restFields.map((x) => x.key)).toEqual(["inverter_output_frequency_hz"]);
  });

  it("does not mistake line-to-line readings for a phase", () => {
    expect(groupByPhase([f("inverter_l1_l2_voltage_v"), f("inverter_l2_l3_voltage_v")])).toBeNull();
  });

  it("needs at least two phases of one measurement", () => {
    expect(groupByPhase([f("inverter_l1_power_w"), f("other_l1_current_a")])).toBeNull();
  });

  it("handles the EV meter's reversed naming (current_import_l1_a)", () => {
    const g = groupByPhase([f("current_import_l1_a"), f("current_import_l2_a"), f("current_import_l3_a")])!;
    expect(g.measurements).toHaveLength(1);
    expect(g.measurements[0].phases).toHaveLength(3);
  });

  it("orders Power before Voltage before Current", () => {
    const g = groupByPhase([
      f("x_l1_current_a"), f("x_l2_current_a"),
      f("x_l1_voltage_v"), f("x_l2_voltage_v"),
      f("x_l1_power_w"), f("x_l2_power_w"),
    ])!;
    expect(g.measurements.map((m) => m.key.split("::")[1])).toEqual(["power_w", "voltage_v", "current_a"]);
  });
});

describe("groupByIndex", () => {
  it("groups numbered items (battery packs, PV strings)", () => {
    const g = groupByIndex([
      f("battery_pack1_voltage_v"), f("battery_pack1_soc_pct"),
      f("battery_pack2_voltage_v"), f("battery_pack2_soc_pct"),
    ])!;
    expect([...g.items.keys()]).toEqual([1, 2]);
    expect(g.items.get(1)!.map((x) => x.subKey)).toEqual(["_voltage_v", "_soc_pct"]);
  });

  it("returns null when a field has no index", () => {
    expect(groupByIndex([f("battery_pack1_voltage_v"), f("battery_total_kwh")])).toBeNull();
  });
});
