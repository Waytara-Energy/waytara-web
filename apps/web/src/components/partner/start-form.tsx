"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { createClient } from "@waytara/supabase/client";
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem } from "@waytara/supabase/partner-account";
import { CodeStep } from "@/components/auth/code-step";
import { PasswordGuide, passwordRules } from "@/components/auth/password-guide";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

type Step = "send" | "code" | "password";

/** How long before another code may be asked for: the server's own gap (RESEND_GAP_MS in partner-otp.ts is 45 s, and the server refuses sooner). */
const RESEND_GAP_SECONDS = 45;

async function post<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: string } | null;
    return res.ok && json?.success ? { ok: true, data: json.data as T } : { ok: false, error: json?.error ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Please check your connection and try again." };
  }
}

/**
 * The page an applicant opens from the onboarding e-mail. Opening it sends a 6-digit code to the address on their application (shown masked, never typed); they
 * (1) enter the code (six boxes, with Paste and Clear, and a countdown before another can be asked for), (2) choose a password (with a list that ticks itself off), and
 * are then signed in and taken to their onboarding. The link says which application this is; only the code proves the address. Messages come as toasts.
 */
export function StartForm({ token, maskedEmail }: { token: string; maskedEmail: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("send");
  const [code, setCode] = React.useState("");
  const [invalid, setInvalid] = React.useState(false);
  const [proof, setProof] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  /** a timestamp, new every time a code was sent: it restarts the "send again" countdown */
  const [sentAt, setSentAt] = React.useState(0);
  const checking = React.useRef(false);

  async function sendCode(again = false) {
    setBusy(true);
    setFailed(false);
    const r = await post(`/api/partner/start/code`, { token });
    setBusy(false);
    if (!r.ok) {
      setFailed(true);
      return notify.error(r.error);
    }
    setCode("");
    setInvalid(false);
    setSentAt(Date.now());
    setStep("code");
    notify.success(again ? `A new code is on its way to ${maskedEmail}. The earlier one no longer works.` : `We sent a 6-digit code to ${maskedEmail}. It works for 10 minutes.`);
  }

  // Opening the link is the request: the code is sent to the address on the application straight away, once. (A ref, not state, so a second render of the same
  // page does not send a second code.) If it cannot be sent, the button to ask for one is still there.
  const asked = React.useRef(false);
  React.useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = React.useCallback(
    async (digits: string) => {
      if (digits.length !== 6 || checking.current) return;
      checking.current = true;
      setBusy(true);
      const r = await post<{ proof: string }>(`/api/partner/start/verify`, { token, code: digits });
      checking.current = false;
      setBusy(false);
      if (!r.ok) {
        setInvalid(true);
        setCode("");
        return notify.error(r.error);
      }
      setProof(r.data.proof);
      setStep("password");
      notify.success("Your e-mail address is confirmed.");
    },
    [token]
  );

  const rulesOk = passwordRules(password, confirm, PASSWORD_MIN).every((r) => r.ok);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password, confirm, "");
    if (problem) return notify.error(problem);
    setBusy(true);
    const r = await post<{ email: string }>(`/api/partner/start/account`, { token, proof, password, confirm });
    if (!r.ok) {
      setBusy(false);
      return notify.error(r.error);
    }
    // the account exists: sign in with the password just chosen, then into the partner area
    const { error: signInError } = await createClient().auth.signInWithPassword({ email: r.data.email, password });
    if (signInError) {
      setBusy(false);
      return notify.error("Your account is ready. Please sign in with your e-mail address and password.");
    }
    notify.success("Welcome to WayTara.");
    router.replace("/partner/portal");
  }

  return (
    <div className="max-w-md space-y-6">
      {step === "send" && (
        <div className="space-y-5">
          <p className="text-[15px] leading-relaxed text-theme-secondary" role="status">
            {busy || !failed ? (
              <>
                <Loader2 className="mr-2 inline size-4 animate-spin align-[-2px]" aria-hidden="true" />
                Sending a 6-digit code to <span className="font-medium text-theme-primary">{maskedEmail}</span>…
              </>
            ) : (
              <>
                To open your partner area, confirm your e-mail address with a 6-digit code sent to <span className="font-medium text-theme-primary">{maskedEmail}</span>.
              </>
            )}
          </p>
          {!busy && failed && (
            <Button type="button" onClick={() => void sendCode()}>
              Send me a code
            </Button>
          )}
        </div>
      )}

      {step === "code" && (
        <div className="space-y-4">
          <p className="text-sm text-theme-secondary">
            Enter the 6-digit code sent to <span className="font-medium text-theme-primary">{maskedEmail}</span>.
          </p>
          <CodeStep
            code={code}
            onCode={(d) => {
              setCode(d);
              setInvalid(false);
            }}
            onVerify={(d) => void verify(d)}
            busy={busy}
            invalid={invalid}
            onResend={() => void sendCode(true)}
            resendGapSeconds={RESEND_GAP_SECONDS}
            sentAt={sentAt}
          />
        </div>
      )}

      {step === "password" && (
        <form onSubmit={create} className="space-y-5">
          <p className="text-sm text-theme-secondary">Your address is confirmed. Now choose a password.</p>
          <div className="space-y-2">
            <Label htmlFor="start-password">New password</Label>
            <PasswordInput id="start-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={PASSWORD_MAX} autoFocus required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="start-confirm">Type it again</Label>
            <PasswordInput id="start-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" maxLength={PASSWORD_MAX} required />
          </div>
          <PasswordGuide password={password} confirm={confirm} min={PASSWORD_MIN} />
          <Button type="submit" disabled={busy || !rulesOk}>
            {busy && <Loader2 className="size-4 animate-spin" />} Create my account
          </Button>
        </form>
      )}
    </div>
  );
}
