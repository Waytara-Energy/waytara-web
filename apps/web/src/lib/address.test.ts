import { describe, expect, it } from "vitest";
import { EMPTY_ADDRESS, GSTIN, addressLine, addressProblems, addressToJson, normaliseGstin, parseAddress, sameAddress } from "./address";

describe("parseAddress", () => {
  it("reads the usual keys and the older variants", () => {
    expect(parseAddress({ line1: " 12 MG Road ", city: "Chennai", state: "Tamil Nadu", pincode: "600001" })).toEqual({ line1: "12 MG Road", line2: "", city: "Chennai", state: "Tamil Nadu", pincode: "600001" });
    expect(parseAddress({ street: "4 Lake View", town: "Pune", state: "Maharashtra", postal_code: 411001 })).toMatchObject({ line1: "4 Lake View", city: "Pune", pincode: "411001" });
  });
  it("is empty for nothing or rubbish", () => {
    expect(parseAddress(null)).toEqual(EMPTY_ADDRESS);
    expect(parseAddress("x")).toEqual(EMPTY_ADDRESS);
  });
});

describe("addressProblems", () => {
  const ok = { line1: "12 MG Road", line2: "", city: "Chennai", state: "Tamil Nadu", pincode: "600001" };
  it("allows a complete address and an empty one (which clears it)", () => {
    expect(addressProblems(ok, "Address")).toEqual([]);
    expect(addressProblems(EMPTY_ADDRESS, "Address")).toEqual([]);
  });
  it("names what is missing or wrong", () => {
    expect(addressProblems({ ...ok, pincode: "6000" }, "Billing address")).toEqual(["Billing address: the pincode is 6 digits."]);
    expect(addressProblems({ ...ok, line1: "", city: "" }, "Address")).toHaveLength(2);
    expect(addressProblems({ ...ok, state: "" }, "Address")).toEqual(["Address: choose the state."]);
  });
});

describe("addressToJson, addressLine, sameAddress", () => {
  it("writes the keys in order without empty parts, and nothing for an empty address", () => {
    expect(Object.keys(addressToJson({ line1: "A", line2: "", city: "B", state: "C", pincode: "123456" })!)).toEqual(["line1", "city", "state", "pincode"]);
    expect(addressToJson(EMPTY_ADDRESS)).toBeNull();
  });
  it("prints on one line and compares without caring about case", () => {
    const a = { line1: "12 MG Road", line2: "", city: "Chennai", state: "Tamil Nadu", pincode: "600001" };
    expect(addressLine(a)).toBe("12 MG Road, Chennai, Tamil Nadu, 600001");
    expect(sameAddress(a, { ...a, city: "CHENNAI" })).toBe(true);
    expect(sameAddress(a, { ...a, pincode: "600002" })).toBe(false);
  });
});

describe("GSTIN", () => {
  it("accepts a well-formed number after tidying and rejects others", () => {
    expect(GSTIN.test(normaliseGstin(" 33aabcu9603r1zx "))).toBe(true);
    expect(GSTIN.test("1234")).toBe(false);
  });
});
