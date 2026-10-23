"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, History, KeyRound, LogOut, Mail, Timer } from "lucide-react";
import { notify, withPromiseToast } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ButtonSpinner } from "@/components/ui/spinner";
import { passwordStrength } from "@/lib/password-strength";
import { maskEmail } from "@/lib/mask-email";
import { IDLE_OPTIONS, MAX_IDLE_MINUTES, MAX_SESSION_MINUTES, MIN_IDLE_MINUTES, MIN_SESSION_MINUTES, SESSION_LIMIT_OPTIONS, WARN_OPTIONS, describePolicy, type IdleScope, type SessionPolicy } from "@/lib/session-policy";
import { confirmPasswordChange, requestPasswordChange, saveSessionPolicy } from "@/app/dashboard/settings/actions";
import { cn } from "@/lib/utils";
import { DevicesSetting, type SignedInDevice } from "../devices-setting";
import { DurationPicker } from "./duration-picker";
import { ActivityList, type ActivityEvent } from "./activity-list";
import { FieldRow, SettingsCard, ToggleRow, TwoColumns } from "./settings-card";
import { useAutoSave } from "./use-auto-save";
import { TwoFactorCard } from "./two-factor-card";

const METER = ["bg-destructive", "bg-destructive", "bg-amber-500", "bg-emerald-500", "bg-emerald-500"] as const;

/** A bar under the new password that fills as it gets stronger, with what would improve it. */
function StrengthMeter({ password, email }: { password: string; email: string }) {
  if (password.length === 0) return null;
  const s = passwordStrength(password, email);
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full bg-muted transition-colors", s.score >= i && METER[s.score])} />
        ))}
        <span className="ml-2 w-16 text-right text-xs font-medium text-muted-foreground">{s.label}</span>
      </div>
      {s.tips[0] && <p className="text-xs text-muted-foreground">{s.tips[0]}</p>}
    </div>
  );
}

function PasswordCard({ email }: { email: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState<"ask" | "enter">("ask");
  const [sentTo, setSentTo] = React.useState("");
  const [sentAt, setSentAt] = React.useState(0);
  const [now, setNow] = React.useState(() => Date.now());
  const [code, setCode] = React.useState("");
  const [next, setNext] = React.useState("");
  const [again, setAgain] = React.useState("");
  const [busy, setBusy] = React.useState<"send" | "change" | null>(null);

  React.useEffect(() => {
    if (step !== "enter") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [step]);

  const wait = Math.max(0, 60 - Math.floor((now - sentAt) / 1000));
  const mismatch = again.length > 0 && next !== again;
  const strong = passwordStrength(next, email).score >= 2;
  const ready = /^\d{6}$/.test(code.replace(/\s+/g, "")) && next.length >= 8 && next === again && strong;

  async function send() {
    setBusy("send");
    try {
      const r = await requestPasswordChange();
      setSentTo(r.sentTo);
      setSentAt(Date.now());
      setNow(Date.now());
      setCode("");
      setStep("enter");
      notify.success(`We sent a code to ${r.sentTo}.`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not send the code.");
    } finally {
      setBusy(null);
    }
  }

  async function change(e: React.FormEvent) {
    e.preventDefault();
    setBusy("change");
    const ok = await withPromiseToast(confirmPasswordChange, { loading: "Changing…", success: "Password changed." })(code, next);
    setBusy(null);
    if (ok) router.replace(`/login?success=${encodeURIComponent("Your password was changed and every device was signed out. Sign in with the new password.")}`);
  }

  return (
    <SettingsCard
      title="Password"
      description="To change your password, we first send a 6-digit code to your e-mail to make sure it is you."
      icon={KeyRound}
      tone="indigo"
      footer={
        step === "enter" ? (
          <>
            <Button type="button" variant="outline" size="sm" disabled={busy !== null || wait > 0} onClick={() => void send()}>
              <ButtonSpinner show={busy === "send"} />
              {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
            </Button>
            <Button type="submit" form="password-form" size="sm" disabled={!ready || busy !== null}>
              <ButtonSpinner show={busy === "change"} />
              {busy === "change" ? "Changing…" : "Change password and sign out everywhere"}
            </Button>
          </>
        ) : undefined
      }
    >
      {step === "ask" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
            <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              The code goes to <span className="font-medium text-foreground">{maskEmail(email)}</span> and works for 10 minutes. When you change the password, <span className="font-medium text-foreground">every device is signed out</span>, this one too, and you sign in again with the new password.
            </p>
          </div>
          <Button type="button" size="sm" disabled={busy !== null} onClick={() => void send()}>
            <ButtonSpinner show={busy === "send"} />
            {busy === "send" ? "Sending…" : "Send me a code"}
          </Button>
        </div>
      ) : (
        <form id="password-form" onSubmit={change} className="space-y-4">
          <FieldRow label="Code from your e-mail" htmlFor="password-code" hint={`Sent to ${sentTo}. It works for 10 minutes.`}>
            <Input id="password-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} className="max-w-48 text-lg tracking-[0.4em]" />
          </FieldRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="New password" htmlFor="password-next">
              <PasswordInput id="password-next" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </FieldRow>
            <FieldRow label="New password again" htmlFor="password-again">
              <PasswordInput id="password-again" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} aria-invalid={mismatch} />
              {mismatch && <p className="text-xs text-destructive">The two passwords are not the same.</p>}
            </FieldRow>
          </div>
          <StrengthMeter password={next} email={email} />
          <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-200">
            <LogOut className="mt-0.5 size-4 shrink-0" />
            After the password changes, you are signed out on every device, this one included.
          </p>
        </form>
      )}
    </SettingsCard>
  );
}

const SCOPES: { id: IdleScope; label: string; hint: string }[] = [
  { id: "device", label: "Only that device", hint: "Your other devices stay signed in." },
  { id: "all", label: "All my devices", hint: "Every device is signed out, wherever you are signed in." },
];

function SessionCard({ initial }: { initial: SessionPolicy }) {
  const router = useRouter();
  // every choice saves itself the moment it is made (a typed time, once the field is left)
  const { value: policy, update } = useAutoSave<SessionPolicy>(initial, saveSessionPolicy, { message: "Sign-in settings saved.", onSaved: () => router.refresh() });
  const set = (patch: Partial<SessionPolicy>) => update((p) => ({ ...p, ...patch }));
  const reaches = policy.idleMinutes !== null || policy.maxSessionMinutes !== null;

  return (
    <SettingsCard
      title="Staying signed in"
      description="Decide when this account signs itself out: when you are away, after a time limit, or when the browser closes. Changes are saved as you make them. This is checked on each device you use, whenever the app is open."
      icon={Timer}
      tone="sky"
    >
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">When I am away</p>
        <p className="text-xs text-muted-foreground">Sign me out after this long with no activity.</p>
        <DurationPicker label="Sign out when idle" options={IDLE_OPTIONS} value={policy.idleMinutes} onChange={(m) => set({ idleMinutes: m })} min={MIN_IDLE_MINUTES} max={MAX_IDLE_MINUTES} />
      </div>

      {policy.idleMinutes !== null && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Warn me first</p>
          <p className="text-xs text-muted-foreground">A &ldquo;still there?&rdquo; message with a countdown, so you can stay signed in.</p>
          <div role="radiogroup" aria-label="Warning before sign-out" className="flex flex-wrap gap-2">
            {WARN_OPTIONS.map((o) => {
              const on = policy.warnSeconds === o.seconds;
              return (
                <button key={o.seconds} type="button" role="radio" aria-checked={on} onClick={() => set({ warnSeconds: o.seconds })} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent")}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">The longest a session may last</p>
        <p className="text-xs text-muted-foreground">However busy I am, sign me out this long after I signed in.</p>
        <DurationPicker label="Longest session" options={SESSION_LIMIT_OPTIONS} value={policy.maxSessionMinutes} onChange={(m) => set({ maxSessionMinutes: m })} min={MIN_SESSION_MINUTES} max={MAX_SESSION_MINUTES} />
      </div>

      <ToggleRow title="Sign me out when I close the browser" description="This browser only. It works when the browser was closed completely, not when one tab is closed.">
        <Switch checked={policy.signOutOnClose} onCheckedChange={(v) => set({ signOutOnClose: v })} aria-label="Sign out when the browser closes" />
      </ToggleRow>

      {reaches && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">When it happens, sign out</p>
          <div role="radiogroup" aria-label="What to sign out" className="grid gap-2 sm:grid-cols-2">
            {SCOPES.map((s) => {
              const on = policy.scope === s.id;
              return (
                <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => set({ scope: s.id })} className={cn("rounded-xl border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}>
                  <span className="block text-sm font-medium text-foreground">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted/30 p-3.5">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What this means</p>
        <ul className="space-y-1 text-sm text-foreground">
          {describePolicy(policy).map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check className="mt-1 size-3.5 shrink-0 text-emerald-500" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </SettingsCard>
  );
}

/** Settings > Account & security: the password (with a strength bar), two-factor sign-in, how long a browser may sit idle, what happened on the
 *  account lately, and where it is signed in. */
export function SecuritySection({ policy, devices, now, email, events }: { policy: SessionPolicy; devices: SignedInDevice[]; now: number; email: string; events: ActivityEvent[] }) {
  return (
    <div className="space-y-5">
      <TwoColumns
        left={
          <>
            <PasswordCard email={email} />
            <TwoFactorCard />
            <SettingsCard title="Account activity" description="Sign-ins, sign-outs and changes, newest first. If something here is not you, change your password and sign out of every device." icon={History} tone="sky">
              <ActivityList events={events.slice(0, 12)} now={now} />
            </SettingsCard>
          </>
        }
        right={<SessionCard initial={policy} />}
      />
      <DevicesSetting devices={devices} now={now} />
    </div>
  );
}
