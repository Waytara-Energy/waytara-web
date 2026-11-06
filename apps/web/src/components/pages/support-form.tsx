"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TOPICS = ["I can't sign in", "I lost my two-factor device", "A device is offline or readings are missing", "A billing question", "Something else"];

/**
 * The public support form, for people who cannot sign in to raise a ticket. It reaches the team as an enquiry from "support_request" with the
 * topic named, so it can be told apart from a sales enquiry.
 */
export function SupportForm() {
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: get("fullName"),
          phone: get("phone"),
          email: get("email"),
          source: "support_request",
          supportTopic: get("topic"),
          message: get("message"),
          website: get("website"),
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) {
        setStatus("error");
        setError(json?.error ?? "Couldn't send your message. Please try again, or call us.");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Couldn't send your message. Please check your connection and try again, or call us.");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-theme-border bg-theme-surface px-7 py-10 text-center sm:px-10">
        <CheckCircle2 className="mx-auto size-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold text-theme-primary">Thanks, we have your message.</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-theme-secondary">Someone from the team will get in touch on the phone number or e-mail you gave us.</p>
      </div>
    );
  }

  const field = "space-y-1.5";
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className={field}>
          <Label htmlFor="sf-name">Your name</Label>
          <Input id="sf-name" name="fullName" required minLength={2} autoComplete="name" />
        </div>
        <div className={field}>
          <Label htmlFor="sf-phone">Mobile number</Label>
          <Input id="sf-phone" name="phone" type="tel" required minLength={6} autoComplete="tel" />
        </div>
        <div className={field}>
          <Label htmlFor="sf-email">E-mail</Label>
          <Input id="sf-email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className={field}>
          <Label htmlFor="sf-topic">What is it about?</Label>
          <select
            id="sf-topic"
            name="topic"
            defaultValue={TOPICS[0]}
            className="h-9 w-full rounded-md border border-theme-border bg-theme-bg px-3 text-sm text-theme-primary outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={`${field} mt-5`}>
        <Label htmlFor="sf-message">Tell us what is happening</Label>
        <Textarea id="sf-message" name="message" required minLength={5} maxLength={1500} rows={5} placeholder="What you tried, and what you saw. Please don't include passwords or codes." />
      </div>

      {/* Honeypot: real visitors never see or fill this. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {status === "error" && (
        <p role="alert" className="mt-5 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="mt-7 flex flex-wrap items-center gap-4">
        <Button type="submit" variant="gradient" disabled={status === "sending"} className="h-11 rounded-full px-7">
          {status === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Send to support
        </Button>
        <p className="text-xs text-theme-muted">Never send your password or a sign-in code. We will never ask for them.</p>
      </div>
    </form>
  );
}
