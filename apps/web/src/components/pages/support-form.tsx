"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FormPart } from "./form-part";

const TOPICS = [
  "I can't sign in",
  "I lost my two-factor device",
  "I have no account yet",
  "A device is offline",
  "Readings or reports look wrong",
  "An EV charger problem",
  "A billing question",
  "Something else",
];

/**
 * The public support form, for people who cannot sign in to raise a ticket (or who have no account yet). It reaches the team as an enquiry from
 * "support_request" with the topic named, so it can be told apart from a sales enquiry.
 */
export function SupportForm() {
  const [topic, setTopic] = React.useState(TOPICS[0]);
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
          supportTopic: topic,
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
      <div role="status" className="border-t border-theme-border pt-10">
        <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="mt-5 text-xl font-bold tracking-tight text-theme-primary">Thanks, we have your message.</p>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-theme-secondary">Someone from the team will get in touch on the phone number or e-mail you gave us.</p>
      </div>
    );
  }

  const field = "space-y-2";
  return (
    <form onSubmit={onSubmit} className="relative">
      <FormPart n={1} title="What is it about?" hint="Tap one">
        <div role="radiogroup" aria-label="What is it about?" className="flex flex-wrap gap-3">
          {TOPICS.map((t) => {
            const on = topic === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTopic(t)}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500",
                  on ? "border-emerald-500/60 bg-emerald-500/10 text-theme-primary" : "border-theme-border text-theme-secondary hover:border-theme-muted hover:text-theme-primary"
                )}
              >
                <span aria-hidden="true" className={cn("size-2 rounded-full transition-colors", on ? "bg-emerald-500" : "bg-theme-border")} />
                {t}
              </button>
            );
          })}
        </div>
      </FormPart>

      <FormPart n={2} title="How to reach you">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className={field}>
            <Label htmlFor="sf-name">Your name</Label>
            <Input id="sf-name" name="fullName" required minLength={2} autoComplete="name" />
          </div>
          <div className={field}>
            <Label htmlFor="sf-phone">Mobile number</Label>
            <Input id="sf-phone" name="phone" type="tel" required minLength={6} autoComplete="tel" />
          </div>
          <div className={cn(field, "sm:col-span-2")}>
            <Label htmlFor="sf-email">E-mail</Label>
            <Input id="sf-email" name="email" type="email" required autoComplete="email" />
          </div>
        </div>
      </FormPart>

      <FormPart n={3} title="Tell us what is happening">
        <div className={field}>
          <Label htmlFor="sf-message">What you tried, and what you saw</Label>
          <p className="text-sm text-theme-muted">Please do not include passwords or codes.</p>
          <Textarea id="sf-message" name="message" required minLength={5} maxLength={1500} rows={5} />
        </div>
      </FormPart>

      {/* Honeypot: real visitors never see or fill this. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {status === "error" && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4 border-t border-theme-border pt-8">
        <Button type="submit" variant="gradient" disabled={status === "sending"} className="h-11 rounded-full px-7">
          {status === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Send to support
        </Button>
        <p className="text-xs text-theme-muted">We use these details only to reply to you.</p>
      </div>
    </form>
  );
}
