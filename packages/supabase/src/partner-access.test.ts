import { describe, expect, it } from "vitest";
import { ACCESS_DAYS, accessExpiry, hashAccessToken, isPlausibleAccessToken, newAccessToken } from "./partner-access";

describe("the tracking link code", () => {
  it("is 43 URL-safe characters, and different every time", () => {
    const a = newAccessToken();
    const b = newAccessToken();
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(isPlausibleAccessToken(a.token)).toBe(true);
  });

  it("is stored as its SHA-256 hash, which is the same for the same code and never the code itself", () => {
    const { token, hash } = newAccessToken();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashAccessToken(token));
    expect(hash).not.toContain(token);
    expect(hashAccessToken(token + "x")).not.toBe(hash);
  });

  it("refuses what could not be one of ours", () => {
    for (const bad of ["", "abc", "x".repeat(42), "x".repeat(44), "a/b".padEnd(43, "x"), "é".repeat(43)]) expect(isPlausibleAccessToken(bad)).toBe(false);
  });

  it("expires after the set number of days", () => {
    const now = new Date("2026-11-16T00:00:00.000Z");
    expect(new Date(accessExpiry(now)).getTime() - now.getTime()).toBe(ACCESS_DAYS * 86_400_000);
  });
});
