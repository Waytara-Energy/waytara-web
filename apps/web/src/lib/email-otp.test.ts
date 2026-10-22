import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, buildEmailChangedMail, buildEmailCodeMail, canResend, codeExpired, codeMatches, generateCode, hashCode, normaliseEmail, secondsUntilResend } from "./email-otp";

const SECRET = "test-secret";
const USER = "11111111-2222-3333-4444-555555555555";

describe("codes", () => {
  it("are six digits, kept with their leading zeros", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
  it("match only the code, the person and the address they were made for", () => {
    const hash = hashCode(SECRET, USER, "New@Example.com", "042917");
    expect(codeMatches(SECRET, USER, "new@example.com", "042917", hash)).toBe(true);
    expect(codeMatches(SECRET, USER, "new@example.com", " 042917 ", hash)).toBe(true);
    expect(codeMatches(SECRET, USER, "new@example.com", "042918", hash)).toBe(false);
    expect(codeMatches(SECRET, USER, "other@example.com", "042917", hash)).toBe(false);
    expect(codeMatches(SECRET, "99999999-2222-3333-4444-555555555555", "new@example.com", "042917", hash)).toBe(false);
    expect(codeMatches("another-secret", USER, "new@example.com", "042917", hash)).toBe(false);
  });
  it("do not throw on a damaged stored hash", () => {
    expect(codeMatches(SECRET, USER, "a@b.co", "123456", "not-hex")).toBe(false);
  });
});

describe("time rules", () => {
  const t = Date.parse("2026-10-23T12:00:00Z");
  it("expire after their time", () => {
    expect(codeExpired("2026-10-23T12:00:01Z", t)).toBe(false);
    expect(codeExpired("2026-10-23T12:00:00Z", t)).toBe(true);
  });
  it("allow a resend after a minute", () => {
    expect(canResend("2026-10-23T11:59:30Z", t)).toBe(false);
    expect(secondsUntilResend("2026-10-23T11:59:30Z", t)).toBe(30);
    expect(canResend("2026-10-23T11:58:59Z", t)).toBe(true);
    expect(secondsUntilResend("2026-10-23T11:00:00Z", t)).toBe(0);
  });
  it("allow a few wrong tries", () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});

describe("the e-mails", () => {
  it("carry the code in the subject and the body, and nothing unescaped", () => {
    const m = buildEmailCodeMail({ name: "Asha <b>Rao</b>", code: "042917" });
    expect(m.subject).toContain("042917");
    expect(m.text).toContain("042917");
    expect(m.html).toContain("042917");
    expect(m.html).not.toContain("<b>Rao</b>");
  });
  it("tell the old address where the account went", () => {
    const m = buildEmailChangedMail({ name: "Asha", newEmail: "new@example.com" });
    expect(m.text).toContain("new@example.com");
    expect(m.subject).toMatch(/changed/);
  });
  it("normalises an address", () => {
    expect(normaliseEmail("  New@Example.COM ")).toBe("new@example.com");
  });
});
