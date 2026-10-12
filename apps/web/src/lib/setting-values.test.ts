import { describe, expect, it } from "vitest";
import { hhmmToTime, parseBool, settingArea, settingStatus, timeToHhmm, toShownValue, toStoredValue, installedParts, settingsForInstalled } from "./setting-values";

const row = (value: string, source: string, ts: string) => ({ value, source, ts });

describe("settingStatus", () => {
  it("is unknown with no history", () => {
    expect(settingStatus([]).state).toBe("unknown");
  });
  it("trusts what the agent read from the inverter", () => {
    const s = settingStatus([row("1", "agent_initial_read", "2026-10-09T10:00:00Z")]);
    expect(s).toMatchObject({ state: "confirmed", value: "1" });
  });
  it("shows a request as pending until the inverter is read again", () => {
    const s = settingStatus([row("1", "agent_initial_read", "2026-10-09T10:00:00Z"), row("0", "customer_dashboard", "2026-10-09T11:00:00Z")]);
    expect(s).toMatchObject({ state: "pending", value: "0", deviceValue: "1" });
  });
  it("is confirmed when the inverter reads back what was asked", () => {
    const s = settingStatus([row("1", "agent_initial_read", "2026-10-09T10:00:00Z"), row("0", "customer_dashboard", "2026-10-09T11:00:00Z"), row("0", "agent_readback", "2026-10-09T11:00:20Z")]);
    expect(s).toMatchObject({ state: "confirmed", value: "0" });
  });
  it("is a mismatch when the inverter answers a request with something else", () => {
    const s = settingStatus([row("0", "customer_dashboard", "2026-10-09T11:00:00Z"), row("1", "agent_readback", "2026-10-09T11:00:20Z")]);
    expect(s).toMatchObject({ state: "mismatch", value: "1", deviceValue: "1" });
  });
  it("treats a later difference as a change made on the device, not a failed write", () => {
    const s = settingStatus([row("0", "customer_dashboard", "2026-10-09T11:00:00Z"), row("1", "agent_readback", "2026-10-09T14:00:00Z")]);
    expect(s.state).toBe("confirmed");
  });
  it("is unknown when only a request exists and no agent has ever read it", () => {
    expect(settingStatus([row("5", "customer_dashboard", "2026-10-09T11:00:00Z")]).state).toBe("pending");
  });
});

describe("values", () => {
  it("reads on and off however they were stored", () => {
    expect([parseBool("1"), parseBool("true"), parseBool("0"), parseBool("false"), parseBool("x"), parseBool(null)]).toEqual([true, true, false, false, null, null]);
  });
  it("turns hour-and-minute digits into a time and back", () => {
    expect([hhmmToTime("100"), hhmmToTime("1730"), hhmmToTime("0"), hhmmToTime("2400"), hhmmToTime("175"), hhmmToTime(null)]).toEqual(["01:00", "17:30", "00:00", null, null, null]);
    expect([timeToHhmm("01:00"), timeToHhmm("17:30"), timeToHhmm("00:00"), timeToHhmm("25:00")]).toEqual(["100", "1730", "0", null]);
  });
  it("saves in the form the agent understands and shows in the form people read", () => {
    expect(toStoredValue("bool", "true")).toBe("true");
    expect(toStoredValue("bool", "1")).toBe("true");
    expect(toStoredValue("time", "13:00")).toBe("1300");
    expect(toStoredValue("number", "40")).toBe("40");
    expect(toShownValue("bool", "1")).toBe("true");
    expect(toShownValue("time", "1300")).toBe("13:00");
    expect(toShownValue("number", "40")).toBe("40");
    expect(toShownValue("number", null)).toBe("");
  });
});

describe("settingArea", () => {
  it("puts each setting on the page of the inverter menu that holds it", () => {
    expect(settingArea("Energy mode", "solar_sell_enabled")).toBe("work_mode");
    expect(settingArea("Energy mode", "energy_priority_mode")).toBe("work_mode");
    expect(settingArea("Energy mode", "battery_low_soc_pct")).toBe("battery");
    expect(settingArea("Grid charging", "grid_charge_enabled")).toBe("battery");
    expect(settingArea("Generator charging", "generator_charge_enabled")).toBe("battery");
    expect(settingArea("Smart load", "smart_load_on_soc_pct")).toBe("gen_port");
    expect(settingArea("Time of Use", "time_of_use_enabled")).toBe("work_mode");
    expect(settingArea("Grid peak shaving", "grid_peak_shaving_enabled")).toBe("work_mode");
    expect(settingArea("Preferences", "inverter_beep_enabled")).toBe("basic");
    expect(settingArea("Preferences", "low_noise_mode_enabled")).toBe("advanced");
    expect(settingArea("Account", "import_tariff_per_kwh")).toBe("account");
  });
});

describe("settings of equipment that is not installed", () => {
  const fields = [
    { key: "grid_charge_enabled", area: "battery" as const },
    { key: "generator_charge_enabled", area: "battery" as const },
    { key: "smart_load_on_soc_pct", area: "gen_port" as const },
    { key: "solar_sell_enabled", area: "work_mode" as const },
    { key: "time_of_use_slot1_generator_charge_enabled", area: "work_mode" as const },
  ];

  it("reads what is installed from the categories of the parts", () => {
    expect(installedParts(["Solar Panels", "Batteries"])).toEqual({ generator: false, battery: true });
    expect(installedParts(["Generators"])).toEqual({ generator: true, battery: false });
    expect(installedParts([null])).toEqual({ generator: false, battery: false });
  });

  it("leaves out generator settings without a generator and battery settings without a battery", () => {
    expect(settingsForInstalled(fields, { generator: false, battery: true }).map((f) => f.key)).toEqual(["grid_charge_enabled", "solar_sell_enabled"]);
    expect(settingsForInstalled(fields, { generator: true, battery: false }).map((f) => f.key)).toEqual(["smart_load_on_soc_pct", "solar_sell_enabled", "time_of_use_slot1_generator_charge_enabled"]);
    expect(settingsForInstalled(fields, { generator: true, battery: true })).toHaveLength(5);
  });
});
