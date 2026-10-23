"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Camera, IdCard, Mail, Pencil, Trash2, User } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { notify, withPromiseToast } from "@waytara/ui/notify";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonSpinner } from "@/components/ui/spinner";
import { confirmEmailChange, requestEmailChange, saveAvatar, saveProfile } from "@/app/dashboard/settings/actions";
import { announceProfile, useLiveProfile } from "@/components/profile-live";
import { cn } from "@/lib/utils";
import { AvatarEditor } from "./avatar-editor";
import { FieldRow, SettingsCard, TwoColumns } from "./settings-card";

function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase() : (email[0] ?? "?").toUpperCase();
}

/** Settings > Profile: the picture (opened in an editor), the name and phone, and the e-mail address (changed only by entering the code sent to
 *  the new address). */
export function ProfileSection({ userId, fullName, phone, email, avatarUrl, memberSince }: { userId: string; fullName: string; phone: string; email: string; avatarUrl: string | null; memberSince: string | null }) {
  return (
    <TwoColumns
      left={<PersonalCard userId={userId} fullName={fullName} phone={phone} email={email} avatarUrl={avatarUrl} />}
      right={
        <>
          <EmailCard email={email} />
          <AccountDetailsCard memberSince={memberSince} />
        </>
      }
    />
  );
}

/** The basics of the account: since when, the kind of account, and the time zone times are shown in. */
function AccountDetailsCard({ memberSince }: { memberSince: string | null }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Member since", value: memberSince ? new Date(memberSince).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—" },
    { label: "Account type", value: "Customer" },
    { label: "Times are shown in", value: "India Standard Time (IST)" },
  ];
  return (
    <SettingsCard title="Account details" description="The basics of your account." icon={IdCard} tone="slate">
      <dl className="-my-1 divide-y divide-border text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 text-right font-medium text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
    </SettingsCard>
  );
}

function PersonalCard({ userId, fullName, phone, email, avatarUrl: savedAvatar }: { userId: string; fullName: string; phone: string; email: string; avatarUrl: string | null }) {
  const router = useRouter();
  const { avatarUrl } = useLiveProfile({ fullName, avatarUrl: savedAvatar });
  const [name, setName] = React.useState(fullName);
  const [tel, setTel] = React.useState(phone);
  const [saving, setSaving] = React.useState(false);
  const [editor, setEditor] = React.useState<{ file: File | null } | null>(null);
  const [over, setOver] = React.useState(false);
  const dirty = name.trim() !== fullName.trim() || tel.trim() !== phone.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await withPromiseToast(saveProfile, { loading: "Saving…", success: "Profile saved." })({ fullName: name, phone: tel });
    setSaving(false);
    if (ok) {
      announceProfile({ fullName: name.trim() });
      router.refresh();
    }
  }

  async function savePhoto(blob: Blob) {
    const path = `${userId}/avatar-${Date.now()}.jpg`;
    const client = createClient();
    const { error } = await client.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error("The picture could not be uploaded. Try again.");
    await saveAvatar(path);
    // shown everywhere at once; the page is also re-read from the server
    announceProfile({ avatarUrl: client.storage.from("avatars").getPublicUrl(path).data.publicUrl });
    notify.success("Profile picture updated.");
    router.refresh();
  }

  async function removePhoto() {
    try {
      await saveAvatar(null);
      announceProfile({ avatarUrl: null });
      notify.success("Profile picture removed.");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "The picture could not be removed.");
    }
  }

  return (
    <>
      <form onSubmit={save}>
        <SettingsCard
          title="Profile"
          icon={User}
          tone="emerald"
          description="Your name and picture show in the menu and in Support, so the team knows who they are talking to."
          footer={
            <Button type="submit" size="sm" disabled={!dirty || saving || !name.trim()}>
              <ButtonSpinner show={saving} />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          }
        >
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => setEditor({ file: null })}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) setEditor({ file });
              }}
              aria-label={avatarUrl ? "Edit your photo" : "Add a photo"}
              className={cn("group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring", over && "ring-4 ring-primary/50")}
            >
              <Avatar className="size-28 text-3xl">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                <AvatarFallback className="bg-primary/15 text-3xl font-semibold text-primary">{initials(name, email)}</AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Camera className="size-6" />
              </span>
              <span className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow">
                <Pencil className="size-4" />
              </span>
            </button>
            <div className="min-w-0 space-y-2">
              <p className="text-lg font-semibold leading-tight text-foreground">{name.trim() || "Your name"}</p>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditor({ file: null })}>
                  <Camera className="size-3.5" />
                  {avatarUrl ? "Edit photo" : "Add a photo"}
                </Button>
                {avatarUrl && (
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void removePhoto()}>
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Click the picture, or drop a photo on it.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Full name" htmlFor="fullName">
              <Input id="fullName" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" />
            </FieldRow>
            <FieldRow label="Phone" htmlFor="phone" hint="Optional. Digits, with + for a country code.">
              <Input id="phone" value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" autoComplete="tel" maxLength={20} placeholder="+91 98765 43210" />
            </FieldRow>
          </div>
        </SettingsCard>
      </form>

      <AvatarEditor open={editor !== null} initialFile={editor?.file ?? null} hasPhoto={!!avatarUrl} onClose={() => setEditor(null)} onSave={savePhoto} onRemove={removePhoto} />
    </>
  );
}

type Step = "idle" | "address" | "code";

function EmailCard({ email }: { email: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("idle");
  const [next, setNext] = React.useState("");
  const [code, setCode] = React.useState("");
  const [sentTo, setSentTo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [wait, setWait] = React.useState(0);

  // the resend button comes back a minute after a code was sent
  React.useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await requestEmailChange(next);
      setSentTo(r.sentTo);
      setCode("");
      setStep("code");
      setWait(60);
      notify.success(`We sent a code to ${r.sentTo}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await confirmEmailChange(code);
      notify.success(`Your e-mail is now ${r.email}.`);
      setStep("idle");
      setNext("");
      setCode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard icon={Mail} tone="sky" title="E-mail address" description="This is the address you sign in with and where we send alerts and replies. To change it we send a 6-digit code to the new address.">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Mail className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{email}</p>
            <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="size-3.5" />
              Verified
            </p>
          </div>
        </div>
        {step === "idle" && (
          <Button type="button" variant="outline" size="sm" onClick={() => setStep("address")}>
            Change e-mail
          </Button>
        )}
      </div>

      {step === "address" && (
        <form onSubmit={send} className="space-y-3">
          <FieldRow label="New e-mail address" htmlFor="newEmail">
            <Input id="newEmail" type="email" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="email" placeholder="you@example.com" autoFocus required />
          </FieldRow>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy || !next.trim()}>
              <ButtonSpinner show={busy} />
              Send code
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setStep("idle"); setError(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={confirm} className="space-y-3">
          <FieldRow label={`Code sent to ${sentTo}`} htmlFor="emailCode" hint="It works for 10 minutes. Check your spam folder if it does not arrive.">
            <Input id="emailCode" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="max-w-48 text-center text-lg tracking-[0.5em]" autoFocus />
          </FieldRow>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={busy || code.length !== 6}>
              <ButtonSpinner show={busy} />
              Verify and change
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy || wait > 0} onClick={() => void send()}>
              {wait > 0 ? `Send again in ${wait}s` : "Send again"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setStep("address"); setError(null); }}>
              Use another address
            </Button>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
