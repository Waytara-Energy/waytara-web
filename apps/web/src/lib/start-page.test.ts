import { describe, expect, it } from "vitest";
import { parseStartPage, startPath } from "./start-page";

describe("start page", () => {
  it("is the Overview unless a known page was chosen", () => {
    expect(parseStartPage(null)).toBe("overview");
    expect(parseStartPage({ start_page: "nowhere" })).toBe("overview");
    expect(parseStartPage({ start_page: "reports" })).toBe("reports");
  });
  it("knows the path of each page", () => {
    expect(startPath("overview")).toBe("/dashboard");
    expect(startPath("monitoring")).toBe("/dashboard/monitoring");
  });
});
