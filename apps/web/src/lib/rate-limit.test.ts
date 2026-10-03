import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@waytara/supabase/service-role", () => ({ createServiceRoleClient: () => ({ rpc }) }));

import { allowRequest, clientIp } from "./rate-limit";

describe("allowRequest", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("delegates to the database limiter and returns its verdict", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await allowRequest("b", "k", 5, 60)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", { p_bucket: "b", p_key: "k", p_max: 5, p_window_seconds: 60 });

    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await allowRequest("b", "k", 5, 60)).toBe(false);
  });

  it("falls back to an in-memory window when the database errors, and still blocks", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("db down") });
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await allowRequest("fb", "ip1", 3, 60));
    expect(results).toEqual([true, true, true, false]);
    // a different key is independent
    expect(await allowRequest("fb", "ip2", 3, 60)).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip, then the first x-forwarded-for hop", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
