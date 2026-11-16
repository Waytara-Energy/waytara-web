import { describe, expect, it } from "vitest";
import { LICENCE_REMINDER_DAYS, licenceReminderKey, licenceStatus, passwordProblem, reminderDue, todayIst } from "./partner-account";
import { isAdminAppRole, isPartnerRole, isStaffRole } from "./roles";

describe("passwordProblem", () => {
  const ok = "Sunrise2027x";
  it("accepts a long enough password with letters and numbers that matches", () => {
    expect(passwordProblem(ok, ok, "priya@example.com")).toBeNull();
  });
  it("refuses a short one, a mismatch, and one without both letters and numbers", () => {
    expect(passwordProblem("Ab1", "Ab1", "p@example.com")).toMatch(/at least 10/);
    expect(passwordProblem(ok, "Sunrise2027y", "p@example.com")).toMatch(/not the same/);
    expect(passwordProblem("abcdefghijkl", "abcdefghijkl", "p@example.com")).toMatch(/letters and numbers/);
    expect(passwordProblem("1234567891234", "1234567891234", "p@example.com")).toMatch(/letters and numbers/);
  });
  it("refuses one built from the e-mail address, or one that is a well-known pattern", () => {
    expect(passwordProblem("priya.raman99", "priya.raman99", "priya.raman@example.com")).toMatch(/e-mail address/);
    expect(passwordProblem("aaaaaaaaaaaa", "aaaaaaaaaaaa", "p@example.com")).toMatch(/too easy/);
    expect(passwordProblem("password123", "password123", "p@example.com")).toMatch(/too easy/);
  });
  it("refuses one that is too long", () => {
    expect(passwordProblem("a1".repeat(40), "a1".repeat(40), "p@example.com")).toMatch(/at most 72/);
  });
});

describe("licenceStatus", () => {
  it("says none without a valid date", () => {
    expect(licenceStatus("", "2026-11-16")).toEqual({ state: "none", days: null });
    expect(licenceStatus("31-03-2027", "2026-11-16")).toEqual({ state: "none", days: null });
  });
  it("is valid through its last day, soon inside the reminder window, expired after", () => {
    expect(licenceStatus("2026-11-16", "2026-11-16")).toEqual({ state: "soon", days: 0 });
    expect(licenceStatus("2026-11-15", "2026-11-16")).toEqual({ state: "expired", days: -1 });
    expect(licenceStatus("2027-03-31", "2026-11-16").state).toBe("ok");
    expect(licenceStatus("2027-01-15", "2026-11-16")).toEqual({ state: "soon", days: 60 });
    expect(licenceStatus("2027-01-16", "2026-11-16")).toEqual({ state: "ok", days: 61 });
    expect(LICENCE_REMINDER_DAYS).toBe(60);
  });
});

describe("todayIst", () => {
  it("is the date in India, a day ahead of UTC late in the evening", () => {
    expect(todayIst(new Date("2026-11-16T20:00:00Z"))).toBe("2026-11-17");
    expect(todayIst(new Date("2026-11-16T10:00:00Z"))).toBe("2026-11-16");
  });
});

describe("roles", () => {
  it("keeps a partner out of the admin app and never counts them as staff", () => {
    expect(isAdminAppRole("partner")).toBe(false);
    expect(isStaffRole("partner")).toBe(false);
    expect(isPartnerRole("partner")).toBe(true);
    expect(isPartnerRole("employee")).toBe(false);
  });
});

describe("reminderDue", () => {
  it("gives the tightest reminder a licence has reached, and none beyond 60 days", () => {
    expect([null, 90, 61, 60, 31, 30, 8, 7, 1, 0, -5].map(reminderDue)).toEqual([null, null, null, 60, 60, 30, 30, 7, 7, 0, 0]);
  });
  it("tells a renewed licence from the old one by its date", () => {
    const a = { type: "contractor", number: "EA/1", validUntil: "2026-12-01" };
    expect(licenceReminderKey(a)).toBe("contractor|ea/1|2026-12-01");
    expect(licenceReminderKey({ ...a, validUntil: "2027-12-01" })).not.toBe(licenceReminderKey(a));
  });
});
