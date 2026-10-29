"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  KeyRound,
  Lock,
  Mail,
  Pencil,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { passwordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/utils";
import {
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithToken,
} from "./actions";

const STORAGE_KEY = "waytara_reset_session";

const METER = [
  "",
  "bg-destructive",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-emerald-600",
] as const;

function StrengthMeter({ password, email }: { password: string; email: string }) {
  if (password.length === 0) return null;
  const s = passwordStrength(password, email);
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full bg-muted transition-colors",
              s.score >= i && METER[s.score]
            )}
          />
        ))}
        <span className="ml-2 w-16 text-right text-xs font-medium text-muted-foreground">
          {s.label}
        </span>
      </div>
      {s.tips[0] && <p className="text-xs text-muted-foreground">{s.tips[0]}</p>}
    </div>
  );
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = React.useState<"email" | "otp" | "password">("email");
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState<string[]>(["", "", "", "", "", ""]);
  const [resetToken, setResetToken] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Strictly partitioned per-step errors so OTP errors can NEVER leak onto the password screen
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  const [resendCooldown, setResendCooldown] = React.useState(0);

  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const isVerifyingRef = React.useRef(false);
  const verifyRequestIdRef = React.useRef(0);

  // Restore active reset session from sessionStorage so reload does not trap user on step 1.
  // (Storage is only readable in the browser, so this cannot be the initial state: the server render and the first client render must match.)
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.email) {
          setEmail(parsed.email);
          if (parsed.step === "otp") {
            setStep("otp");
            if (parsed.cooldownUntil) {
              const remaining = Math.max(0, Math.ceil((parsed.cooldownUntil - Date.now()) / 1000));
              setResendCooldown(remaining);
            }
          } else if (parsed.step === "password" && parsed.resetToken) {
            setResetToken(parsed.resetToken);
            setStep("password");
          }
        }
      }
    } catch {}
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Sync active reset session to sessionStorage
  React.useEffect(() => {
    try {
      if (step === "otp" && email) {
        const cooldownUntil = Date.now() + resendCooldown * 1000;
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ email, step: "otp", cooldownUntil })
        );
      } else if (step === "password" && email && resetToken) {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ email, step: "password", resetToken })
        );
      } else if (step === "email") {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, [step, email, resetToken, resendCooldown]);

  // Prevent accidental browser back button when locked in OTP verification or password reset
  React.useEffect(() => {
    if (step === "otp" || step === "password") {
      window.history.pushState({ step }, "");
      const onPopState = () => {
        window.history.pushState({ step }, "");
      };
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    }
  }, [step]);

  // Timer countdown for resending code
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus the first box whenever entering the OTP step
  React.useEffect(() => {
    if (step === "otp") {
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Step 1: Request 6-digit OTP code to email
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError("Please enter your email address.");
      return;
    }

    setBusy(true);
    setEmailError(null);
    setOtpError(null);
    setPasswordError(null);

    try {
      const res = await requestPasswordResetOtp(cleanEmail);
      if (!res.success) {
        setEmailError(res.message || "Failed to send code.");
        if (res.cooldownSeconds) setResendCooldown(res.cooldownSeconds);
      } else {
        setOtp(["", "", "", "", "", ""]);
        setStep("otp");
        setResendCooldown(res.cooldownSeconds ?? 60);
      }
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  // Explicit Edit Email action: Only this allows returning to Step 1 to edit email
  const handleEditEmail = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    setEmailError(null);
    setOtpError(null);
    setPasswordError(null);
    setStep("email");
  };

  // Step 2: Auto-verify or manual verify 6-digit OTP with strict concurrency & race-condition lock
  const triggerVerify = React.useCallback(
    async (codeToVerify: string) => {
      if (codeToVerify.length !== 6 || isVerifyingRef.current) return;

      isVerifyingRef.current = true;
      setBusy(true);
      setOtpError(null);

      const currentReqId = ++verifyRequestIdRef.current;

      try {
        const res = await verifyPasswordResetOtp(email, codeToVerify);

        // If a newer request was dispatched while this was pending, discard stale result
        if (currentReqId !== verifyRequestIdRef.current) return;

        if (!res.success || !res.resetToken) {
          setOtpError(res.message || "Invalid verification code.");
          // Clear boxes on failure and focus back on first box
          setOtp(["", "", "", "", "", ""]);
          setTimeout(() => inputRefs.current[0]?.focus(), 50);
          setBusy(false);
          isVerifyingRef.current = false;
        } else {
          // Success: wipe OTP errors and advance cleanly to password step
          setResetToken(res.resetToken);
          setOtpError(null);
          setPasswordError(null);
          setBusy(false);
          isVerifyingRef.current = false;
          setStep("password");
        }
      } catch (err) {
        if (currentReqId === verifyRequestIdRef.current) {
          setOtpError(err instanceof Error ? err.message : "Could not verify code.");
          setBusy(false);
          isVerifyingRef.current = false;
        }
      }
    },
    [email]
  );

  // OTP individual box change handler
  const handleOtpChange = (index: number, val: string) => {
    // Keep only numbers
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      const next = [...otp];
      next[index] = "";
      setOtp(next);
      return;
    }

    const lastDigit = clean.slice(-1);
    const next = [...otp];
    next[index] = lastDigit;
    setOtp(next);
    setOtpError(null);

    // Auto-advance focus to next square
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 6 digits are now filled
    const fullCode = next.join("");
    if (fullCode.length === 6 && next.every((d) => d !== "")) {
      void triggerVerify(fullCode);
    }
  };

  // OTP Keyboard navigation (backspace, arrow keys)
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (otp[index] !== "") {
        // Clear current box
        const next = [...otp];
        next[index] = "";
        setOtp(next);
      } else if (index > 0) {
        // Move back and clear previous box
        inputRefs.current[index - 1]?.focus();
        const next = [...otp];
        next[index - 1] = "";
        setOtp(next);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  // OTP Paste handler (supports pasting 6-digit code anywhere)
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const digits = pastedText.replace(/\D/g, "").slice(0, 6);
    if (!digits) return;

    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < digits.length; i++) {
      next[i] = digits[i]!;
    }
    setOtp(next);
    setOtpError(null);

    const targetIndex = Math.min(digits.length, 5);
    inputRefs.current[targetIndex]?.focus();

    // Auto verify if all 6 digits were pasted
    if (digits.length === 6) {
      void triggerVerify(digits);
    }
  };

  // Clear all 6 OTP boxes
  const handleClearOtp = () => {
    setOtp(["", "", "", "", "", ""]);
    setOtpError(null);
    inputRefs.current[0]?.focus();
  };

  // Resend OTP code with isResend flag
  const handleResend = async () => {
    if (resendCooldown > 0 || busy) return;
    setBusy(true);
    setOtpError(null);

    try {
      const res = await requestPasswordResetOtp(email, { isResend: true });
      if (!res.success) {
        setOtpError(res.message || "Failed to resend code.");
        if (res.cooldownSeconds) setResendCooldown(res.cooldownSeconds);
      } else {
        setResendCooldown(60);
        handleClearOtp();
      }
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Could not resend code.");
    } finally {
      setBusy(false);
    }
  };

  // Step 3: Change password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    const strength = passwordStrength(newPassword, email);
    if (strength.score < 2) {
      setPasswordError(strength.tips[0] ?? "Please choose a stronger password.");
      return;
    }

    setBusy(true);

    try {
      const res = await resetPasswordWithToken({
        email,
        resetToken,
        newPassword,
        confirmPassword,
      });

      if (!res.success) {
        setPasswordError(res.message || "Failed to change password.");
        setBusy(false);
      } else {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {}
        // Redirect to login page with pre-filled email and success toast
        router.push(
          `/login?success=${encodeURIComponent(
            "Your password has been changed successfully. Please sign in with your new password."
          )}&email=${encodeURIComponent(email)}`
        );
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password.");
      setBusy(false);
    }
  };

  const otpCodeString = otp.join("");
  const isOtpComplete = otpCodeString.length === 6 && otp.every((d) => d !== "");

  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Visual Step Progress Indicator */}
      <div className="flex items-center justify-between gap-2 border-b border-theme-border/60 pb-3 text-xs">
        <div
          className={cn(
            "flex items-center gap-1.5 font-medium transition-colors",
            step === "email" ? "text-theme-highlight" : "text-theme-muted"
          )}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
              step === "email"
                ? "bg-theme-highlight text-white"
                : "bg-theme-highlight-subtle text-theme-highlight"
            )}
          >
            {step !== "email" ? <Check className="size-3" /> : "1"}
          </span>
          <span>Email</span>
        </div>

        <div className="h-px flex-1 bg-theme-border/60" />

        <div
          className={cn(
            "flex items-center gap-1.5 font-medium transition-colors",
            step === "otp"
              ? "text-theme-highlight"
              : step === "password"
              ? "text-theme-muted"
              : "text-theme-muted/50"
          )}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
              step === "otp"
                ? "bg-theme-highlight text-white"
                : step === "password"
                ? "bg-theme-highlight-subtle text-theme-highlight"
                : "bg-theme-surface border border-theme-border/80 text-theme-muted"
            )}
          >
            {step === "password" ? <Check className="size-3" /> : "2"}
          </span>
          <span>Verify OTP</span>
        </div>

        <div className="h-px flex-1 bg-theme-border/60" />

        <div
          className={cn(
            "flex items-center gap-1.5 font-medium transition-colors",
            step === "password" ? "text-theme-highlight" : "text-theme-muted/50"
          )}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
              step === "password"
                ? "bg-theme-highlight text-white"
                : "bg-theme-surface border border-theme-border/80 text-theme-muted"
            )}
          >
            3
          </span>
          <span>New Password</span>
        </div>
      </div>

      {/* STEP 1: ENTER EMAIL */}
      {step === "email" && (
        <>
          <div>
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-theme-highlight-subtle text-theme-highlight">
              <KeyRound className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold text-theme-primary">Forgot password</h1>
            <p className="mt-1 text-sm text-theme-muted">
              Enter the email address associated with your WayTara account. We&apos;ll send you a 6-digit verification code.
            </p>
          </div>

          {emailError && (
            <Alert variant="destructive" className="py-2.5">
              <AlertDescription className="text-xs">{emailError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">Email address</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="size-4 animate-spin" />
                  Sending code…
                </span>
              ) : (
                "Send verification code"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-theme-muted">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-theme-highlight hover:underline"
            >
              <ArrowLeft className="size-3" /> Back to sign in
            </Link>
          </p>
        </>
      )}

      {/* STEP 2: VERIFY 6-DIGIT OTP WITH 6 SQUARE BOXES & EDIT EMAIL LOCK */}
      {step === "otp" && (
        <>
          <div>
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-theme-highlight-subtle text-theme-highlight">
              <ShieldCheck className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold text-theme-primary">Verify your email</h1>
            <p className="mt-1 text-sm text-theme-muted">
              Please enter the 6-digit verification code sent to your email address.
            </p>

            {/* Email Verification Card with Explicit Edit Button */}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-theme-border/80 bg-theme-surface/70 px-3.5 py-2.5 shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-theme-highlight-subtle text-theme-highlight">
                  <Mail className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-theme-muted uppercase tracking-wider">
                    Code sent to
                  </p>
                  <p className="truncate text-sm font-semibold text-theme-primary">{email}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleEditEmail}
                disabled={busy}
                className="h-8 shrink-0 gap-1.5 px-2.5 text-xs font-medium text-theme-highlight hover:bg-theme-highlight-subtle hover:text-theme-highlight"
                title="Edit email address"
              >
                <Pencil className="size-3" />
                Edit
              </Button>
            </div>
          </div>

          {otpError && (
            <Alert variant="destructive" className="py-2.5">
              <AlertDescription className="text-xs">{otpError}</AlertDescription>
            </Alert>
          )}

          {busy && (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-theme-highlight-subtle/50 py-2 text-xs font-medium text-theme-highlight animate-pulse">
              <RefreshCw className="size-3.5 animate-spin" />
              Verifying code automatically…
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-theme-muted">
                  6-Digit Verification Code
                </Label>
                <button
                  type="button"
                  onClick={handleClearOtp}
                  disabled={busy || !otp.some((d) => d !== "")}
                  className="inline-flex items-center gap-1 text-xs text-theme-muted transition-colors hover:text-theme-primary disabled:opacity-40 disabled:pointer-events-none"
                  title="Clear code"
                >
                  <RotateCcw className="size-3" />
                  Clear
                </button>
              </div>

              {/* 6 Individual Square OTP Input Boxes with Paste Accept */}
              <div
                className="flex items-center justify-between gap-1.5 sm:gap-2"
                onPaste={handleOtpPaste}
              >
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    value={otp[index]}
                    disabled={busy}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    aria-label={`Digit ${index + 1} of verification code`}
                    className={cn(
                      "size-11 sm:size-12 text-center text-xl sm:text-2xl font-bold font-mono rounded-xl border bg-theme-surface text-theme-primary transition-all outline-none",
                      otpError
                        ? "border-destructive/60 bg-destructive/5 text-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20"
                        : "border-theme-border/90 focus:border-theme-highlight focus:ring-2 focus:ring-theme-highlight/20",
                      otp[index] && "border-theme-highlight/60 bg-theme-highlight-subtle/20"
                    )}
                  />
                ))}
              </div>
            </div>

            <Button
              type="button"
              onClick={() => void triggerVerify(otpCodeString)}
              className="w-full"
              disabled={busy || !isOtpComplete}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="size-4 animate-spin" />
                  Verifying…
                </span>
              ) : (
                "Verify code"
              )}
            </Button>

            <div className="flex items-center justify-between pt-1 text-xs text-theme-muted">
              <span>Didn&apos;t get a code?</span>
              {resendCooldown > 0 ? (
                <span className="font-mono text-theme-muted">
                  Resend in {resendCooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={busy}
                  className="font-medium text-theme-highlight hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* STEP 3: CREATE NEW PASSWORD */}
      {step === "password" && (
        <>
          <div>
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Lock className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold text-theme-primary">Create new password</h1>
            <p className="mt-1 text-sm text-theme-muted">
              Email verified for{" "}
              <strong className="font-medium text-theme-primary">{email}</strong>. Set your new
              secure password.
            </p>
          </div>

          {passwordError && (
            <Alert variant="destructive" className="py-2.5">
              <AlertDescription className="text-xs">{passwordError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError(null);
                }}
                minLength={8}
                autoFocus
                required
              />
              <StrengthMeter password={newPassword} email={email} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError(null);
                }}
                minLength={8}
                required
              />
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match.</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                busy ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword ||
                passwordStrength(newPassword, email).score < 2
              }
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="size-4 animate-spin" />
                  Updating password…
                </span>
              ) : (
                "Change password & sign in"
              )}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
