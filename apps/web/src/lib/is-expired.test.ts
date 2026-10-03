import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isExpired } from "./is-expired";

describe("isExpired", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("is true for a past timestamp", () => expect(isExpired("2026-10-03T11:59:59Z")).toBe(true));
  it("is false for a future timestamp", () => expect(isExpired("2026-10-03T12:00:01Z")).toBe(false));
});
