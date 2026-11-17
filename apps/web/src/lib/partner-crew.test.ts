import { describe, expect, it } from "vitest";
import { crewShareMessage, whatsappNumber } from "./partner-crew";

describe("whatsappNumber", () => {
  it("adds the country code to a ten-digit Indian number and ignores spaces and signs", () => {
    expect(whatsappNumber("98765 43210")).toBe("919876543210");
    expect(whatsappNumber("+91 98765-43210")).toBe("919876543210");
  });
  it("leaves a number that already has a country code, and gives nothing for no digits", () => {
    expect(whatsappNumber("919876543210")).toBe("919876543210");
    expect(whatsappNumber("abc")).toBe("");
  });
});

describe("crewShareMessage", () => {
  it("greets by first name and carries the link", () => {
    expect(crewShareMessage("Ravi Kumar", "https://x.test/partner/crew/abc")).toBe("Hi Ravi, please add your documents for WayTara here: https://x.test/partner/crew/abc");
    expect(crewShareMessage("", "https://x.test/l")).toContain("Hi, please add");
  });
});
