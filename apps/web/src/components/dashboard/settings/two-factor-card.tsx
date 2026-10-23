"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonSpinner } from "@/components/ui/spinner";
import { cleanTotp } from "@/lib/mfa";
import { recordTwoFactorChange } from "@/app/dashboard/settings/account-actions";
import { Pill, SettingsCard } from "./settings-card";

interface Factor {
  id: string;
  created_at: string;
}

interface Pending {
  id: string;
  qr: string;
  secret: string;
}

/** Settings > Account & security > Two-factor sign-in with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password ...).
 *  Turning it on: scan the picture (or type the key), enter the 6-digit code, done. From then on, signing in needs the code as well as the password.
 *  Supabase signs the person's other devices out when the factor is confirmed, and says so here before the person starts. */
export function TwoFactorCard() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [factors, setFactors] = React.useState<Factor[] | null>(null);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []).map((f) => ({ id: f.id, created_at: f.created_at })));
  }, [supabase]);

  React.useEffect(() => {
    // read the factors when the card first shows (the state is set after the answer arrives, not during the effect)
    let live = true;
    void supabase.auth.mfa.listFactors().then(({ data }) => live && setFactors((data?.totp ?? []).map((f) => ({ id: f.id, created_at: f.created_at }))));
    return () => {
      live = false;
    };
  }, [supabase]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      // an enrolment that was started and never finished would block a new one: clear those first
      const { data: all } = await supabase.auth.mfa.listFactors();
      for (const f of all?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: enrolError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
      if (enrolError || !data) throw new Error("Could not start the setup. Try again in a moment.");
      setPending({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelSetup() {
    if (pending) await supabase.auth.mfa.unenroll({ factorId: pending.id });
    setPending(null);
    setError(null);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    const clean = cleanTotp(code);
    if (!clean) {
      setError("The code is 6 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: pending.id, code: clean });
      if (verifyError) throw new Error("That code is not right, or it has expired. Try the next one in your app.");
      setPending(null);
      await load();
      await recordTwoFactorChange("mfa_enabled").catch(() => undefined);
      notify.success("Two-factor sign-in is on.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(factorId: string) {
    if (!window.confirm("Turn off two-factor sign-in? Signing in will need only your password.")) return;
    setBusy(true);
    setError(null);
    try {
      const { error: offError } = await supabase.auth.mfa.unenroll({ factorId });
      if (offError) throw new Error("Could not turn it off here. Sign out, sign in again with your code, then try again.");
      await load();
      await recordTwoFactorChange("mfa_disabled").catch(() => undefined);
      notify.success("Two-factor sign-in is off.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!pending) return;
    try {
      await navigator.clipboard.writeText(pending.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error("Could not copy. Select the key and copy it.");
    }
  }

  const on = (factors?.length ?? 0) > 0;

  return (
    <SettingsCard
      title="Two-factor sign-in"
      description="A code from your phone as well as your password, so a stolen password alone is not enough."
      icon={on ? ShieldCheck : ShieldOff}
      tone={on ? "emerald" : "amber"}
      badge={factors === null ? undefined : on ? <Pill tone="emerald">On</Pill> : <Pill tone="amber">Not set up</Pill>}
    >
      {factors === null ? (
        <p className="text-sm text-muted-foreground">Checking…</p>
      ) : pending ? (
        <form onSubmit={confirm} className="space-y-4">
          <ol className="space-y-3 text-sm text-foreground">
            <li>
              <span className="font-medium">1. Scan this picture</span> with your authenticator app.
            </li>
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            {/* the auth service sends the QR code as an image address */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pending.qr} alt="QR code to scan with your authenticator app" className="size-40 rounded-xl border border-border bg-white p-2" />
            <div className="min-w-0 space-y-2">
              <p className="text-xs text-muted-foreground">Cannot scan? Type this key into the app instead:</p>
              <div className="flex items-center gap-2">
                <code className="break-all rounded-md bg-muted px-2 py-1 text-xs tracking-wider text-foreground">{pending.secret}</code>
                <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" aria-label="Copy the key" onClick={() => void copySecret()}>
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="mfaCode" className="text-sm font-medium text-foreground">
              2. Enter the 6-digit code it shows
            </label>
            <Input id="mfaCode" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="max-w-48 text-center text-lg tracking-[0.5em]" autoFocus />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy || code.length !== 6}>
              <ButtonSpinner show={busy} />
              Turn on
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void cancelSetup()}>
              Cancel
            </Button>
          </div>
        </form>
      ) : on ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <Smartphone className="size-5 shrink-0 text-emerald-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Authenticator app</p>
              <p className="text-xs text-muted-foreground">Added {new Date(factors![0].created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void turnOff(factors![0].id)} className="text-destructive hover:text-destructive">
              Turn off
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Lost your phone? Contact WayTara support: we can help you back in after checking it is you.</p>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>Works with Google Authenticator, Microsoft Authenticator, Authy and 1Password.</li>
            <li>Turning it on signs you out of your other devices once; they sign in again with the code.</li>
          </ul>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="button" size="sm" disabled={busy} onClick={() => void start()}>
            <ButtonSpinner show={busy} />
            Set up two-factor sign-in
          </Button>
        </div>
      )}
    </SettingsCard>
  );
}
