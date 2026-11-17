import { describe, expect, it } from "vitest";
import { extractCode } from "./otp-code";

describe("extractCode", () => {
  it("takes the digits of a plain code, with or without spaces", () => {
    expect(extractCode("675606")).toBe("675606");
    expect(extractCode(" 675 606 ")).toBe("675606");
    expect(extractCode("675-606")).toBe("675606");
  });
  it("finds the code inside a pasted sentence", () => {
    expect(extractCode("Your code is 675606")).toBe("675606");
    expect(extractCode("675606 is your WayTara code")).toBe("675606");
  });
  it("prefers a run of exactly six digits over other numbers around it", () => {
    expect(extractCode("WayTara 2026: code 675606, valid 10 minutes")).toBe("675606");
    expect(extractCode("call 9363021195 then 112233")).toBe("112233");
  });
  it("never returns more than six digits, and returns nothing when there are none", () => {
    expect(extractCode("1234567890")).toBe("123456");
    expect(extractCode("no digits here")).toBe("");
    expect(extractCode("")).toBe("");
  });
});
