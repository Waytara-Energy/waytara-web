import { describe, expect, it } from "vitest";
import { ALERT_READING_KEYS, siteMetricValues } from "./alert-values";
import { buildAlertEmail } from "./alert-rule-mail";
import { METRICS, PRESETS, backInRange, conditionMet, decide, effectiveRules, formatLimit, formatMetricValue, metricOf, ruleSentence, type RuleRow } from "./alert-rules";

const row = (over: Partial<RuleRow>): RuleRow => ({ id: "r1", preset_id: null, name: null, metric: "battery_soc", op: "below", threshold: 25, site_id: null, notify_email: true, notify_app: true, cooldown_minutes: 60, enabled: true, ...over });

describe("the catalogue", () => {
  it("has unique ids, and every ready-made alert watches a known metric", () => {
    expect(new Set(METRICS.map((m) => m.id)).size).toBe(METRICS.length);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) expect(metricOf(p.metric), p.id).not.toBeNull();
  });
  it("covers battery, solar, grid, consumption and rate and cost, with some alerts on by default", () => {
    expect(new Set(METRICS.map((m) => m.group)).size).toBe(5);
    expect(PRESETS.filter((p) => p.defaultOn).map((p) => p.id)).toEqual(expect.arrayContaining(["battery_low", "battery_critical", "grid_import_high", "import_day_high", "cost_day_high"]));
  });
});

describe("effectiveRules", () => {
  it("offers every ready-made alert as WayTara set it up when the customer changed nothing", () => {
    const rules = effectiveRules([]);
    expect(rules).toHaveLength(PRESETS.length);
    const low = rules.find((r) => r.key === "preset:battery_low")!;
    expect(low).toMatchObject({ enabled: true, threshold: 20, untouched: true, email: true, app: true });
    expect(rules.find((r) => r.key === "preset:battery_full")!.enabled).toBe(false);
  });
  it("applies a customer's change to a ready-made alert (limit, switch, channels, cooldown)", () => {
    const rules = effectiveRules([row({ id: "p1", preset_id: "battery_low", threshold: 35, enabled: false, notify_email: false, cooldown_minutes: 15 })]);
    expect(rules.find((r) => r.key === "preset:battery_low")).toMatchObject({ enabled: false, threshold: 35, email: false, cooldownMinutes: 15, untouched: false, ruleId: "p1" });
    expect(rules.find((r) => r.key === "preset:battery_low")!.title).toBe("Battery level below 35%");
  });
  it("adds the customer's own alerts, ignoring rows with a bad direction or an unknown metric", () => {
    const rules = effectiveRules([row({ id: "c1", name: "Evening", metric: "load_kw", op: "above", threshold: 6 }), row({ id: "bad1", op: "sideways" }), row({ id: "bad2", metric: "nonsense" })]);
    expect(rules.filter((r) => r.ruleId && !r.presetId).map((r) => r.key)).toEqual(["rule:c1"]);
    expect(rules.find((r) => r.key === "rule:c1")!.title).toBe("Evening");
  });
  it("names an unnamed alert by its limit", () => {
    expect(effectiveRules([row({ id: "c2", metric: "import_cost_today", op: "above", threshold: 200 })]).find((r) => r.key === "rule:c2")!.title).toBe("Grid cost today above ₹200");
  });
});

describe("conditions", () => {
  it("compares strictly", () => {
    expect(conditionMet("below", 19, 20)).toBe(true);
    expect(conditionMet("below", 20, 20)).toBe(false);
    expect(conditionMet("above", 5.01, 5)).toBe(true);
    expect(conditionMet("above", 5, 5)).toBe(false);
  });
  it("needs a margin before an alert arms again", () => {
    expect(backInRange("battery_soc", "below", 20.5, 20)).toBe(false);
    expect(backInRange("battery_soc", "below", 21.5, 20)).toBe(true);
    expect(backInRange("grid_import_kw", "above", 4.95, 5)).toBe(false);
    expect(backInRange("grid_import_kw", "above", 4.8, 5)).toBe(true);
  });
});

describe("decide", () => {
  const rule = { metric: "battery_soc", op: "below" as const, threshold: 20, cooldownMinutes: 60 };
  const t = 10_000_000;
  it("fires once when the limit is crossed", () => {
    expect(decide(rule, 18, { active: false, lastFiredAt: null }, t)).toBe("fire");
    expect(decide(rule, 17, { active: true, lastFiredAt: t - 1000 }, t)).toBe("none");
  });
  it("waits out the cooldown before firing again", () => {
    expect(decide(rule, 18, { active: false, lastFiredAt: t - 30 * 60_000 }, t)).toBe("none");
    expect(decide(rule, 18, { active: false, lastFiredAt: t - 61 * 60_000 }, t)).toBe("fire");
  });
  it("arms again only once the value is back in range", () => {
    expect(decide(rule, 20.5, { active: true, lastFiredAt: t }, t)).toBe("none");
    expect(decide(rule, 25, { active: true, lastFiredAt: t }, t)).toBe("rearm");
  });
  it("does nothing without a reading", () => {
    expect(decide(rule, null, { active: false, lastFiredAt: null }, t)).toBe("none");
    expect(decide(rule, Number.NaN, { active: true, lastFiredAt: null }, t)).toBe("none");
  });
});

describe("wording", () => {
  it("writes limits and values with their units", () => {
    expect(ruleSentence("battery_soc", "below", 20)).toBe("Battery level below 20%");
    expect(ruleSentence("grid_import_kw", "above", 4.5)).toBe("Grid import power above 4.5 kW");
    expect(ruleSentence("tariff_rate", "above", 12)).toBe("Electricity rate above 12 ₹/kWh");
    expect(formatLimit(metricOf("import_cost_today")!, 150)).toBe("₹150");
    expect(formatMetricValue("battery_soc", 18.4)).toBe("18%");
    expect(formatMetricValue("solar_kw", 4.234)).toBe("4.2 kW");
    expect(formatMetricValue("import_cost_today", 182.6)).toBe("₹183");
  });
});

describe("siteMetricValues", () => {
  it("works out the metrics of one inverter", () => {
    const v = siteMetricValues([{ battery_soc_pct: 18, battery_power_w: -1500, pv1_power_w: 2000, pv2_power_w: 500, grid_total_power_w: 3000, load_total_power_w: 4200, day_pv_energy_kwh: 10, day_grid_import_energy_kwh: 5, day_grid_export_energy_kwh: 1, day_load_energy_kwh: 14, battery_temperature_c: 31 }], 8);
    expect(v).toMatchObject({ battery_soc: 18, battery_charge_kw: 1.5, battery_discharge_kw: 0, solar_kw: 2.5, grid_import_kw: 3, grid_export_kw: 0, load_kw: 4.2, solar_today_kwh: 10, import_today_kwh: 5, load_today_kwh: 14, tariff_rate: 8, import_cost_today: 40, solar_value_today: 80, battery_temp_c: 31 });
  });
  it("treats negative grid power as export and positive battery power as discharge", () => {
    const v = siteMetricValues([{ grid_total_power_w: -2000, battery_power_w: 1200 }], null);
    expect(v.grid_export_kw).toBe(2);
    expect(v.grid_import_kw).toBe(0);
    expect(v.battery_discharge_kw).toBe(1.2);
    expect(v.import_cost_today).toBeNull();
  });
  it("adds several inverters, averages the battery level and takes the hottest battery", () => {
    const v = siteMetricValues([{ battery_soc_pct: 20, load_total_power_w: 1000, battery_temperature_c: 30 }, { battery_soc_pct: 40, load_total_power_w: 500, battery_temperature_c: 41 }], 8);
    expect(v.battery_soc).toBe(30);
    expect(v.load_kw).toBe(1.5);
    expect(v.battery_temp_c).toBe(41);
  });
  it("leaves a metric empty when nothing reports it, and falls back to the AC output without PV inputs", () => {
    const v = siteMetricValues([{ inverter_output_power_w: 3000 }], 8);
    expect(v.solar_kw).toBe(3);
    expect(v.battery_soc).toBeNull();
    expect(v.load_kw).toBeNull();
  });
  it("asks for the keys it uses", () => {
    expect(ALERT_READING_KEYS).toEqual(expect.arrayContaining(["battery_soc_pct", "pv1_power_w", "pv8_power_w", "day_pv_energy_kwh"]));
  });
});

describe("buildAlertEmail", () => {
  const a = { title: "Battery level below 20%", metricLabel: "Battery level", valueText: "18%", limitText: "below 20%", siteName: "Villa", severity: "warning" as const };
  const base = { name: "Asha Rao", dashboardUrl: "https://app.example/dashboard", settingsUrl: "https://app.example/dashboard/settings#notifications" };
  it("names a single alert in the subject and lists what happened", () => {
    const m = buildAlertEmail({ ...base, alerts: [a] });
    expect(m.subject).toBe("Your alert: Battery level below 20%");
    expect(m.text).toContain("Battery level is 18% (below 20%), Villa");
    expect(m.html).toContain("Hi Asha,");
  });
  it("counts several alerts, and does not let text break the HTML", () => {
    const m = buildAlertEmail({ ...base, name: "<b>x</b>", alerts: [a, { ...a, metricLabel: "<i>Load</i>" }] });
    expect(m.subject).toBe("2 of your alerts went off");
    expect(m.html).not.toContain("<i>Load</i>");
    expect(m.html).not.toContain("<b>x</b>");
  });
});
