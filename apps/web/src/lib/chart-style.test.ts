import { describe, expect, it } from "vitest";
import { chartStyleCookie, parseChartStyle, resolveKind } from "./chart-style";

describe("chart style", () => {
  it("reads line and bar, and anything else as automatic", () => {
    expect(parseChartStyle("line")).toBe("line");
    expect(parseChartStyle("bar")).toBe("bar");
    expect(parseChartStyle("auto")).toBe("auto");
    expect(parseChartStyle("pie")).toBe("auto");
    expect(parseChartStyle(undefined)).toBe("auto");
  });
  it("lets the person's choice override a chart's natural style, and automatic keep it", () => {
    expect(resolveKind("auto", "line")).toBe("line");
    expect(resolveKind("auto", "bar")).toBe("bar");
    expect(resolveKind("line", "bar")).toBe("line");
    expect(resolveKind("bar", "line")).toBe("bar");
  });
  it("is saved for a year", () => {
    expect(chartStyleCookie("bar")).toBe("chart_style=bar; path=/; max-age=31536000; samesite=lax");
  });
});
