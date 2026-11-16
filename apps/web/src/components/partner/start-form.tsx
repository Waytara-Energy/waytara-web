"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { PASSWORD_MIN, passwordProblem } from "@waytara/supabase/partner-account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "send" | "code" | "password";

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
 * (1) type the code, (2) choose a password, and are then signed in and taken to their onboarding. The link says which application this is; only the code proves the address.
 */
export function StartForm({ token, maskedEmail }: { token: string; maskedEmail: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("send");
  const [code, setCode] = React.useState("");
  const [proof, setProof] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [note, setNote] = React.useState("");

  async function sendCode(again = false) {
    setBusy(true);
    setError("");
    const r = await post(`/api/partner/start/code`, { token });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setNote(again ? `We sent a new 6-digit code to ${maskedEmail}. The earlier one no longer works.` : `We sent a 6-digit code to ${maskedEmail}. It works for 10 minutes.`);
    setStep("code");
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

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await post<{ proof: string }>(`/api/partner/start/verify`, { token, code: code.trim() });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setProof(r.data.proof);
    setStep("password");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const problem = passwordProblem(password, confirm, "");
    if (problem) return setError(problem);
    setBusy(true);
    const r = await post<{ email: string }>(`/api/partner/start/account`, { token, proof, password, confirm });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    // the account exists: sign in with the password just chosen, then into the partner area
    const { error: signInError } = await createClient().auth.signInWithPassword({ email: r.data.email, password });
    setBusy(false);
    if (signInError) return setError("Your account is ready. Please sign in with your e-mail address and password.");
    router.replace("/partner/portal");
  }

  return (
    <div className="max-w-md space-y-6">
      {step === "send" && (
        <div className="space-y-5">
          <p className="text-[15px] leading-relaxed text-theme-secondary" role="status">
            {busy || !error ? (
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
          {!busy && error && (
            <Button type="button" onClick={() => void sendCode()}>
              Send me a code
            </Button>
          )}
        </div>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="space-y-5">
          <p className="text-sm text-theme-secondary">{note}</p>
          <div className="space-y-2">
            <Label htmlFor="start-code">6-digit code</Label>
            <Input id="start-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="max-w-[10rem] text-lg tracking-[0.3em]" required />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="size-4 animate-spin" />} Confirm
            </Button>
            <button type="button" onClick={() => void sendCode(true)} disabled={busy} className="text-sm text-theme-secondary underline underline-offset-4 hover:text-theme-primary">
              Send a new code
            </button>
          </div>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={create} className="space-y-5">
          <p className="text-sm text-theme-secondary">Thank you, your address is confirmed. Choose a password: at least {PASSWORD_MIN} characters, with letters and numbers.</p>
          <div className="space-y-2">
            <Label htmlFor="start-password">New password</Label>
            <Input id="start-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={72} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="start-confirm">Type it again</Label>
            <Input id="start-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" maxLength={72} required />
          </div>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Create my account
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
