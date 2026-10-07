import { describe, expect, it } from "vitest";
import { isAgentOnline } from "./agent-online";

const at = (iso: string) => new Date(iso).getTime();

describe("isAgentOnline", () => {
  it("is online within three upload intervals of the last heartbeat", () => {
    expect(isAgentOnline("2026-10-07T07:30:00Z", at("2026-10-07T08:10:00Z"), 900)).toBe(true); // 40 min < 45 min
    expect(isAgentOnline("2026-10-07T07:30:00Z", at("2026-10-07T08:20:00Z"), 900)).toBe(false); // 50 min
  });

  it("never flickers below 90 seconds and is offline without a heartbeat", () => {
    expect(isAgentOnline("2026-10-07T07:30:00Z", at("2026-10-07T07:31:00Z"), 5)).toBe(true);
    expect(isAgentOnline(null, Date.now(), 60)).toBe(false);
  });
});
