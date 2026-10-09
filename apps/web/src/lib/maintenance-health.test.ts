import { describe, expect, it } from "vitest";
import { alreadyReported, buildHealthChecks, checkReportTag, checkReportText, faultReportText, problemCount, verdictOf } from "./maintenance-health";

const readings = (r: Record<string, number | null>) => (key: string) => r[key] ?? null;
const ids = (checks: { id: string }[]) => checks.map((c) => c.id);

describe("buildHealthChecks", () => {
  it("is a short, all-fine list for a healthy system", () => {
    const checks = buildHealthChecks({ connection: "online", faultCode: null, value: readings({ battery_temperature_c: 30, inverter_dc_temperature_c: 50, battery_alarm: 0, battery_fault: 0, grid_phase_error: 0, clock_out_of_sync: 0 }) });
    expect(ids(checks)).toEqual(["connection", "fault", "temperature", "battery"]);
    expect(checks.every((c) => c.state === "ok")).toBe(true);
    expect(verdictOf("online", checks)).toBe("good");
  });

  it("leaves out the battery row when the device does not report a battery alarm at all", () => {
    expect(ids(buildHealthChecks({ connection: "online", faultCode: null, value: readings({}) }))).toEqual(["connection", "fault", "temperature"]);
  });

  it("explains a fault in words and treats a critical one as a problem", () => {
    const checks = buildHealthChecks({ connection: "online", faultCode: 13, value: readings({}) });
    const fault = checks.find((c) => c.id === "fault")!;
    expect(fault.state).not.toBe("ok");
    expect(fault.detail).toMatch(/F13/);
    expect(verdictOf("online", checks)).toBe("attention");
  });

  it("flags a sensor near its limit as a heads-up and past it as a problem", () => {
    const warm = buildHealthChecks({ connection: "online", faultCode: null, value: readings({ battery_temperature_c: 40 }) }).find((c) => c.id === "temperature")!;
    expect(warm.state).toBe("warn");
    const hot = buildHealthChecks({ connection: "online", faultCode: null, value: readings({ inverter_dc_temperature_c: 80 }) }).find((c) => c.id === "temperature")!;
    expect(hot.state).toBe("bad");
    expect(hot.detail).toMatch(/DC/);
  });

  it("shows wiring and clock rows only when wrong", () => {
    const checks = buildHealthChecks({ connection: "online", faultCode: null, value: readings({ grid_phase_error: 1, clock_out_of_sync: 1 }) });
    expect(ids(checks)).toEqual(expect.arrayContaining(["grid-phase", "clock"]));
    expect(ids(checks)).not.toContain("generator-phase");
  });

  it("tells a lost connection from a silent unit, and calls either not reporting", () => {
    expect(buildHealthChecks({ connection: "connection_lost", faultCode: null, value: readings({}) })[0].detail).toMatch(/inverter/);
    expect(buildHealthChecks({ connection: "offline", faultCode: null, value: readings({}) })[0].detail).toMatch(/internet/);
    expect(verdictOf("offline", buildHealthChecks({ connection: "offline", faultCode: null, value: readings({}) }))).toBe("offline");
  });

  it("counts what is not fine", () => {
    const checks = buildHealthChecks({ connection: "online", faultCode: 13, value: readings({ clock_out_of_sync: 1 }) });
    expect(problemCount(checks)).toBe(2);
  });
});

describe("reporting what the page shows", () => {
  it("starts a fault report with the code and what it means", () => {
    const text = faultReportText("F58", "BMS communication fault", "The inverter lost its data link.");
    expect(text).toMatch(/^Fault F58 BMS communication fault/);
    expect(text).toMatch(/troubleshooting guide/);
  });
  it("tags a check report so the same one is not offered twice", () => {
    expect(checkReportText("Connection", "Nothing is arriving.").startsWith(checkReportTag("Connection"))).toBe(true);
  });
  it("knows a fault or check is already reported while its request is open", () => {
    const open = [faultReportText("F58", "BMS communication fault", "x"), checkReportText("Connection", "y")];
    expect(alreadyReported(open, "Fault F58 ")).toBe(true);
    expect(alreadyReported(open, checkReportTag("Connection"))).toBe(true);
    expect(alreadyReported(open, "Fault F13 ")).toBe(false);
    expect(alreadyReported([], "Fault F58 ")).toBe(false);
  });
});
