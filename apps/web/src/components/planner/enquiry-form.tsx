"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ENQUIRY_LABELS } from "@/lib/planner/engine";
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
      <div role="status" className="rounded-2xl border border-theme-border bg-theme-surface px-7 py-10 text-center sm:px-10">
        <CheckCircle2 className="mx-auto size-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold text-theme-primary">Thanks, we have your enquiry.</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-theme-secondary">
          Your answers and this blueprint came with it, so we won&apos;t ask you the same things again. Someone from the team will get in touch.
        </p>
      </div>
    );
  }

  const field = "space-y-1.5";
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-8">
      <h3 className="text-xl font-semibold text-theme-primary">Let&apos;s discuss your energy plan</h3>
      <p className="mt-1 text-sm text-theme-secondary">Your answers are saved with this enquiry. Just tell us how to reach you.</p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className={field}>
          <Label htmlFor="pe-name">Your name</Label>
          <Input id="pe-name" name="fullName" required minLength={2} autoComplete="name" />
        </div>
        <div className={field}>
          <Label htmlFor="pe-phone">Mobile number</Label>
          <Input id="pe-phone" name="phone" type="tel" required minLength={6} autoComplete="tel" />
        </div>
        <div className={field}>
          <Label htmlFor="pe-email">
            E-mail <span className="font-normal text-theme-muted">(optional)</span>
          </Label>
          <Input id="pe-email" name="email" type="email" autoComplete="email" />
        </div>
        <div className={field}>
          <Label htmlFor="pe-place">City or pincode</Label>
          <Input id="pe-place" name="place" autoComplete="address-level2" />
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-theme-primary">What would you like to do next?</legend>
        <div className="mt-3 grid grid-cols-1 gap-2.5">
          {STEPS.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-3 rounded-xl border border-theme-border bg-theme-bg px-4 py-3 text-sm text-theme-primary has-[:checked]:border-emerald-500/60">
              <input type="radio" name="nextStep" value={s} checked={step === s} onChange={() => setStep(s)} className="accent-emerald-600" />
              <span>{ENQUIRY_LABELS[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={`${field} mt-6`}>
        <Label htmlFor="pe-notes">
          Anything you would like to add <span className="font-normal text-theme-muted">(optional)</span>
        </Label>
        <Textarea id="pe-notes" name="notes" rows={3} maxLength={800} placeholder="For example: the make and model of equipment you already have" />
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
          {ENQUIRY_LABELS[step]}
        </Button>
        <p className="text-xs text-theme-muted">We will use these details to reply to you.</p>
      </div>
    </form>
  );
}
