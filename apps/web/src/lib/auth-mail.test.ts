import { describe, expect, it } from "vitest";
import { buildAuthEmail, istText, type AuthKind } from "./auth-mail";

const base = { name: "Asha Rao", device: "Chrome on Windows", place: "Chennai, Tamil Nadu, IN", ip: "103.21.4.18", whenMs: Date.parse("2026-10-23T06:30:00Z"), url: "https://app.example/dashboard/settings#security" };

describe("buildAuthEmail", () => {
  it("says what happened, on which device, from where and when, with a button to the settings", () => {
    const m = buildAuthEmail({ ...base, kind: "signin" });
    expect(m.subject).toBe("New sign-in to your WayTara account");
    for (const part of ["Chrome on Windows", "Chennai, Tamil Nadu, IN", "103.21.4.18", "12:00 pm IST", base.url, "Hi Asha,"]) expect(m.text, part).toContain(part);
    expect(m.html).toContain(base.url);
  });
  it("leaves out what is not known", () => {
    const m = buildAuthEmail({ ...base, kind: "signin", place: null, ip: null });
    expect(m.text).not.toContain("Place:");
    expect(m.text).not.toContain("Address:");
  });
  it("has a subject for every kind", () => {
    const kinds: AuthKind[] = ["signin", "signout", "signout_idle", "signout_others", "signout_all", "session_revoked", "password_changed", "mfa_enabled", "mfa_disabled"];
    const subjects = kinds.map((kind) => buildAuthEmail({ ...base, kind, target: "Safari on iOS" }).subject);
    expect(new Set(subjects).size).toBe(kinds.length);
  });
  it("names the device that was signed out", () => {
    expect(buildAuthEmail({ ...base, kind: "session_revoked", target: "Safari on iOS" }).text).toContain("Safari on iOS was signed out");
  });
  it("does not let a name break the HTML", () => {
    expect(buildAuthEmail({ ...base, kind: "signin", name: "<script>x</script>" }).html).not.toContain("<script>");
  });
});

describe("istText", () => {
  it("prints the time in India", () => {
    expect(istText(Date.parse("2026-10-23T06:30:00Z"))).toMatch(/23 Oct 2026.*12:00 pm IST/);
  });
});
