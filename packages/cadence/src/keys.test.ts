import { describe, expect, it } from "vitest";
import { KeysApiError, chargerAddress, createKeysClient } from "./keys";

function fake(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof globalThis.fetch;
  return { calls, client: createKeysClient({ baseUrl: "https://hub.example/", getToken: async () => "tok", fetch }) };
}

describe("keys client", () => {
  it("creates a key for a device and sends the signed-in token", async () => {
    const { calls, client } = fake(201, { key_id: "k", secret: "s" });
    await client.create("00000000-0000-4000-8000-000000000001", "charger", "  Bay 1 ");
    expect(calls[0]!.url).toBe("https://hub.example/v1/equipment/00000000-0000-4000-8000-000000000001/keys");
    expect(calls[0]!.init.method).toBe("POST");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ kind: "charger", label: "Bay 1" });
  });

  it("rotates with a grace period and revokes with a reason", async () => {
    const r = fake(201, {});
    await r.client.rotate("k1", 600);
    expect(r.calls[0]!.url).toBe("https://hub.example/v1/keys/k1/rotate");
    expect(JSON.parse(r.calls[0]!.init.body as string)).toEqual({ grace_seconds: 600 });
    const d = fake(200, { revoked: true });
    await d.client.revoke("k1", "lost");
    expect(d.calls[0]!.init.method).toBe("DELETE");
    expect(JSON.parse(d.calls[0]!.init.body as string)).toEqual({ reason: "lost" });
  });

  it("asks for a claim ticket for one board of one equipment", async () => {
    const { calls, client } = fake(201, { ticket: "t", expires_at: "2026-10-16T00:00:00Z" });
    expect(await client.issueClaimTicket("00000000-0000-4000-8000-000000000001", "2884855505D0")).toMatchObject({ ticket: "t" });
    expect(calls[0]!.url).toBe("https://hub.example/v1/equipment/00000000-0000-4000-8000-000000000001/claim-tickets");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ hardware_id: "2884855505D0" });
  });

  it("does not call out without a sign-in, and gives plain messages for refusals", async () => {
    const none = createKeysClient({ baseUrl: "https://x", getToken: async () => null, fetch: (() => { throw new Error("no call expected"); }) as unknown as typeof fetch });
    await expect(none.revoke("k")).rejects.toMatchObject({ status: 401 });
    await expect(fake(404, {}).client.revoke("k")).rejects.toThrow(/can't manage keys/);
    await expect(fake(409, {}).client.rotate("k")).rejects.toBeInstanceOf(KeysApiError);
  });
});

describe("changing a unit's key", () => {
  const eq = "00000000-0000-4000-8000-000000000001";

  it("asks where the change stands with a GET and no body, and starts one with a POST", async () => {
    const s = fake(200, { state: "none", rotation_id: null, started_at: null, expires_at: null, can_start: true, reason: null });
    expect(await s.client.keyChangeStatus(eq)).toMatchObject({ state: "none", can_start: true });
    expect(s.calls[0]!.url).toBe(`https://hub.example/v1/equipment/${eq}/rotation`);
    expect(s.calls[0]!.init.method).toBe("GET");
    expect(s.calls[0]!.init.body).toBeUndefined();
    expect((s.calls[0]!.init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    const p = fake(202, { state: "sent", rotation_id: "r1", started_at: "x", expires_at: "y" });
    expect(await p.client.startKeyChange(eq)).toMatchObject({ rotation_id: "r1" });
    expect(p.calls[0]!.init.method).toBe("POST");
  });

  it("shows the hub's own plain reason when the unit cannot do it now, but not an unexpected message", async () => {
    const reason = "The unit is not online right now. A key can only be changed while the unit is connected.";
    await expect(fake(409, { error: { code: "not_possible", message: reason } }).client.startKeyChange(eq)).rejects.toThrow(reason);
    await expect(fake(409, { error: { message: "x".repeat(500) } }).client.startKeyChange(eq)).rejects.toThrow(/conflicts with the current state/);
    await expect(fake(500, { error: { message: "database password=hunter2" } }).client.startKeyChange(eq)).rejects.toThrow(/unavailable/);
    await expect(fake(404, {}).client.keyChangeStatus(eq)).rejects.toMatchObject({ status: 404 });
  });
});

describe("releasing a unit", () => {
  it("asks the hub to unlink the unit from the device, with the signed-in token", async () => {
    const { calls, client } = fake(200, { released: true });
    expect(await client.releaseBoard("00000000-0000-4000-8000-000000000001")).toEqual({ released: true });
    expect(calls[0]!.url).toBe("https://hub.example/v1/equipment/00000000-0000-4000-8000-000000000001/release");
    expect(calls[0]!.init.method).toBe("POST");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("says plainly when the person may not do it, and does not call out without a sign-in", async () => {
    await expect(fake(404, {}).client.releaseBoard("e")).rejects.toThrow(/can't manage keys/);
    const none = createKeysClient({ baseUrl: "https://x", getToken: async () => null, fetch: (() => { throw new Error("no call expected"); }) as unknown as typeof fetch });
    await expect(none.releaseBoard("e")).rejects.toMatchObject({ status: 401 });
  });
});

describe("chargerAddress", () => {
  it("puts the secret and a safe charger name in the path", () => {
    expect(chargerAddress("hub.waytaraenergy.com", "abc123", "ECR Villa #2")).toBe("wss://hub.waytaraenergy.com/ocpp/abc123/ECR-Villa-2");
    expect(chargerAddress("https://hub.x/", "s", "!!!")).toBe("wss://hub.x/ocpp/s/charger");
  });
});
