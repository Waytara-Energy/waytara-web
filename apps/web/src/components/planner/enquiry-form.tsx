"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ENQUIRY_LABELS } from "@/lib/planner/engine";
import { cn } from "@/lib/utils";
import type { Blueprint, NextStep } from "@/lib/planner/types";
import { trackPlanner } from "./planner-analytics";

const STEPS: NextStep[] = ["assessment", "specialist", "compatibility"];

/**
 * The short enquiry shown after the blueprint (never before it). The visitor's answers and the recommendation travel with it, so the team gets
 * more than a name and a number. City or pincode is asked here, not earlier.
 */
export function EnquiryForm({ blueprint, summary }: { blueprint: Blueprint; summary: string }) {
  const [step, setStep] = React.useState<NextStep>(blueprint.next.defaultNextStep);
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    const place = get("place");
    setStatus("sending");
    setError("");
    trackPlanner("blueprint_cta_clicked", { route: blueprint.routeLabel, step });
    if (step === "compatibility") trackPlanner("compatibility_check_requested", { route: blueprint.routeLabel });
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: get("fullName"),
          phone: get("phone"),
          email: get("email"),
          ...(/^\d{6}$/.test(place) ? { pincode: place } : place ? { city: place } : {}),
          message: get("notes"),
          source: "energy_planner",
          nextStep: ENQUIRY_LABELS[step],
          plannerSummary: summary,
          website: get("website"),
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) {
        setStatus("error");
        setError(json?.error ?? "Couldn't send your enquiry. Please try again.");
        return;
      }
      trackPlanner("planner_enquiry_sent", { route: blueprint.routeLabel, step });
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Couldn't send your enquiry. Please check your connection and try again.");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="border-t border-theme-border pt-10">
        <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="mt-5 text-xl font-bold tracking-tight text-theme-primary">Thanks, we have your enquiry.</p>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-theme-secondary">
          Your answers and this blueprint came with it, so we won&apos;t ask you the same things again. Someone from the team will get in touch.
        </p>
      </div>
    );
  }

  const field = "space-y-2";
  return (
    <div className="grid grid-cols-1 gap-10 border-t border-theme-border pt-12 lg:grid-cols-5 lg:gap-16">
      <div className="lg:col-span-2">
        <h3 className="text-[clamp(1.6rem,2.8vw,2.3rem)] font-bold leading-tight tracking-tight text-theme-primary">Let&apos;s discuss your energy plan</h3>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-theme-secondary">Your answers and this blueprint come with your enquiry, so we will not ask you the same things again. Just tell us how to reach you.</p>
      </div>

      <form onSubmit={onSubmit} className="relative lg:col-span-3">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className={field}>
            <Label htmlFor="pe-name">Your name</Label>
            <Input id="pe-name" name="fullName" required minLength={2} autoComplete="name" />
          </div>
          <div className={field}>
            <Label htmlFor="pe-phone">Mobile number</Label>
            <Input id="pe-phone" name="phone" type="tel" required minLength={6} autoComplete="tel" />
          </div>
          <div className={field}>
            <Label htmlFor="pe-email">E-mail</Label>
            <Input id="pe-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className={field}>
            <Label htmlFor="pe-place">City or pincode</Label>
            <Input id="pe-place" name="place" autoComplete="address-level2" />
          </div>
        </div>

        <fieldset className="mt-8">
          <legend className="text-sm font-medium text-theme-primary">What would you like to do next?</legend>
          <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="What would you like to do next?">
            {STEPS.map((s) => {
              const on = step === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setStep(s)}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500",
                    on ? "border-emerald-500/60 bg-emerald-500/10 text-theme-primary" : "border-theme-border text-theme-secondary hover:border-theme-muted hover:text-theme-primary"
                  )}
                >
                  <span aria-hidden="true" className={cn("size-2 rounded-full transition-colors", on ? "bg-emerald-500" : "bg-theme-border")} />
                  {ENQUIRY_LABELS[s]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className={`${field} mt-8`}>
          <Label htmlFor="pe-notes">
            Anything you would like to add <span className="font-normal text-theme-muted">(optional)</span>
          </Label>
          <Textarea id="pe-notes" name="notes" rows={3} maxLength={800} />
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

        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-theme-border pt-7">
          <Button type="submit" variant="gradient" disabled={status === "sending"} className="h-11 rounded-full px-7">
            {status === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {ENQUIRY_LABELS[step]}
          </Button>
          <p className="text-xs text-theme-muted">We will use these details to reply to you.</p>
        </div>
      </form>
    </div>
  );
}
