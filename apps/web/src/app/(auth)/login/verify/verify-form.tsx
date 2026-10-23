"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@waytara/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonSpinner } from "@/components/ui/spinner";
import { cleanTotp } from "@/lib/mfa";
import { completeSignIn } from "@/app/dashboard/settings/account-actions";

/** The code box of the second sign-in step. A right code lifts the session to the second level; then the server records the sign-in and says where
 *  to go (the page the person chose to start on). */
export function VerifyForm() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = cleanTotp(code);
    if (!clean) {
      setError("The code is 6 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.[0];
      if (!factor) throw new Error("No authenticator app was found for this account. Sign in again.");
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: clean });
      if (verifyError) throw new Error("That code is not right, or it has expired. Try the next one.");
      router.replace(await completeSignIn());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  async function leave() {
    await createClient().auth.signOut({ scope: "local" });
    router.replace("/login");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="000000"
        aria-label="6-digit code"
        className="h-12 text-center text-2xl tracking-[0.5em]"
      />
      {error && (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
        <ButtonSpinner show={busy} />
        {busy ? "Checking…" : "Verify and sign in"}
      </Button>
      <button type="button" onClick={() => void leave()} className="block w-full text-center text-xs text-theme-muted hover:text-theme-primary hover:underline">
        Sign in as someone else
      </button>
    </form>
  );
}
