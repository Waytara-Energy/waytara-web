import { describe, it, expect, vi } from "vitest";
import { buildPasswordCodeMail, generateCode, hashCode, codeMatches, codeExpired } from "@/lib/email-otp";
import { passwordStrength } from "@/lib/password-strength";

describe("Forgot password OTP generation and email", () => {
  it("generates a 6-digit numeric OTP code", () => {
    const code = generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("builds a branded WayTara password code email with code and styling", () => {
    const mail = buildPasswordCodeMail({ name: "Devaansh Pujara", code: "749201" });
    expect(mail.subject).toBe("749201 is your WayTara password code");
    expect(mail.text).toContain("Hi Devaansh,");
    expect(mail.text).toContain("749201");
    expect(mail.text).toContain("10 minutes");
    expect(mail.html).toContain("749201");
    expect(mail.html).toContain("The WayTara Team");
  });

  it("correctly hashes and matches the OTP code", () => {
    const secret = "test-secret-key-123";
    const userId = "c1000000-0000-0000-0000-000000000001";
    const scope = "password-change";
    const code = "582910";

    const hash = hashCode(secret, userId, scope, code);
    expect(codeMatches(secret, userId, scope, code, hash)).toBe(true);
    expect(codeMatches(secret, userId, scope, "999999", hash)).toBe(false);
  });

  it("checks code expiration correctly", () => {
    const now = Date.now();
    const futureExpiry = new Date(now + 10 * 60_000).toISOString();
    const pastExpiry = new Date(now - 10_000).toISOString();

    expect(codeExpired(futureExpiry, now)).toBe(false);
    expect(codeExpired(pastExpiry, now)).toBe(true);
  });

  it("enforces password strength requirements during reset", () => {
    const weak = passwordStrength("12345678", "user@waytara.com");
    expect(weak.score).toBeLessThan(2);

    const good = passwordStrength("K8#mP$9xL!vQ2026", "user@waytara.com");
    expect(good.score).toBeGreaterThanOrEqual(2);
  });

  it("hashes and matches reset tokens in two-phase verification", () => {
    const secret = "test-secret-key-123";
    const userId = "c1000000-0000-0000-0000-000000000001";
    const resetToken = "9f8b4c2e-a1d3-4e5f-b6a7-c8d9e0f1a2b3";
    const tokenScope = "password-reset-token";

    const tokenHash = hashCode(secret, userId, tokenScope, resetToken);
    expect(codeMatches(secret, userId, tokenScope, resetToken, tokenHash)).toBe(true);
    expect(codeMatches(secret, userId, tokenScope, "wrong-token", tokenHash)).toBe(false);
  });

  it("handles 6-digit OTP extraction from paste strings", () => {
    const extractDigits = (val: string) => val.replace(/\D/g, "").slice(0, 6);
    expect(extractDigits("123456")).toBe("123456");
    expect(extractDigits("482-910")).toBe("482910");
    expect(extractDigits("Your code is: 839 201.")).toBe("839201");
    expect(extractDigits("12")).toBe("12");
  });

  it("renders ForgotPasswordForm initial step with progress indicators", async () => {
    vi.mock("./actions", () => ({
      requestPasswordResetOtp: vi.fn(),
      verifyPasswordResetOtp: vi.fn(),
      resetPasswordWithToken: vi.fn(),
    }));

    vi.mock("next/navigation", () => ({
      useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    }));

    const React = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { ForgotPasswordForm } = await import("./forgot-password-form");

    const html = renderToString(React.createElement(ForgotPasswordForm));
    expect(html).toContain("Forgot password");
    expect(html).toContain("Email");
    expect(html).toContain("Verify OTP");
    expect(html).toContain("New Password");
    expect(html).toContain("Send verification code");
  });
});
