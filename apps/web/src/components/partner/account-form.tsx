"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN, passwordProblem } from "@waytara/supabase/partner-account";

/**
 * The last step of an approved application: choose a password for the partner account. The password is sent once, over the page's own connection, to the website's
 * server (which creates the account) and is kept nowhere else; this form does not remember it, and the browser's own password saving may offer to. On success the page
 * says the account is ready and points to the sign-in page.
 */
export function AccountForm({ token, email, signInUrl }: { token: string; email: string; signInUrl: string }) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const problem = passwordProblem(password, confirm, email);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const res = await fetch(`/api/partner/track/${token}/account`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirm }) });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (res.ok && json?.success) {
        setPassword("");
        setConfirm("");
        setDone(true);
      } else setError(json?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="mt-10 max-w-xl border-t border-theme-border pt-8">
        <CheckCircle2 className="size-6 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-semibold text-theme-primary">Your partner account is ready</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-theme-secondary">Sign in with {email} and the password you just chose. This private link has now closed; you will not need it again.</p>
        <Button asChild className="mt-6">
          <a href={signInUrl}>Sign in</a>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 max-w-md space-y-5 border-t border-theme-border pt-8">
      <h2 className="text-lg font-bold tracking-tight text-theme-primary sm:text-xl">Choose your password</h2>
      <p className="text-sm text-theme-secondary">
        You will sign in with <span className="font-medium text-theme-primary">{email}</span>. Use at least {PASSWORD_MIN} characters, with letters and numbers.
      </p>
      <div className="space-y-2">
        <Label htmlFor="acct-password">New password</Label>
        <Input id="acct-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={72} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="acct-confirm">Type it again</Label>
        <Input id="acct-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" maxLength={72} required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {busy ? "Creating your account…" : "Create my account"}
      </Button>
    </form>
  );
}
