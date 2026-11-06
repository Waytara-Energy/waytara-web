import { describe, it, expect } from "vitest";
import { escapeLike } from "./like-escape";

describe("escapeLike", () => {
  it("leaves an ordinary e-mail address alone", () => {
    expect(escapeLike("john.doe@example.com")).toBe("john.doe@example.com");
  });

  it("escapes the underscore, so john_doe@ cannot match john.doe@", () => {
    expect(escapeLike("john_doe@example.com")).toBe("john\\_doe@example.com");
  });

  it("escapes the percent sign and the backslash", () => {
    expect(escapeLike("a%b@example.com")).toBe("a\\%b@example.com");
    expect(escapeLike("a\\b@example.com")).toBe("a\\\\b@example.com");
  });

  it("escapes every special character, not just the first", () => {
    expect(escapeLike("a_b_c%d")).toBe("a\\_b\\_c\\%d");
  });
});
