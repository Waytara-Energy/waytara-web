import { describe, expect, it } from "vitest";
import { formatFieldValue, type TemplateField } from "./template-field-format";

const field = (over: Partial<TemplateField> = {}): TemplateField => ({
  key: "k",
  label: "L",
  unit: null,
  valueKind: "number",
  enumRef: null,
  source: null,
  ...over,
});

describe("formatFieldValue", () => {
  it("shows an em dash for missing values", () => {
    expect(formatFieldValue(null, field())).toBe("—");
    expect(formatFieldValue("", field())).toBe("—");
  });

  it("rounds plain numbers and groups Indian-style thousands", () => {
    expect(formatFieldValue(1234567.4, field())).toBe("12,34,567");
  });

  it("picks decimals from the unit", () => {
    expect(formatFieldValue(12.345, field({ unit: "kWh" }))).toBe("12.3 kWh");
    expect(formatFieldValue(230.456, field({ unit: "V" }))).toBe("230.46 V");
    expect(formatFieldValue(1500.7, field({ unit: "W" }))).toBe("1,501 W");
  });

  it("rejects non-finite numbers", () => {
    expect(formatFieldValue("abc", field({ unit: "V" }))).toBe("—");
  });

  it("formats currency with the unit as the symbol (default rupee)", () => {
    expect(formatFieldValue(1234.5, field({ valueKind: "currency", unit: null }))).toBe("₹1,234.5");
  });

  it("formats booleans", () => {
    expect(formatFieldValue(1, field({ valueKind: "bool" }))).toBe("Yes");
    expect(formatFieldValue("true", field({ valueKind: "bool" }))).toBe("Yes");
    expect(formatFieldValue(0, field({ valueKind: "bool" }))).toBe("No");
  });

  it("passes enum labels and text straight through", () => {
    expect(formatFieldValue("Charging", field({ valueKind: "enum" }))).toBe("Charging");
    expect(formatFieldValue("SN123", field({ valueKind: "text" }))).toBe("SN123");
  });

  it("returns an unparseable timestamp unchanged", () => {
    expect(formatFieldValue("not-a-date", field({ valueKind: "timestamp" }))).toBe("not-a-date");
  });
});
