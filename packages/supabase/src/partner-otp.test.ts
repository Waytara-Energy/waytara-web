import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, hashSecret, isPlausibleCode, isPlausibleProof, newCode, newProof, sameHash } from "./partner-otp";

describe("partner otp", () => {
  it("makes 6-digit codes, zero padded", () => {
    for (let i = 0; i < 200; i++) expect(newCode()).toMatch(/^\d{6}$/);
  });
  it("recognises only a 6-digit code and a 43-character proof", () => {
    expect(isPlausibleCode("012345")).toBe(true);
    expect(isPlausibleCode("12345")).toBe(false);
    expect(isPlausibleCode("12345a")).toBe(false);
    expect(isPlausibleCode(123456)).toBe(false);
    expect(isPlausibleProof(newProof())).toBe(true);
    expect(isPlausibleProof("short")).toBe(false);
  });
  it("hashes with the application id as salt and compares in constant time", () => {
    const a = hashSecret("app-1", "123456");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSecret("app-2", "123456")).not.toBe(a);
    expect(sameHash(a, hashSecret("app-1", "123456"))).toBe(true);
    expect(sameHash(a, hashSecret("app-1", "123457"))).toBe(false);
    expect(sameHash(a, "")).toBe(false);
  });
  it("allows a handful of tries", () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});
