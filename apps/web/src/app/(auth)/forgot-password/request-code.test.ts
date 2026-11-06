import { beforeEach, describe, expect, it, vi } from "vitest";

// The request step of forgot-password, with the database, the rate limiter and the mailer replaced, so nothing real is touched.

const state = {
  profile: null as null | { id: string; full_name: string | null; email: string; notification_preferences: unknown; deactivated_at: string | null; deleted_at: string | null },
  pending: null as null | { created_at: string },
  allowed: true,
};
const calls = { upsert: 0, mail: 0, afterJobs: [] as (() => Promise<void> | void)[] };

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.9" }) }));
vi.mock("next/server", () => ({ after: (job: () => Promise<void> | void) => void calls.afterJobs.push(job) }));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: async () => state.allowed, clientIp: () => "203.0.113.9" }));
vi.mock("@/lib/send-mail", () => ({
  sendMail: async () => {
    calls.mail += 1;
    return "sent";
  },
}));
vi.mock("@/lib/auth-notify", () => ({ notifyAuthEvent: async () => {} }));
vi.mock("@waytara/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "profiles") {
        const q = { select: () => q, ilike: () => q, limit: () => q, maybeSingle: async () => ({ data: state.profile }) };
        return q;
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.pending }) }) }),
        upsert: async () => {
          calls.upsert += 1;
          return { error: null };
        },
        delete: () => ({ eq: async () => ({}) }),
      };
    },
  }),
}));

const person = { id: "u1", full_name: "Priya Raman", email: "priya@example.com", notification_preferences: null, deactivated_at: null, deleted_at: null };

beforeEach(() => {
  state.profile = null;
  state.pending = null;
  state.allowed = true;
  calls.upsert = 0;
  calls.mail = 0;
  calls.afterJobs = [];
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
});

describe("asking for a password code", () => {
  it("says so, and sends nothing, when the address has no account", async () => {
    const { requestPasswordResetOtp } = await import("./actions");
    const res = await requestPasswordResetOtp("nobody@example.com");
    expect(res.success).toBe(false);
    expect(res.reason).toBe("not_registered");
    expect(res.message).toMatch(/not registered/i);
    expect(res.message).toMatch(/contact support/i);
    expect(calls.upsert).toBe(0);
    expect(calls.afterJobs).toHaveLength(0);
    expect(calls.mail).toBe(0);
  });

  it("does not send a code to an account that is switched off", async () => {
    state.profile = { ...person, deactivated_at: "2026-10-01T00:00:00Z" };
    const { requestPasswordResetOtp } = await import("./actions");
    const res = await requestPasswordResetOtp("priya@example.com");
    expect(res).toMatchObject({ success: false, reason: "not_active" });
    expect(calls.upsert).toBe(0);
    expect(calls.afterJobs).toHaveLength(0);
  });

  it("stops a visitor who has tried too many addresses, before looking anything up", async () => {
    state.allowed = false;
    state.profile = person;
    const { requestPasswordResetOtp } = await import("./actions");
    const res = await requestPasswordResetOtp("priya@example.com");
    expect(res).toMatchObject({ success: false, reason: "too_many" });
    expect(calls.upsert).toBe(0);
  });

  it("stores a code and sends the e-mail (after the answer) for a registered address", async () => {
    state.profile = person;
    const { requestPasswordResetOtp } = await import("./actions");
    const res = await requestPasswordResetOtp("Priya@Example.com");
    expect(res).toMatchObject({ success: true, sentTo: "priya@example.com" });
    expect(calls.upsert).toBe(1);
    expect(calls.afterJobs).toHaveLength(1);
    await calls.afterJobs[0]();
    expect(calls.mail).toBe(1);
  });

  it("still rejects a badly formed address first, without using up a check", async () => {
    const { requestPasswordResetOtp } = await import("./actions");
    const res = await requestPasswordResetOtp("not-an-email");
    expect(res.success).toBe(false);
    expect(res.reason).toBeUndefined();
  });
});
