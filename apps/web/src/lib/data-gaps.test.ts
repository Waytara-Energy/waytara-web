import { describe, expect, it } from "vitest";
import { GAP_EXPLANATION, explainGap, withCauses, MIN_GAP_MS, dayGapLines, dayGapText, dayGapsSummary, gapLines, gapsCsv, gapsSummary, durationText, findDayGaps, findGaps, gapRangeText, gapText, totalGapDays, totalGapMs } from "./data-gaps";

const Q = 15 * 60_000;
// 2026-10-23 00:00 IST is 2026-10-22 18:30 UTC
const MIDNIGHT = Date.parse("2026-10-22T18:30:00Z");
const slots = (n: number) => Array.from({ length: n }, (_, i) => MIDNIGHT + i * Q);
const at = (h: number, m = 0) => MIDNIGHT + (h * 60 + m) * 60_000;

describe("durationText", () => {
  it("writes how long, in the biggest sensible units", () => {
    expect(durationText(20_000)).toBe("under a minute");
    expect(durationText(45 * 60_000)).toBe("45 min");
    expect(durationText(85 * 60_000)).toBe("1 h 25 min");
    expect(durationText(120 * 60_000)).toBe("2 h");
    expect(durationText(27 * 3_600_000)).toBe("1 day 3 h");
    expect(durationText(72 * 3_600_000)).toBe("3 days");
  });
});

describe("findGaps", () => {
  const has = (n: number, missing: [number, number][]) => Array.from({ length: n }, (_, i) => !missing.some(([a, b]) => i >= a && i < b));

  it("finds a stretch between two readings", () => {
    // slots 8..13 missing (two hours: 02:00 to 03:30), data before and after
    const g = findGaps(slots(24), has(24, [[8, 14]]), Q, at(6));
    expect(g).toEqual([{ fromMs: at(2), toMs: at(3, 30), ongoing: false }]);
  });

  it("ignores a stretch shorter than the least", () => {
    expect(findGaps(slots(24), has(24, [[8, 9]]), Q, at(6))).toEqual([]); // one slot: 15 min
    expect(MIN_GAP_MS).toBe(30 * 60_000);
    expect(findGaps(slots(24), has(24, [[8, 10]]), Q, at(6))).toHaveLength(1); // two slots: 30 min
  });

  it("ignores the time before the first reading (the device may not have existed)", () => {
    expect(findGaps(slots(24), has(24, [[0, 8]]), Q, at(6))).toEqual([]);
  });

  it("counts the time since the last reading as a gap still going on, up to now", () => {
    // readings stop after slot 11 (03:00); it is 05:00 now
    const g = findGaps(slots(24), has(24, [[12, 24]]), Q, at(5));
    expect(g).toEqual([{ fromMs: at(3), toMs: at(5), ongoing: true }]);
  });

  it("does not call the slot that has just begun a gap", () => {
    // the newest slot has nothing yet, ten minutes in
    expect(findGaps(slots(24), has(24, [[20, 24]]), Q, at(5, 10))).toEqual([]);
  });

  it("closes a finished window at its end and does not call that gap ongoing", () => {
    const g = findGaps(slots(24), has(24, [[16, 24]]), Q, at(23), { endMs: at(6) });
    expect(g).toEqual([{ fromMs: at(4), toMs: at(6), ongoing: false }]);
  });

  it("can leave out the trailing stretch", () => {
    expect(findGaps(slots(24), has(24, [[12, 24]]), Q, at(5), { trailing: false })).toEqual([]);
  });

  it("returns several gaps, and none when nothing was ever read", () => {
    expect(findGaps(slots(24), has(24, [[4, 8], [12, 16]]), Q, at(6))).toHaveLength(2);
    expect(findGaps(slots(24), has(24, [[0, 24]]), Q, at(6))).toEqual([]);
  });

  it("does not run a gap across slots that are not next to each other", () => {
    // 04:00-06:00 asked for on two days: the slots are 22 hours apart
    const day1 = Array.from({ length: 8 }, (_, i) => at(4) + i * Q);
    const day2 = day1.map((t) => t + 24 * 3_600_000);
    const all = [...day1, ...day2];
    const flags = all.map((_, i) => i < 2 || i >= 14); // readings at the very start of day 1 and the very end of day 2 only
    const g = findGaps(all, flags, Q, at(60));
    expect(g).toHaveLength(2);
    expect(g[0].toMs - g[0].fromMs).toBe(6 * Q);
  });

  it("adds up and writes", () => {
    const g = findGaps(slots(24), has(24, [[8, 14]]), Q, at(6));
    expect(totalGapMs(g)).toBe(90 * 60_000);
    expect(gapRangeText(g[0])).toBe("02:00 to 03:30");
    expect(gapText(g[0])).toBe("02:00 to 03:30 (1 h 30 min)");
    expect(gapText({ fromMs: at(3), toMs: at(5), ongoing: true })).toBe("since 03:00 (2 h so far)");
  });

  it("names the dates when a gap crosses midnight", () => {
    const g = { fromMs: at(23), toMs: at(26), ongoing: false };
    expect(gapRangeText(g)).toBe("23 Oct 23:00 to 24 Oct 02:00");
  });
});

describe("findDayGaps", () => {
  it("finds runs of days with no reading after the first day with one", () => {
    const g = findDayGaps(["2026-10-02", "2026-10-03", "2026-10-07", "2026-10-08", "2026-10-10"], "2026-10-01", "2026-10-10");
    expect(g).toEqual([
      { from: "2026-10-04", to: "2026-10-06", days: 3 },
      { from: "2026-10-09", to: "2026-10-09", days: 1 },
    ]);
    expect(totalGapDays(g)).toBe(4);
  });

  it("counts the days since the last reading up to the end", () => {
    expect(findDayGaps(["2026-10-01", "2026-10-02"], "2026-10-01", "2026-10-05")).toEqual([{ from: "2026-10-03", to: "2026-10-05", days: 3 }]);
  });

  it("has none when every day has a reading, or when there is no reading at all", () => {
    expect(findDayGaps(["2026-10-01", "2026-10-02"], "2026-10-01", "2026-10-02")).toEqual([]);
    expect(findDayGaps([], "2026-10-01", "2026-10-05")).toEqual([]);
  });

  it("writes a run in words", () => {
    expect(dayGapText({ from: "2026-10-04", to: "2026-10-06", days: 3 })).toBe("4 Oct to 6 Oct (3 days)");
    expect(dayGapText({ from: "2026-10-09", to: "2026-10-09", days: 1 })).toBe("9 Oct (1 day)");
  });
});

describe("the lines of a report", () => {
  const gap = { fromMs: at(10, 15), toMs: at(11, 40), ongoing: false };
  it("writes a time gap with its date and length, and a gap still going on without an end", () => {
    expect(gapLines([gap])).toEqual([{ from: "23 Oct 2026, 10:15", to: "23 Oct 2026, 11:40", length: "1 h 25 min", ongoing: false, reason: undefined }]);
    expect(gapLines([{ ...gap, ongoing: true }])[0].to).toBe("still no readings");
    expect(gapsSummary([gap, gap])).toBe("2 periods, 2 h 50 min without readings");
  });
  it("writes day gaps", () => {
    const g = [{ from: "2026-10-04", to: "2026-10-06", days: 3 }];
    expect(dayGapLines(g)).toEqual([{ from: "4 Oct 2026", to: "6 Oct 2026", length: "3 days" }]);
    expect(dayGapsSummary(g)).toBe("1 period, 3 days without readings");
  });
  it("makes CSV lines only when there is something to say", () => {
    const esc = (c: string | number) => `"${c}"`;
    expect(gapsCsv([], "", esc)).toEqual([]);
    const out = gapsCsv(gapLines([gap]), gapsSummary([gap]), esc);
    expect(out[1]).toBe('"Data gaps","1 period, 1 h 25 min without readings"');
    expect(out[3]).toBe('"23 Oct 2026, 10:15","23 Oct 2026, 11:40","1 h 25 min"');
    expect(out[out.length - 1]).toBe(`"${GAP_EXPLANATION}"`);
  });
});

describe("explainGap", () => {
  const gap = { fromMs: at(15, 30), toMs: at(16, 45), ongoing: true };
  it("names a unit that stopped checking in", () => {
    const r = explainGap(gap, [{ sinceMs: at(15, 32), cause: "offline" }]);
    expect(r.cause).toBe("unit_offline");
    expect(r.title).toBe("Monitoring unit offline");
  });
  it("names an inverter that does not answer a unit that is online", () => {
    expect(explainGap(gap, [{ sinceMs: at(15, 28), cause: "device_unreachable" }]).cause).toBe("inverter_unreachable");
  });
  it("picks the outage that began closest to the start of the gap", () => {
    const r = explainGap(gap, [
      { sinceMs: at(15, 5), cause: "device_unreachable" },
      { sinceMs: at(15, 31), cause: "offline" },
    ]);
    expect(r.cause).toBe("unit_offline");
  });
  it("does not use an outage from another time", () => {
    expect(explainGap(gap, [{ sinceMs: at(9, 0), cause: "offline" }, { sinceMs: at(18, 0), cause: "offline" }]).cause).toBe("unknown");
  });
  it("says the cause is unknown when nothing was recorded or the cause is not one we know", () => {
    expect(explainGap(gap, []).cause).toBe("unknown");
    expect(explainGap(gap, [{ sinceMs: at(15, 30), cause: null }]).cause).toBe("unknown");
  });
});

describe("causes in a report", () => {
  const gap = { fromMs: at(15, 30), toMs: at(16, 45), ongoing: true };
  it("puts the cause on the gap and its words on the report line", () => {
    const [g] = withCauses([gap], [{ sinceMs: at(15, 31), cause: "offline" }]);
    expect(g.cause).toBe("unit_offline");
    expect(gapLines([g])[0]).toMatchObject({ reason: "Monitoring unit offline", ongoing: true, length: "1 h 15 min so far" });
  });
  it("adds a Reason column to the CSV only when a line has a reason", () => {
    const esc = (c: string | number) => `"${c}"`;
    const [g] = withCauses([gap], []);
    expect(gapsCsv(gapLines([g]), "s", esc)[2]).toBe('"From","To","Length","Reason"');
    expect(gapsCsv(gapLines([gap]), "s", esc)[2]).toBe('"From","To","Length"');
  });
});
