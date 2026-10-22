import { describe, expect, it } from "vitest";
import { HELP_ITEMS, searchHelp } from "./support-help";

describe("the help answers", () => {
  it("each has a question, an answer and, where there is a link, a path inside the dashboard", () => {
    for (const i of HELP_ITEMS) {
      expect(i.question.length, i.id).toBeGreaterThan(8);
      expect(i.answer.length, i.id).toBeGreaterThan(0);
      if (i.link) expect(i.link.href.startsWith("/dashboard"), i.id).toBe(true);
    }
    expect(new Set(HELP_ITEMS.map((i) => i.id)).size).toBe(HELP_ITEMS.length);
  });

  it("are all shown when nothing is typed", () => {
    expect(searchHelp("")).toHaveLength(HELP_ITEMS.length);
    expect(searchHelp("   ")).toHaveLength(HELP_ITEMS.length);
  });

  it("are narrowed to those that have every word typed", () => {
    expect(searchHelp("offline").map((i) => i.id)).toContain("offline");
    expect(searchHelp("battery evening").map((i) => i.id)).toEqual(["battery"]);
    expect(searchHelp("zzzz")).toEqual([]);
  });
});
