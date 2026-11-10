import { afterEach, describe, expect, it, vi } from "vitest";
import { logTiming, startStopwatch } from "./server-timing";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("the server stopwatch", () => {
  it("names each step and ends with a total, in Server-Timing form", () => {
    const w = startStopwatch();
    w.mark("auth");
    w.mark("profile");
    const header = w.header();
    expect(header).toMatch(/^auth;dur=\d+, profile;dur=\d+, total;dur=\d+$/);
    expect(w.summary()).toMatch(/^auth \d+ ms, profile \d+ ms, total \d+ ms$/);
  });

  it("measures the time of each step from the end of the one before", async () => {
    const w = startStopwatch();
    await new Promise((r) => setTimeout(r, 30));
    w.mark("slow");
    w.mark("fast");
    const [slow, fast] = w.header().split(", ").map((s) => Number(s.split("=")[1]));
    expect(slow).toBeGreaterThanOrEqual(25);
    expect(fast).toBeLessThan(slow);
  });

  it("stays quiet for a fast request and logs a slow one, or everything when switched on", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const quick = startStopwatch();
    quick.mark("x");
    logTiming("page", quick);
    expect(log).not.toHaveBeenCalled();

    vi.stubEnv("WAYTARA_TIMING", "on");
    logTiming("page", quick);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain("[timing] page:");
  });
});
