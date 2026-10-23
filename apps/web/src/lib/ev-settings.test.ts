import { describe, expect, it } from "vitest";
import { CONFIG_KEYS, CONFIG_KEY_NAMES, configStatusText, formatFrame, isLogDay, isStaffRole, shownValue, utcDay, validateConfigValue, wsAddress } from "./ev-settings";

describe("the settings that can be changed", () => {
  it("are exactly the six the service allows", () => {
    expect(CONFIG_KEY_NAMES).toEqual(["HeartbeatInterval", "MeterValueSampleInterval", "ClockAlignedDataInterval", "ConnectionTimeOut", "MeterValuesSampledData", "StopTransactionOnEVSideDisconnect"]);
    expect(CONFIG_KEYS.every((k) => k.label && k.help)).toBe(true);
  });
});

describe("validateConfigValue", () => {
  it("takes whole seconds in range and trims", () => {
    expect(validateConfigValue("HeartbeatInterval", " 30 ")).toEqual({ ok: true, value: "30" });
    expect(validateConfigValue("ClockAlignedDataInterval", "0")).toEqual({ ok: true, value: "0" });
  });
  it("refuses numbers out of range, decimals and words", () => {
    expect(validateConfigValue("HeartbeatInterval", "2")).toMatchObject({ ok: false });
    expect(validateConfigValue("HeartbeatInterval", "99999")).toMatchObject({ ok: false });
    expect(validateConfigValue("MeterValueSampleInterval", "10.5")).toMatchObject({ ok: false });
    expect(validateConfigValue("ConnectionTimeOut", "soon")).toMatchObject({ ok: false });
  });
  it("turns on/off words into true/false", () => {
    expect(validateConfigValue("StopTransactionOnEVSideDisconnect", "On")).toEqual({ ok: true, value: "true" });
    expect(validateConfigValue("StopTransactionOnEVSideDisconnect", "0")).toEqual({ ok: true, value: "false" });
    expect(validateConfigValue("StopTransactionOnEVSideDisconnect", "maybe")).toMatchObject({ ok: false });
  });
  it("checks a list of readings", () => {
    expect(validateConfigValue("MeterValuesSampledData", "Energy.Active.Import.Register, Power.Active.Import")).toEqual({ ok: true, value: "Energy.Active.Import.Register,Power.Active.Import" });
    expect(validateConfigValue("MeterValuesSampledData", "")).toMatchObject({ ok: false });
    expect(validateConfigValue("MeterValuesSampledData", "Voltage;Current")).toMatchObject({ ok: false });
  });
  it("refuses a setting that is not in the list", () => {
    expect(validateConfigValue("AuthorizationKey", "x")).toMatchObject({ ok: false });
  });
});

describe("the charger's answer in words", () => {
  it("separates saved from refused", () => {
    expect(configStatusText("Accepted")).toMatchObject({ ok: true });
    expect(configStatusText("RebootRequired")).toMatchObject({ ok: true, text: expect.stringContaining("restarts") });
    expect(configStatusText("Rejected").ok).toBe(false);
    expect(configStatusText("NotSupported").text).toMatch(/does not have/);
    expect(configStatusText("Weird").text).toContain("Weird");
  });
  it("shows a value with its unit", () => {
    const hb = CONFIG_KEYS[0]!;
    expect(shownValue(hb, "30")).toBe("30 s");
    expect(shownValue(hb, null)).toBe("—");
    expect(shownValue(CONFIG_KEYS[5]!, "true")).toBe("On");
  });
});

describe("the address", () => {
  it("is the unit's own network, the port and the charger's name", () => {
    expect(wsAddress("WT-05D0")).toBe("ws://192.168.4.1:8080/ocpp/WT-05D0");
  });
});

describe("formatFrame", () => {
  const at = "2026-10-24T10:00:00.000Z";
  it("reads a boot, a status, a meter reading and a heartbeat", () => {
    expect(formatFrame({ at, direction: "in", frame: JSON.stringify([2, "1", "BootNotification", { chargePointVendor: "Plugzmart", chargePointModel: "7.4kW", firmwareVersion: "2.2.7" }]) })).toMatchObject({ action: "BootNotification", summary: "Plugzmart 7.4kW fw 2.2.7", kind: "call" });
    expect(formatFrame({ at, direction: "in", frame: JSON.stringify([2, "2", "StatusNotification", { connectorId: 1, status: "Charging", errorCode: "NoError" }]) }).summary).toBe("connector 1: Charging");
    expect(formatFrame({ at, direction: "in", frame: JSON.stringify([2, "3", "Heartbeat", {}]) })).toMatchObject({ action: "Heartbeat", summary: "" });
    const m = formatFrame({ at, direction: "in", frame: JSON.stringify([2, "4", "MeterValues", { meterValue: [{ sampledValue: [{ measurand: "Power.Active.Import", value: "6.9", unit: "kW" }, { measurand: "Voltage", value: "231", unit: "V" }] }] }]) });
    expect(m.summary).toBe("Power 6.9 kW, Voltage 231 V");
  });
  it("reads answers and errors", () => {
    expect(formatFrame({ at, direction: "out", frame: JSON.stringify([3, "1", { status: "Accepted" }]) })).toMatchObject({ action: "Answer", summary: "Accepted", direction: "out", kind: "answer" });
    expect(formatFrame({ at, direction: "out", frame: JSON.stringify([4, "1", "NotImplemented", ""]) })).toMatchObject({ action: "Error", summary: "NotImplemented", kind: "error" });
  });
  it("shows anything else as it is, cut short", () => {
    expect(formatFrame({ at, direction: "in", frame: "not json at all" })).toMatchObject({ action: "Message", kind: "other" });
    expect(formatFrame({ at, direction: "in", frame: JSON.stringify([2, "9", "DataTransfer", { vendorId: "x".repeat(200) }]) }).summary.length).toBeLessThanOrEqual(90);
  });
});

describe("staff", () => {
  it("are admin, employee and installer, not a customer", () => {
    expect(["admin", "employee", "site_engineer"].every(isStaffRole)).toBe(true);
    expect(isStaffRole("customer")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
  });
});

describe("log days", () => {
  it("names the UTC day and checks one", () => {
    expect(utcDay(Date.parse("2026-10-24T23:30:00Z"))).toBe("2026-10-24");
    expect(isLogDay("2026-10-24")).toBe(true);
    expect(isLogDay("24-10-2026")).toBe(false);
    expect(isLogDay("2026-13-45")).toBe(false);
  });
});
