import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password-strength";

describe("passwordStrength", () => {
  it("says nothing for an empty box and refuses short ones", () => {
    expect(passwordStrength("")).toEqual({ score: 0, label: "Too short", tips: [] });
    expect(passwordStrength("abc123").label).toBe("Too short");
  });
  it("calls the usual passwords and the e-mail name weak", () => {
    expect(passwordStrength("Password123").label).toBe("Weak");
    expect(passwordStrength("manojloganathan1", "manojloganathan.dev@gmail.com").label).toBe("Weak");
    expect(passwordStrength("aaaaaaaaaaaa").score).toBeLessThanOrEqual(2);
    expect(passwordStrength("12345678abcd").score).toBeLessThanOrEqual(2);
  });
  it("grows with length and variety", () => {
    const fair = passwordStrength("sunnyroof");
    const good = passwordStrength("SunnyRoof2026");
    const strong = passwordStrength("Sunny-Roof-2026-Chennai!");
    expect(fair.score).toBeLessThan(good.score);
    expect(good.score).toBeLessThan(strong.score);
    expect(strong.label).toBe("Strong");
    expect(strong.tips).toEqual([]);
  });
  it("tells what would help", () => {
    expect(passwordStrength("sunnyroof").tips.join(" ")).toMatch(/12 or more/);
    expect(passwordStrength("sunnyroof").tips.join(" ")).toMatch(/Mix/);
  });
});
