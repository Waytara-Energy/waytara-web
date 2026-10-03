import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { isCronAuthorized } from "./cron-auth";

const req = (authorization?: string) =>
  ({ headers: new Headers(authorization ? { authorization } : {}) }) as unknown as NextRequest;

describe("isCronAuthorized", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("FAILS CLOSED in production when CRON_SECRET is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(isCronAuthorized(req(), "t")).toBe(false);
    expect(isCronAuthorized(req("Bearer anything"), "t")).toBe(false);
  });

  it("tolerates an unset secret outside production (local dev)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CRON_SECRET", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(isCronAuthorized(req(), "t")).toBe(true);
  });

  it("accepts only the exact bearer secret when configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isCronAuthorized(req("Bearer s3cret"), "t")).toBe(true);
    expect(isCronAuthorized(req("Bearer s3cre"), "t")).toBe(false);
    expect(isCronAuthorized(req("Bearer s3cretX"), "t")).toBe(false);
    expect(isCronAuthorized(req("s3cret"), "t")).toBe(false);
    expect(isCronAuthorized(req(), "t")).toBe(false);
  });
});
