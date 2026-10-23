import { describe, expect, it } from "vitest";
import { nextSteps, profileCompleteness, securityScore, type HealthInput } from "./account-health";

const base: HealthInput = { hasPhoto: false, hasName: true, hasPhone: false, hasAddress: false, hasBillingDetails: false, twoFactor: false, signInAlerts: true, idleSignOut: false, devicesSignedIn: 2, alertsOn: 5, allMailOff: false };

describe("profileCompleteness", () => {
  it("counts what is filled in", () => {
    const c = profileCompleteness(base);
    expect(c.done).toBe(1);
    expect(c.total).toBe(5);
    expect(c.percent).toBe(20);
    expect(c.items.find((i) => i.id === "photo")!.tab).toBe("profile");
    expect(c.items.find((i) => i.id === "address")!.tab).toBe("billing");
  });
  it("is complete when everything is there", () => {
    expect(profileCompleteness({ ...base, hasPhoto: true, hasPhone: true, hasAddress: true, hasBillingDetails: true }).percent).toBe(100);
  });
});

describe("securityScore", () => {
  it("weighs the second factor and sign-in e-mails most", () => {
    expect(securityScore(base).score).toBe(20 + 20 + 15); // verified e-mail, sign-in e-mails, few devices
    expect(securityScore({ ...base, twoFactor: true }).score).toBe(90);
  });
  it("reaches strong with everything on, and gives levels", () => {
    const all = securityScore({ ...base, twoFactor: true, idleSignOut: true });
    expect(all.score).toBe(100);
    expect(all.level).toBe("strong");
    expect(securityScore({ ...base, twoFactor: true }).level).toBe("strong");
    expect(securityScore(base).level).toBe("fair");
    expect(securityScore({ ...base, signInAlerts: false, devicesSignedIn: 6 }).level).toBe("weak");
  });
  it("says why too many devices count against it", () => {
    expect(securityScore({ ...base, devicesSignedIn: 5 }).items.find((i) => i.id === "devices")!.hint).toContain("5 devices");
  });
});

describe("nextSteps", () => {
  it("starts with the second factor, then the profile, and is short", () => {
    const steps = nextSteps(base);
    expect(steps).toHaveLength(3);
    expect(steps[0].id).toBe("2fa");
    expect(steps[1].id).toBe("photo");
  });
  it("suggests an alert when none is on, and nothing when all is well", () => {
    expect(nextSteps({ ...base, alertsOn: 0 }, 20).some((s) => s.id === "alerts")).toBe(true);
    expect(nextSteps({ ...base, alertsOn: 0, allMailOff: true }, 20).some((s) => s.id === "alerts")).toBe(false);
    expect(nextSteps({ ...base, hasPhoto: true, hasPhone: true, hasAddress: true, hasBillingDetails: true, twoFactor: true, idleSignOut: true })).toEqual([]);
  });
});
