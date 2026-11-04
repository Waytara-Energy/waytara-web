import { describe, expect, it, vi } from "vitest";
import { createRetryingFetch } from "./retry-fetch";

const stuck = () => new Response(JSON.stringify({ code: "25P02", message: "current transaction is aborted, commands ignored until end of transaction block" }), { status: 500 });
const ok = () => new Response(JSON.stringify([{ id: 1 }]), { status: 200 });

describe("the retrying fetch", () => {
  it("asks again when the request landed on a stuck connection, and returns the good answer", async () => {
    const base = vi.fn().mockResolvedValueOnce(stuck()).mockResolvedValueOnce(ok());
    const r = await createRetryingFetch(base, [1, 1])("https://x/rest/v1/t");
    expect(r.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last try and returns that answer as it is", async () => {
    const base = vi.fn().mockImplementation(async () => stuck());
    const r = await createRetryingFetch(base, [1, 1])("https://x/rest/v1/t");
    expect(r.status).toBe(500);
    expect(base).toHaveBeenCalledTimes(3);
  });

  it("does not repeat any other error", async () => {
    const other = () => new Response(JSON.stringify({ code: "42501", message: "Not allowed" }), { status: 403 });
    const base = vi.fn().mockImplementation(async () => other());
    const r = await createRetryingFetch(base, [1, 1])("https://x/rest/v1/t");
    expect(r.status).toBe(403);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("does not repeat a different 500", async () => {
    const base = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ code: "XX000", message: "boom" }), { status: 500 }));
    const r = await createRetryingFetch(base, [1, 1])("https://x/rest/v1/t");
    expect(r.status).toBe(500);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("leaves a good answer's body readable", async () => {
    const base = vi.fn().mockResolvedValueOnce(ok());
    const r = await createRetryingFetch(base, [1])("https://x/rest/v1/t");
    expect(await r.json()).toEqual([{ id: 1 }]);
  });

  it("stops asking once the caller has cancelled", async () => {
    const base = vi.fn().mockImplementation(async () => stuck());
    const c = new AbortController();
    c.abort();
    const r = await createRetryingFetch(base, [1, 1])("https://x/rest/v1/t", { signal: c.signal });
    expect(r.status).toBe(500);
    expect(base).toHaveBeenCalledTimes(1);
  });
});
