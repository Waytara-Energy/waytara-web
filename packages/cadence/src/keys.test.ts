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

describe("chargerAddress", () => {
  it("puts the secret and a safe charger name in the path", () => {
    expect(chargerAddress("hub.waytaraenergy.com", "abc123", "ECR Villa #2")).toBe("wss://hub.waytaraenergy.com/ocpp/abc123/ECR-Villa-2");
    expect(chargerAddress("https://hub.x/", "s", "!!!")).toBe("wss://hub.x/ocpp/s/charger");
  });
});
