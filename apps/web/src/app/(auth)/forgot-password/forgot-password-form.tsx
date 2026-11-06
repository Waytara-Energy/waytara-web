"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { passwordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/utils";
import { requestPasswordResetOtp, verifyPasswordResetOtp, resetPasswordWithToken } from "./actions";

type Step = "email" | "code" | "password";

const STORAGE_KEY = "waytara_reset_session";
const STEPS: { id: Step; label: string }[] = [
  { id: "email", label: "E-mail" },
  { id: "code", label: "Code" },
  { id: "password", label: "New password" },
];
const METER = ["", "bg-destructive", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"] as const;

/** Three bars, as on the sign-in page: the ones already done and the one in progress are green, with the name of the step under them. */
function Steps({ step }: { step: Step }) {
  const at = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="flex items-start gap-2" role="list" aria-label="Steps">
      {STEPS.map((s, i) => (
        <div key={s.id} role="listitem" aria-current={i === at ? "step" : undefined} className="flex-1">
          <span className={cn("block h-1 rounded-full transition-colors", i <= at ? "bg-emerald-500" : "bg-theme-border")} />
          <span className={cn("mt-2 block text-xs font-semibold", i === at ? "text-theme-primary" : "text-theme-muted")}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function Heading({ step, title, body }: { step: Step; title: string; body: React.ReactNode }) {
  const at = STEPS.findIndex((s) => s.id === step) + 1;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Step {at} of 3</p>
      <h1 className="mt-2 text-2xl font-semibold text-theme-primary">{title}</h1>
      <p className="mt-1 text-sm leading-relaxed text-theme-muted">{body}</p>
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {children}
    </p>
  );
}

/**
 * Six boxes for the 6-digit code that are really one input, so pasting a code, using the phone's "fill from message" suggestion, typing and Backspace all just
 * work. It is read-only (not disabled) while the code is being checked, so it keeps the keyboard.
 */
function CodeInput({ value, onChange, locked, invalid }: { value: string; onChange: (digits: string) => void; locked: boolean; invalid: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => {
    ref.current?.focus();
  }, []);
  const caret = Math.min(value.length, 5);
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => {
          const ch = value[i];
          const active = focused && !locked && i === caret;
          return (
            <span
              key={i}
              className={cn(
                "flex h-14 flex-1 items-center justify-center rounded-xl border text-2xl font-bold tabular-nums text-theme-primary transition-colors",
                invalid
                  ? "border-destructive/60 bg-destructive/5"
                  : active
                    ? "border-emerald-500 ring-2 ring-emerald-500/20"
                    : ch
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : "border-theme-border bg-theme-surface",
                locked && "opacity-60"
              )}
            >
              {ch ?? (active ? <span className="h-6 w-px animate-pulse bg-emerald-600" /> : null)}
            </span>
          );
        })}
      </div>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        readOnly={locked}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="6-digit verification code"
        aria-invalid={invalid}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
    </div>
  );
}

function StrengthMeter({ password, email }: { password: string; email: string }) {
  if (password.length === 0) return null;
  const s = passwordStrength(password, email);
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full bg-theme-border transition-colors", s.score >= i && METER[s.score])} />
        ))}
        <span className="ml-2 w-16 text-right text-xs font-semibold text-theme-secondary">{s.label}</span>
      </div>
      {s.tips[0] && <p className="text-xs text-theme-muted">{s.tips[0]}</p>}
    </div>
  );
}

/**
 * Forgot password, in three steps: the e-mail address, the 6-digit code, the new password. The code is checked by itself the moment the sixth digit is in
 * (one check at a time, with one sign that it is happening); the button is only there for anyone who prefers to press it.
 */
export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [resetToken, setResetToken] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** The reason no code was sent, when Support is the way forward. */
  const [help, setHelp] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const checking = React.useRef(false);

  // Pick up where the person was if the page is reloaded (the browser's storage cannot be read before the page is in the browser, so this is not the first state).
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
      if (!saved?.email) return;
      setEmail(saved.email);
      if (saved.step === "code") {
        setStep("code");
        setCooldown(Math.max(0, Math.ceil(((saved.cooldownUntil ?? 0) - Date.now()) / 1000)));
      } else if (saved.step === "password" && saved.resetToken) {
        setResetToken(saved.resetToken);
        setStep("password");
      }
    } catch {
      /* nothing saved, or storage is off: start at the first step */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  React.useEffect(() => {
    try {
      if (step === "code" && email) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email, step, cooldownUntil: Date.now() + cooldown * 1000 }));
      else if (step === "password" && email && resetToken) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email, step, resetToken }));
      else if (step === "email") sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage is off: the flow still works, it just does not survive a reload */
    }
  }, [step, email, resetToken, cooldown]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendCode(e?: React.FormEvent, isResend = false) {
    e?.preventDefault();
    const clean = email.trim();
    if (!clean) return setError("Enter the e-mail address on your account.");
    setBusy(true);
    setError(null);
    setHelp(false);
    try {
      const res = await requestPasswordResetOtp(clean, { isResend });
      if (!res.success) {
        setError(res.message || "We could not send the code. Please try again.");
        setHelp(Boolean(res.reason));
        if (res.cooldownSeconds) setCooldown(res.cooldownSeconds);
        return;
      }
      setEmail(clean);
      setCode("");
      setCooldown(res.cooldownSeconds ?? 60);
      setStep("code");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const verify = React.useCallback(
    async (digits: string) => {
      if (digits.length !== 6 || checking.current) return;
      checking.current = true;
      setBusy(true);
      setError(null);
      try {
        const res = await verifyPasswordResetOtp(email, digits);
        if (!res.success || !res.resetToken) {
          setError(res.message || "That code did not work.");
          setCode("");
          return;
        }
        setResetToken(res.resetToken);
        setStep("password");
      } catch {
        setError("Something went wrong. Please try again.");
        setCode("");
      } finally {
        checking.current = false;
        setBusy(false);
      }
    },
    [email]
  );

  function changeEmail() {
    setCode("");
    setError(null);
    setStep("email");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) return setError("Use at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("The two passwords do not match.");
    const strength = passwordStrength(newPassword, email);
    if (strength.score < 2) return setError(strength.tips[0] ?? "Choose a stronger password.");
    setBusy(true);
    try {
      const res = await resetPasswordWithToken({ email, resetToken, newPassword, confirmPassword });
      if (!res.success) {
        setError(res.message || "We could not change your password.");
        setBusy(false);
        return;
      }
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* nothing to clear */
      }
      router.replace(`/login?success=${encodeURIComponent("Your password has been changed. Sign in with your new password.")}&email=${encodeURIComponent(email)}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-7">
      <Steps step={step} />

      {step === "email" && (
        <form onSubmit={sendCode} className="space-y-5">
          <Heading step="email" title="Forgot your password?" body="Enter the e-mail address on your WayTara account and we will send you a 6-digit code." />
          {error && (
            <ErrorLine>
              {help
                ? error.split(/(contact support)/i).map((part, i) =>
                    /^contact support$/i.test(part) ? (
                      <Link key={i} href="/support" className="font-semibold underline underline-offset-4">
                        {part}
                      </Link>
                    ) : (
                      part
                    )
                  )
                : error}
            </ErrorLine>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="reset-email">E-mail address</Label>
            <Input id="reset-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Sending…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                Send code <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            )}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="inline-flex items-center gap-1 font-medium text-theme-highlight hover:underline">
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to sign in
            </Link>
          </p>
        </form>
      )}

      {step === "code" && (
        <div className="space-y-5">
          <Heading
            step="code"
            title="Check your e-mail"
            body={
              <>
                We sent a 6-digit code to <span className="font-semibold text-theme-primary">{email}</span>. It lasts 10 minutes. If it does not arrive, look in your spam folder.
              </>
            }
          />
          <p className="text-sm">
            <button type="button" onClick={changeEmail} disabled={busy} className="font-medium text-theme-highlight hover:underline disabled:opacity-50">
              Wrong address? Change it
            </button>
          </p>
          {error && <ErrorLine>{error}</ErrorLine>}
          <CodeInput value={code} onChange={(d) => {
              setCode(d);
              setError(null);
              // the sixth digit starts the check by itself
              if (d.length === 6) void verify(d);
            }} locked={busy} invalid={Boolean(error)} />
          <Button type="button" className="w-full" disabled={busy || code.length !== 6} onClick={() => void verify(code)}>
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking…
              </span>
            ) : (
              "Verify code"
            )}
          </Button>
          <p className="flex items-center justify-between text-sm text-theme-muted">
            <span>Did not get it?</span>
            {cooldown > 0 ? (
              <span className="tabular-nums">Send again in {cooldown}s</span>
            ) : (
              <button type="button" onClick={() => void sendCode(undefined, true)} disabled={busy} className="font-medium text-theme-highlight hover:underline disabled:opacity-50">
                Send a new code
              </button>
            )}
          </p>
        </div>
      )}

      {step === "password" && (
        <form onSubmit={savePassword} className="space-y-5">
          <Heading step="password" title="Choose a new password" body={<>Your e-mail address, <span className="font-semibold text-theme-primary">{email}</span>, is confirmed.</>} />
          {error && <ErrorLine>{error}</ErrorLine>}
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput id="new-password" autoComplete="new-password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setError(null); }} minLength={8} autoFocus required />
            <StrengthMeter password={newPassword} email={email} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput id="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }} minLength={8} required />
            {confirmPassword.length > 0 && newPassword !== confirmPassword && <p className="text-xs text-destructive">The two passwords do not match.</p>}
          </div>
          <Button type="submit" className="w-full" disabled={busy || newPassword.length < 8 || newPassword !== confirmPassword || passwordStrength(newPassword, email).score < 2}>
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Saving…
              </span>
            ) : (
              "Save new password"
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
