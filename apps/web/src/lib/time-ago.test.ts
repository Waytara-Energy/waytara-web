import { describe, expect, it } from "vitest";
import { timeAgo } from "./time-ago";

const NOW = Date.parse("2026-11-11T12:00:00Z");
const ago = (ms: number) => timeAgo(NOW - ms, NOW);
const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

describe("timeAgo", () => {
  it("counts seconds, minutes and hours, singular and plural", () => {
    expect(ago(0)).toBe("1 sec ago");
    expect(ago(1 * S)).toBe("1 sec ago");
    expect(ago(45 * S)).toBe("45 secs ago");
    expect(ago(60 * S)).toBe("1 min ago");
    expect(ago(5 * M + 40 * S)).toBe("5 mins ago");
    expect(ago(59 * M + 59 * S)).toBe("59 mins ago");
    expect(ago(60 * M)).toBe("1 hr ago");
    expect(ago(3 * H + 20 * M)).toBe("3 hrs ago");
    expect(ago(23 * H + 59 * M)).toBe("23 hrs ago");
  });
  it("counts days, months and years", () => {
    expect(ago(24 * H)).toBe("1 day ago");
    expect(ago(10 * D)).toBe("10 days ago");
    expect(ago(29 * D)).toBe("29 days ago");
    expect(ago(30 * D)).toBe("1 month ago");
    expect(ago(75 * D)).toBe("2 months ago");
    expect(ago(364 * D)).toBe("11 months ago");
    expect(ago(365 * D)).toBe("1 year ago");
    expect(ago(800 * D)).toBe("2 years ago");
  });
  it("treats a time slightly in the future as just happened", () => {
    expect(timeAgo(NOW + 5 * S, NOW)).toBe("1 sec ago");
  });
});
