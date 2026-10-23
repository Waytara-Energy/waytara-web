import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email";

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("manojloganathan.dev@gmail.com")).toBe("m***@gmail.com");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });
  it("returns something that is not an address as it is", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
    expect(maskEmail("")).toBe("");
  });
});
