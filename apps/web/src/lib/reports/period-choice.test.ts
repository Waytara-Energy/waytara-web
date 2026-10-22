import { describe, expect, it } from "vitest";
import { CUSTOM_MAX_DAYS, choiceLabel, resolveChoice, type PeriodChoice } from "./period-choice";

const today = "2026-10-06";
const custom = (customStart: string, customEnd?: string): PeriodChoice => ({ mode: "custom", date: today, customStart, ...(customEnd ? { customEnd } : {}) });

describe("resolveChoice", () => {
  it("covers a single day, the last 7, 30 and 90 days", () => {
    expect(resolveChoice({ mode: "day", date: "2026-10-01", customStart: "" }, today)).toEqual({ start: "2026-10-01", days: 1, end: "2026-10-01" });
    expect(resolveChoice({ mode: "7d", date: today, customStart: "" }, today)).toEqual({ start: "2026-09-30", days: 7, end: "2026-10-06" });
    expect(resolveChoice({ mode: "90d", date: today, customStart: "" }, today).days).toBe(90);
  });

  it("a custom range runs from its first day to its last, both included", () => {
    expect(resolveChoice(custom("2026-09-10", "2026-09-20"), today)).toEqual({ start: "2026-09-10", days: 11, end: "2026-09-20" });
    expect(resolveChoice(custom("2026-09-10", "2026-09-10"), today).days).toBe(1);
  });

  it("a custom range can be up to 90 days and is cut back beyond that", () => {
    expect(resolveChoice(custom("2026-07-01", "2026-09-28"), today).days).toBe(90);
    expect(resolveChoice(custom("2026-06-01", "2026-10-01"), today)).toEqual({ start: "2026-06-01", days: CUSTOM_MAX_DAYS, end: "2026-08-29" });
  });

  it("a custom range never reaches past today, and never ends before it starts", () => {
    expect(resolveChoice(custom("2026-10-01", "2026-12-31"), today).end).toBe("2026-10-06");
    expect(resolveChoice(custom("2026-10-01", "2026-09-20"), today).days).toBe(1);
  });

  it("a custom choice made before ranges had an end keeps its old length: 30 days from the start, up to today", () => {
    expect(resolveChoice(custom("2026-09-01"), today)).toEqual({ start: "2026-09-01", days: 30, end: "2026-09-30" });
    expect(resolveChoice(custom("2026-10-03"), today)).toEqual({ start: "2026-10-03", days: 4, end: "2026-10-06" });
  });
});

describe("choiceLabel", () => {
  it("says Today, a date, a preset or the range", () => {
    expect(choiceLabel({ mode: "day", date: today, customStart: "" }, today)).toBe("Today");
    expect(choiceLabel({ mode: "day", date: "2026-10-01", customStart: "" }, today)).toBe("1 Oct 2026");
    expect(choiceLabel({ mode: "30d", date: today, customStart: "" }, today)).toBe("30 days");
    expect(choiceLabel(custom("2026-09-10", "2026-09-20"), today)).toMatch(/^10 - 20 Sept? 2026$/);
  });
});
