"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { History, KeyRound, MonitorSmartphone, Timer } from "lucide-react";
import { withPromiseToast } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import { ButtonSpinner } from "@/components/ui/spinner";
import { passwordStrength } from "@/lib/password-strength";
import { IDLE_OPTIONS, type IdleScope, type SessionPolicy } from "@/lib/session-policy";
import { changePassword, saveSessionPolicy } from "@/app/dashboard/settings/actions";
import { cn } from "@/lib/utils";
import { DevicesSetting, type SignedInDevice } from "../devices-setting";
import { ActivityList, type ActivityEvent } from "./activity-list";
import { FieldRow, SettingsCard, ToggleRow } from "./settings-card";
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
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [again, setAgain] = React.useState("");
  const [others, setOthers] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const mismatch = again.length > 0 && next !== again;
  const ready = current.length > 0 && next.length >= 8 && next === again;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await withPromiseToast(changePassword, { loading: "Changing…", success: "Password changed." })(current, next, others);
    setSaving(false);
    if (ok) {
      setCurrent("");
      setNext("");
      setAgain("");
    }
  }

  return (
    <form onSubmit={submit}>
      <SettingsCard
        title="Password"
        description="Use at least 8 characters. You will need your current password to change it."
        icon={KeyRound}
        tone="indigo"
        footer={
          <Button type="submit" size="sm" disabled={!ready || saving}>
            <ButtonSpinner show={saving} />
            {saving ? "Changing…" : "Change password"}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldRow label="Current password" htmlFor="currentPassword">
              <PasswordInput id="currentPassword" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </FieldRow>
          </div>
          <FieldRow label="New password" htmlFor="newPassword">
            <PasswordInput id="newPassword" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </FieldRow>
          <div className="sm:col-span-2 sm:-mt-1 sm:order-last">
            <StrengthMeter password={next} email={email} />
          </div>
          <FieldRow label="New password again" htmlFor="newPasswordAgain" hint={mismatch ? "The two do not match." : undefined}>
            <PasswordInput id="newPasswordAgain" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
          </FieldRow>
        </div>
        <ToggleRow title="Sign out my other devices" description="Recommended: anyone who had your old password on another device is signed out.">
          <Switch checked={others} onCheckedChange={setOthers} aria-label="Sign out my other devices" />
        </ToggleRow>
      </SettingsCard>
    </form>
  );
}

const SCOPES: { id: IdleScope; label: string; hint: string }[] = [
  { id: "device", label: "Only that device", hint: "Your other devices stay signed in." },
  { id: "all", label: "All my devices", hint: "Every device is signed out, wherever you are signed in." },
];

function SessionCard({ initial }: { initial: SessionPolicy }) {
  const router = useRouter();
  const [policy, setPolicy] = React.useState<SessionPolicy>(initial);
  const [saved, setSaved] = React.useState<SessionPolicy>(initial);
  const [saving, setSaving] = React.useState(false);
  const dirty = policy.idleMinutes !== saved.idleMinutes || policy.scope !== saved.scope;

  async function save() {
    setSaving(true);
    const ok = await withPromiseToast(saveSessionPolicy, { loading: "Saving…", success: "Sign-in settings saved." })(policy);
    setSaving(false);
    if (ok) {
      setSaved(policy);
      router.refresh();
    }
  }

  return (
    <SettingsCard
      title="Staying signed in"
      description="Choose whether you stay signed in all the time, or are signed out after a while with no activity. This is checked on each device you use, whenever the app is open."
      icon={Timer}
      tone="sky"
      footer={
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
          <ButtonSpinner show={saving} />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      }
    >
      <div role="radiogroup" aria-label="Sign out when inactive" className="grid gap-2 sm:grid-cols-3">
        {IDLE_OPTIONS.map((o) => {
          const on = policy.idleMinutes === o.minutes;
          return (
            <button
              key={String(o.minutes)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPolicy((p) => ({ ...p, idleMinutes: o.minutes }))}
              className={cn("flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}
            >
              {o.minutes === null ? <MonitorSmartphone className={cn("mt-0.5 size-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} /> : <Timer className={cn("mt-0.5 size-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} />}
              <span>
                <span className="block text-sm font-medium text-foreground">{o.label}</span>
                {o.hint && <span className="block text-xs text-muted-foreground">{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {policy.idleMinutes !== null && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">When it happens, sign out</p>
          <div role="radiogroup" aria-label="What to sign out" className="grid gap-2 sm:grid-cols-2">
            {SCOPES.map((s) => {
              const on = policy.scope === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPolicy((p) => ({ ...p, scope: s.id }))}
                  className={cn("rounded-xl border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}
                >
                  <span className="block text-sm font-medium text-foreground">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </SettingsCard>
  );
}

/** Settings > Account & security: the password (with a strength bar), two-factor sign-in, how long a browser may sit idle, what happened on the
 *  account lately, and where it is signed in. */
export function SecuritySection({ policy, devices, now, email, events }: { policy: SessionPolicy; devices: SignedInDevice[]; now: number; email: string; events: ActivityEvent[] }) {
  return (
    <div className="space-y-5">
      <div className="-mb-5 columns-1 gap-5 xl:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid">
        <PasswordCard email={email} />
        <TwoFactorCard />
        <SessionCard initial={policy} />
        <SettingsCard title="Account activity" description="Sign-ins, sign-outs and changes, newest first. If something here is not you, change your password and sign out of every device." icon={History} tone="sky">
          <ActivityList events={events.slice(0, 12)} now={now} />
        </SettingsCard>
      </div>
      <DevicesSetting devices={devices} now={now} />
    </div>
  );
}
