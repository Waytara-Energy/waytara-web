"use server";

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
  MAX_ATTEMPTS,
  buildPasswordCodeMail,
} from "@/lib/email-otp";
import { sendMail } from "@/lib/send-mail";
import { passwordStrength } from "@/lib/password-strength";
import { notifyAuthEvent } from "@/lib/auth-notify";

const PASSWORD_CODE_SCOPE = "password-change";

function codeSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("The server is not configured to process password resets.");
  return secret;
}

export interface RequestResetResult {
  success: boolean;
  message?: string;
  sentTo?: string;
  cooldownSeconds?: number;
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

  const service = createServiceRoleClient();

  // Find user by email in profiles
  const { data: profile } = await service
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", email)
    .maybeSingle();

  let userId = profile?.id;
  let fullName = profile?.full_name ?? null;

  if (!userId) {
    // Also check auth.users directly via admin client in case profile row is missing
    const { data: userList } = await service.auth.admin.listUsers();
    const matched = userList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (matched) {
      userId = matched.id;
      fullName = (matched.user_metadata?.full_name as string) || (matched.user_metadata?.name as string) || null;
    }
  }

  // To protect privacy, if user is not found, we return success without leaking that account doesn't exist
  if (!userId) {
    return { success: true, sentTo: email };
  }

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

  const sent = await sendMail(email, buildPasswordCodeMail({ name: fullName, code }));

  if (sent !== "sent") {
    console.error("[forgot-password] Email sending failed:", sent);
    await service.from("password_change_codes").delete().eq("user_id", userId);
    return { success: false, message: "We could not send the verification email. Please try again in a moment." };
  }

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

  // Find user by email
  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  let userId = profile?.id;
  if (!userId) {
    const { data: userList } = await service.auth.admin.listUsers();
    const matched = userList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (matched) userId = matched.id;
  }

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

  const { data: profile } = await service
    .from("profiles")
    .select("id, full_name, email, notification_preferences")
    .ilike("email", email)
    .maybeSingle();

  let userId = profile?.id;
  if (!userId) {
    const { data: userList } = await service.auth.admin.listUsers();
    const matched = userList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (matched) userId = matched.id;
  }

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
