"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import {
  EMAIL_PATTERN,
  normaliseEmail,
  generateCode,
  hashCode,
  codeMatches,
  codeExpired,
  canResend,
  secondsUntilResend,
  CODE_TTL_MS,
  NOT_REGISTERED_MESSAGE,
  NOT_ACTIVE_MESSAGE,
  TOO_MANY_LOOKUPS_MESSAGE,
  MAX_ATTEMPTS,
  buildPasswordCodeMail,
} from "@/lib/email-otp";
import { sendMail } from "@/lib/send-mail";
import { passwordStrength } from "@/lib/password-strength";
import { notifyAuthEvent } from "@/lib/auth-notify";
import { escapeLike } from "@/lib/like-escape";
import { allowRequest, clientIp } from "@/lib/rate-limit";

const PASSWORD_CODE_SCOPE = "password-change";

function codeSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("The server is not configured to process password resets.");
  return secret;
}

/** How many e-mail addresses one visitor can try on the forgot-password page in an hour: room for a few typos, not enough to scan for accounts. */
const LOOKUPS_PER_HOUR = 12;

type Service = ReturnType<typeof createServiceRoleClient>;

/**
 * The account for an e-mail address, matched exactly (ignoring upper and lower case). It used to be matched with the address as a raw `ilike` pattern, where `_`
 * means "any character": `john_doe@x.com` found the account of `john.doe@x.com`, so a code for one person's account could be sent to another address. It also
 * fell back to listing every user when nothing matched, which was slow and only looked at the first page of users. A customer without a profile cannot sign in
 * to the dashboard anyway (sign-in turns them away), so there is nothing to reset for them and no fallback is needed.
 */
async function findProfile(service: Service, email: string) {
  const { data } = await service
    .from("profiles")
    .select("id, full_name, email, notification_preferences, deactivated_at, deleted_at")
    .ilike("email", escapeLike(email))
    .limit(1)
    .maybeSingle();
  return data;
}

export interface RequestResetResult {
  success: boolean;
  message?: string;
  sentTo?: string;
  cooldownSeconds?: number;
  /** Why no code was sent, when it is something the page should explain with a link to Support. */
  reason?: "not_registered" | "not_active" | "too_many";
}

/** Sends a 6-digit verification code to the user's email address via WayTara email. */
export async function requestPasswordResetOtp(
  emailRaw: string,
  options?: { isResend?: boolean }
): Promise<RequestResetResult> {
  const email = normaliseEmail(emailRaw ?? "");
  if (!email || !EMAIL_PATTERN.test(email) || email.length > 200) {
    return { success: false, message: "Please enter a valid email address." };
  }

  // The person is told when an address has no account, so a typo does not leave them waiting for an e-mail that never comes (and nothing is sent to an address that
  // is not ours to write to). The cost is that this page can be used to check whether an address has an account, so each visitor gets a limited number of checks an hour.
  if (!(await allowRequest("forgot-password:ip", clientIp(await headers()), LOOKUPS_PER_HOUR, 60 * 60))) {
    return { success: false, message: TOO_MANY_LOOKUPS_MESSAGE, reason: "too_many" };
  }

  const service = createServiceRoleClient();

  const profile = await findProfile(service, email);
  if (!profile) return { success: false, message: NOT_REGISTERED_MESSAGE, reason: "not_registered" };
  if (profile.deactivated_at || profile.deleted_at) return { success: false, message: NOT_ACTIVE_MESSAGE, reason: "not_active" };
  const userId = profile.id;
  const fullName = profile.full_name ?? null;

  // Check cooldown if there's already a code requested recently
  const { data: pending } = await service
    .from("password_change_codes")
    .select("created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (pending && !canResend(pending.created_at, Date.now())) {
    const remaining = secondsUntilResend(pending.created_at, Date.now());
    // If the user explicitly clicked "Resend code", enforce cooldown error
    if (options?.isResend) {
      return {
        success: false,
        message: `Please wait ${remaining} seconds before asking for another code.`,
        cooldownSeconds: remaining,
      };
    }
    // If user submitted their email on step 1 while code is already active, advance them to OTP step!
    return {
      success: true,
      sentTo: email,
      cooldownSeconds: remaining,
    };
  }

  const code = generateCode();

  const { error: upsertErr } = await service.from("password_change_codes").upsert({
    user_id: userId,
    code_hash: hashCode(codeSecret(), userId, PASSWORD_CODE_SCOPE, code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    attempts: 0,
    created_at: new Date().toISOString(),
  });

  if (upsertErr) {
    console.error("[forgot-password] Database error storing code:", upsertErr);
    return { success: false, message: "Could not create verification code. Please try again." };
  }

  // The e-mail goes out after the answer is sent: the person does not wait for the mail provider (about half a second), and an address that has an account
  // now takes much the same time as one that has not. If the mail cannot be sent the pending code is removed, so asking again is not held up by the cooldown.
  after(async () => {
    const sent = await sendMail(email, buildPasswordCodeMail({ name: fullName, code }));
    if (sent !== "sent") {
      console.error("[forgot-password] Email sending failed:", sent);
      await service.from("password_change_codes").delete().eq("user_id", userId);
    }
  });

  return { success: true, sentTo: email };
}

const RESET_TOKEN_SCOPE = "password-reset-token";

export interface VerifyOtpResult {
  success: boolean;
  message?: string;
  resetToken?: string;
}

/** Verifies the 6-digit code and returns a one-time reset token for password update. */
export async function verifyPasswordResetOtp(emailRaw: string, codeRaw: string): Promise<VerifyOtpResult> {
  const email = normaliseEmail(emailRaw ?? "");
  const code = (codeRaw ?? "").replace(/\s+/g, "");

  if (!email || !EMAIL_PATTERN.test(email)) {
    return { success: false, message: "Invalid email address." };
  }
  if (!/^\d{6}$/.test(code)) {
    return { success: false, message: "Verification code must be 6 digits." };
  }

  const service = createServiceRoleClient();

  const userId = (await findProfile(service, email))?.id;

  if (!userId) {
    return { success: false, message: "Invalid verification code or user not found." };
  }

  const { data: row } = await service
    .from("password_change_codes")
    .select("code_hash, expires_at, attempts")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    return { success: false, message: "No verification code was requested or it has expired. Please request a new code." };
  }

  if (codeExpired(row.expires_at, Date.now())) {
    await service.from("password_change_codes").delete().eq("user_id", userId);
    return { success: false, message: "Verification code has expired. Please request a new one." };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await service.from("password_change_codes").delete().eq("user_id", userId);
    return { success: false, message: "Too many incorrect attempts. Please request a new code." };
  }

  if (!codeMatches(codeSecret(), userId, PASSWORD_CODE_SCOPE, code, row.code_hash)) {
    await service.from("password_change_codes").update({ attempts: row.attempts + 1 }).eq("user_id", userId);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return {
      success: false,
      message: left > 0 ? `Incorrect verification code. ${left} ${left === 1 ? "attempt" : "attempts"} left.` : "Too many incorrect attempts. Please request a new code.",
    };
  }

  // Code verified! Issue a one-time reset token and store its hash
  const resetToken = crypto.randomUUID();
  const { error: tokenErr } = await service.from("password_change_codes").update({
    code_hash: hashCode(codeSecret(), userId, RESET_TOKEN_SCOPE, resetToken),
    attempts: 0,
  }).eq("user_id", userId);

  if (tokenErr) {
    console.error("[forgot-password] Failed to store reset token:", tokenErr);
    return { success: false, message: "Could not complete verification. Please try again." };
  }

  return { success: true, resetToken };
}

export interface ResetPasswordResult {
  success: boolean;
  message?: string;
}

/** Updates the user's password using the verified reset token. */
export async function resetPasswordWithToken(input: {
  email: string;
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ResetPasswordResult> {
  const email = normaliseEmail(input.email ?? "");
  const resetToken = (input.resetToken ?? "").trim();
  const newPassword = input.newPassword ?? "";
  const confirmPassword = input.confirmPassword ?? "";

  if (!email || !EMAIL_PATTERN.test(email)) {
    return { success: false, message: "Invalid email address." };
  }
  if (!resetToken) {
    return { success: false, message: "Verification expired or invalid. Please verify your email again." };
  }
  if (newPassword.length < 8) {
    return { success: false, message: "Password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { success: false, message: "Passwords do not match." };
  }

  const strength = passwordStrength(newPassword, email);
  if (strength.score < 2) {
    return { success: false, message: strength.tips[0] ?? "Please choose a stronger password." };
  }

  const service = createServiceRoleClient();

  const profile = await findProfile(service, email);
  const userId = profile?.id;

  if (!userId) {
    return { success: false, message: "User account not found." };
  }

  const { data: row } = await service
    .from("password_change_codes")
    .select("code_hash, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    return { success: false, message: "Password reset session expired. Please start over." };
  }

  if (codeExpired(row.expires_at, Date.now())) {
    await service.from("password_change_codes").delete().eq("user_id", userId);
    return { success: false, message: "Verification session expired. Please start over." };
  }

  if (!codeMatches(codeSecret(), userId, RESET_TOKEN_SCOPE, resetToken, row.code_hash)) {
    return { success: false, message: "Invalid reset session. Please verify your email again." };
  }

  // Update password in Supabase Auth
  const { error: updateErr } = await service.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateErr) {
    console.error("[forgot-password] Failed to update user password:", updateErr);
    return { success: false, message: updateErr.message || "Failed to update password." };
  }

  // Delete used code/token
  await service.from("password_change_codes").delete().eq("user_id", userId);

  // Notify auth event
  if (profile) {
    await notifyAuthEvent("password_changed", profile);
  }

  return { success: true };
}

export interface VerifyResetResult {
  success: boolean;
  message?: string;
}

/** Verifies the 6-digit code and sets the new password in a single step (legacy/fallback). */
export async function verifyOtpAndResetPassword(input: {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<VerifyResetResult> {
  const verifyRes = await verifyPasswordResetOtp(input.email, input.code);
  if (!verifyRes.success || !verifyRes.resetToken) {
    return { success: false, message: verifyRes.message };
  }

  return resetPasswordWithToken({
    email: input.email,
    resetToken: verifyRes.resetToken,
    newPassword: input.newPassword,
    confirmPassword: input.confirmPassword,
  });
}
