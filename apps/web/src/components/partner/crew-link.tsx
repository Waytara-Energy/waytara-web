"use client";

import * as React from "react";
import { Check, Copy, Loader2, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { crewShareMessage, whatsappNumber } from "@/lib/partner-crew";

export interface CrewInviteState {
  memberId: string;
  status: "sent" | "opened" | "completed";
  via: "email" | "link";
  expired: boolean;
  sentAt: string;
  openedAt: string | null;
  completedAt: string | null;
}

const STATUS_WORDS: Record<CrewInviteState["status"], string> = { sent: "Link sent, not opened yet", opened: "Opened, adding documents", completed: "Finished adding documents" };

async function call<T>(url: string, method: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: string } | null;
    if (res.ok && json?.success) return { ok: true, data: json.data as T };
    return { ok: false, error: json?.error ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Please check your connection and try again." };
  }
}

/**
 * Beside one person on the team: send them their own link to add their ID, selfie and certificates on their phone. The partner can have it e-mailed to the person (when
 * an address is given), copy it, or share it on WhatsApp (when a number is given). Making a new link replaces the old one. Shows where the person's link stands.
 */
export function CrewLink({ base, memberId, name, email, phone, invite, onSent, beforeSend }: { base: string; memberId: string; name: string; email: string; phone: string; invite: CrewInviteState | undefined; onSent: () => void; beforeSend: () => Promise<boolean> }) {
  const [busy, setBusy] = React.useState<"" | "email" | "link">("");
  const [link, setLink] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState("");
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

  async function make(via: "email" | "link") {
    setBusy(via);
    setError("");
    setNote("");
    // the person must be saved first, so the server knows whose link it is
    if (!(await beforeSend())) {
      setBusy("");
      return setError("Your latest changes couldn't be saved yet. Please try again in a moment.");
    }
    const r = await call<{ link: string }>(`${base}/crew`, "POST", { memberId, via });
    setBusy("");
    if (!r.ok) return setError(r.error);
    setLink(r.data.link);
    setNote(via === "email" ? `Sent to ${email}. Any earlier link stopped working.` : "A new link is ready. Any earlier link stopped working.");
    onSent();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy it. Select the link and copy it yourself.");
    }
  }

  const message = crewShareMessage(name, link);
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-theme-border p-3.5 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-theme-primary">Ask {name.split(/\s+/)[0] || "them"} to add their own documents</p>
        {invite && (
          <span className={invite.expired ? "text-xs text-amber-700 dark:text-amber-300" : invite.status === "completed" ? "text-xs text-emerald-700 dark:text-emerald-300" : "text-xs text-theme-muted"}>
            {invite.expired ? "The last link has expired" : STATUS_WORDS[invite.status]}
          </span>
        )}
      </div>
      <p className="text-xs leading-relaxed text-theme-muted">They get a link, with no account to make, and add their ID, a selfie and certificates on their phone. You can also add them yourself below.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy !== "" || !emailOk} onClick={() => void make("email")} title={emailOk ? undefined : "Add their e-mail address first"}>
          {busy === "email" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Send by e-mail
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy !== ""} onClick={() => void make("link")}>
          {busy === "link" ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />} {link ? "Make a new link" : "Get a link"}
        </Button>
      </div>
      {link && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input readOnly value={link} aria-label="Their link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-theme-border bg-theme-surface px-2.5 py-1.5 text-xs text-theme-secondary" />
            <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {whatsappNumber(phone).length >= 10 && (
            <a href={`https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-theme-primary underline underline-offset-4">
              <MessageCircle className="size-3.5" aria-hidden="true" /> Share on WhatsApp
            </a>
          )}
        </div>
      )}
      {note && (
        <p role="status" className="text-xs text-theme-secondary">
          {note}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
