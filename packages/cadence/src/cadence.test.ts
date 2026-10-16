import { describe, expect, it } from "vitest";
import { CadenceApiError, createCadenceClient } from "./client";
import { cadenceText, filterKeys, groupKeys, keyTitle, type CadenceKey } from "./pick";
import { CADENCE_MAX_DAYS, addDays, istDayStartMs, isDay, oldestDay, planPeriod, todayIst } from "./range";

const NOW = Date.UTC(2026, 9, 15, 10, 0, 0); // 2026-10-15 15:30 in India

describe("days", () => {
  it("knows today in India, which is a day ahead of UTC late in the evening", () => {
    expect(todayIst(NOW)).toBe("2026-10-15");
    expect(todayIst(Date.UTC(2026, 9, 15, 19, 0, 0))).toBe("2026-10-16");
  });

  it("checks that a day is real", () => {
    expect(isDay("2026-10-15")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("15/10/2026")).toBe(false);
    expect(isDay(20261015)).toBe(false);
  });

  it("starts a day at midnight India time", () => {
    expect(istDayStartMs("2026-10-15")).toBe(Date.UTC(2026, 9, 14, 18, 30, 0));
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("reaches back four weeks, counting today", () => {
    expect(oldestDay(NOW)).toBe("2026-09-18");
  });
});

describe("planning a period", () => {
  it("turns a first day and a number of days into a time range", () => {
    const p = planPeriod("2026-10-13", 2, NOW);
    expect(p).toEqual({ ok: true, fromMs: istDayStartMs("2026-10-13"), toMs: istDayStartMs("2026-10-15"), days: 2, firstDay: "2026-10-13", lastDay: "2026-10-14" });
  });

  it("cuts a period that includes today at now", () => {
    const p = planPeriod("2026-10-14", 7, NOW);
    expect(p.ok && p.toMs).toBe(NOW);
    expect(p.ok && p.lastDay).toBe("2026-10-15");
    expect(p.ok && p.days).toBe(2);
  });

  it("allows up to a week and no more", () => {
    expect(planPeriod("2026-10-09", CADENCE_MAX_DAYS, NOW).ok).toBe(true);
    const tooLong = planPeriod("2026-10-01", 8, NOW);
    expect(tooLong.ok).toBe(false);
    expect(!tooLong.ok && tooLong.error).toMatch(/1 to 7 days/);
    expect(planPeriod("2026-10-01", 0, NOW).ok).toBe(false);
    expect(planPeriod("2026-10-01", 1.5, NOW).ok).toBe(false);
  });

  it("keeps to four weeks of history and to days that have happened", () => {
    expect(planPeriod("2026-09-18", 1, NOW).ok).toBe(true);
    const old = planPeriod("2026-09-17", 1, NOW);
    expect(!old.ok && old.error).toMatch(/28 days.*2026-09-18/);
    const future = planPeriod("2026-10-16", 1, NOW);
    expect(!future.ok && future.error).toMatch(/not happened/);
    expect(planPeriod("nonsense", 1, NOW).ok).toBe(false);
  });
});

const key = (k: string, label: string, group: string | null, unit: string | null = null, cadence_s: number | null = 10): CadenceKey => ({ key: k, label, unit, group, cadence_s });
const KEYS = [key("pv1_power_w", "PV1 Power", "Solar", "W"), key("pv2_power_w", "PV2 Power", "Solar", "W"), key("battery_soc_pct", "Battery Level", "Battery", "%"), key("fault_history", "Fault history", null), key("grid_frequency_hz", "Grid Frequency", "Grid", "Hz")];

describe("choosing values", () => {
  it("groups alphabetically with 'Other' last, and sorts within a group", () => {
    const g = groupKeys(KEYS);
    expect(g.map((x) => x.label)).toEqual(["Battery", "Grid", "Solar", "Other"]);
    expect(g[2]!.items.map((i) => i.key)).toEqual(["pv1_power_w", "pv2_power_w"]);
  });

  it("finds values by name, key, group or unit, all words together", () => {
    expect(filterKeys(KEYS, "power").map((k) => k.key)).toEqual(["pv1_power_w", "pv2_power_w"]);
    expect(filterKeys(KEYS, "pv1 power").map((k) => k.key)).toEqual(["pv1_power_w"]);
    expect(filterKeys(KEYS, "BATTERY").map((k) => k.key)).toEqual(["battery_soc_pct"]);
    expect(filterKeys(KEYS, "hz").map((k) => k.key)).toEqual(["grid_frequency_hz"]);
    expect(filterKeys(KEYS, "  ").length).toBe(KEYS.length);
    expect(filterKeys(KEYS, "zzz")).toEqual([]);
  });

  it("writes titles and rhythms the way people say them", () => {
    expect(keyTitle(KEYS[0]!)).toBe("PV1 Power (W)");
    expect(keyTitle(KEYS[3]!)).toBe("Fault history");
    expect([5, 30, 60, 300, 3600, 7200, null].map(cadenceText)).toEqual(["every 5 seconds", "every 30 seconds", "every minute", "every 5 minutes", "every hour", "every 2 hours", ""]);
  });
});

describe("the service client", () => {
  const mk = (reply: (url: string, init: RequestInit) => Response | Promise<Response>, token: string | null = "tok") => {
    const calls: { url: string; auth: string | null }[] = [];
    const client = createCadenceClient({
      baseUrl: "https://hub.example.com/",
      getToken: async () => token,
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, auth: new Headers(init.headers).get("authorization") });
        return reply(url, init);
      }) as typeof fetch,
    });
    return { client, calls };
  };
  const req = { equipmentId: "b4c30eb8-fba4-4487-aa7a-3c1b089e36e2", fromMs: 1000.4, toMs: 2000.2, keys: ["pv1_power_w", "battery_soc_pct"] };

  it("asks for the values of a device, signed in as the person", async () => {
    const { client, calls } = mk(() => Response.json({ scope: "customer", retention_days: 28, max_span_days: 7, max_keys: 40, keys: [] }));
    expect((await client.keys(req.equipmentId)).scope).toBe("customer");
    expect(calls[0]).toEqual({ url: "https://hub.example.com/v1/reports/cadence/keys?equipment=b4c30eb8-fba4-4487-aa7a-3c1b089e36e2", auth: "Bearer tok" });
  });

  it("asks for a preview as JSON with whole milliseconds and the keys in order", async () => {
    const { client, calls } = mk(() => Response.json({ columns: [], rows: [], truncated: false, from: 1, to: 2 }));
    await client.preview(req, 25);
    const u = new URL(calls[0]!.url);
    expect(Object.fromEntries(u.searchParams)).toEqual({ equipment: req.equipmentId, from: "1000", to: "2001", keys: "pv1_power_w,battery_soc_pct", format: "json", limit: "25" });
  });

  it("downloads the file and takes its name from the answer", async () => {
    const { client } = mk(() => new Response("Time (IST),A\r\n", { headers: { "content-disposition": 'attachment; filename="waytara-cadence-b4c30eb8-2026-10-15.csv"' } }));
    const d = await client.download(req);
    expect(d.filename).toBe("waytara-cadence-b4c30eb8-2026-10-15.csv");
    expect(await d.blob.text()).toBe("Time (IST),A\r\n");
  });

  it("explains problems in plain words, using the service's own words only for a bad request", async () => {
    const answer = (status: number, message: string) => () => Response.json({ error: { message } }, { status });
    await expect(mk(answer(400, "One download covers at most 7 days.")).client.download(req)).rejects.toThrow("One download covers at most 7 days.");
    await expect(mk(answer(404, "Not found")).client.keys("x")).rejects.toThrow("No readings are available for this device.");
    await expect(mk(answer(401, "Sign in required")).client.keys("x")).rejects.toThrow("Please sign in again.");
    await expect(mk(answer(503, "internal detail")).client.keys("x")).rejects.toThrow("The readings are unavailable right now. Try again in a moment.");
    await expect(mk(answer(429, "slow down")).client.keys("x")).rejects.toThrow(/Too many requests/);
    await expect(mk(() => new Response("<html>", { status: 502 })).client.keys("x")).rejects.toBeInstanceOf(CadenceApiError);
  });

  it("does not ask when nobody is signed in, or when no value or too many values are picked", async () => {
    const { client, calls } = mk(() => Response.json({}), null);
    await expect(client.keys("x")).rejects.toThrow("Please sign in again.");
    const ok = mk(() => Response.json({})).client;
    await expect(ok.preview({ ...req, keys: [] })).rejects.toThrow(/between 1 and 40/);
    await expect(ok.download({ ...req, keys: Array.from({ length: 41 }, (_, i) => `k${i}`) })).rejects.toThrow(/between 1 and 40/);
    expect(calls).toEqual([]);
  });

  it("reports a network failure without technical detail", async () => {
    const client = createCadenceClient({ baseUrl: "https://x", getToken: async () => "t", fetch: (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch });
    await expect(client.keys("x")).rejects.toThrow("Could not reach the readings service. Check your connection and try again.");
  });
});
