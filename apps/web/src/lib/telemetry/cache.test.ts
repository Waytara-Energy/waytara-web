import { describe, expect, it } from "vitest";
import { PersistentCache, memoryKV } from "./cache";

describe("PersistentCache", () => {
  it("round-trips a value with its saved time", async () => {
    let t = 1000;
    const c = new PersistentCache(memoryKV(), "user-1", () => t);
    await c.save("series:a", [1, 2, 3]);
    t = 5000;
    expect(await c.load<number[]>("series:a")).toEqual({ value: [1, 2, 3], savedAt: 1000 });
    expect(await c.load("missing")).toBeUndefined();
  });

  it("never shows one user's data to another", async () => {
    const kv = memoryKV();
    await new PersistentCache(kv, "alice").save("series:a", "alice's");
    expect(await new PersistentCache(kv, "bob").load("series:a")).toBeUndefined();
    expect((await new PersistentCache(kv, "alice").load<string>("series:a"))?.value).toBe("alice's");
  });

  it("clear() wipes everything", async () => {
    const kv = memoryKV();
    const c = new PersistentCache(kv, "u");
    await c.save("a", 1);
    await c.clear();
    expect(await c.load("a")).toBeUndefined();
  });

  it("evicts the oldest entries beyond the cap", async () => {
    let t = 0;
    const c = new PersistentCache(memoryKV(), "u", () => ++t);
    for (let i = 0; i < 305; i++) await c.save(`k${i}`, i);
    expect(await c.load("k0")).toBeUndefined();
    expect((await c.load<number>("k304"))?.value).toBe(304);
  });

  it("a failing store degrades to no cache instead of throwing", async () => {
    const broken = { get: async () => { throw new Error("x"); }, set: async () => { throw new Error("x"); }, delete: async () => { throw new Error("x"); }, clear: async () => { throw new Error("x"); } };
    const c = new PersistentCache(broken, "u");
    await expect(c.save("a", 1)).resolves.toBeUndefined();
    await expect(c.load("a")).resolves.toBeUndefined();
    await expect(c.clear()).resolves.toBeUndefined();
  });
});
