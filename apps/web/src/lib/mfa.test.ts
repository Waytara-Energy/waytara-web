import { describe, expect, it } from "vitest";
import { cleanTotp, needsSecondFactor } from "./mfa";

describe("needsSecondFactor", () => {
  it("is true only after the password, when a verified factor exists", () => {
    expect(needsSecondFactor({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
    expect(needsSecondFactor({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
    expect(needsSecondFactor({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
    expect(needsSecondFactor(null)).toBe(false);
  });
});

describe("cleanTotp", () => {
  it("keeps six digits however they were typed", () => {
    expect(cleanTotp("123456")).toBe("123456");
    expect(cleanTotp("123 456")).toBe("123456");
    expect(cleanTotp("12345")).toBeNull();
    expect(cleanTotp("1234567")).toBeNull();
    expect(cleanTotp("abc")).toBeNull();
  });
});
