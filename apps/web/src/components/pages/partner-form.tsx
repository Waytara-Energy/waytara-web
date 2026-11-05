"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PARTNER_INSTALL_RANGES, PARTNER_SERVICES, PARTNER_STATES, PARTNER_TEAM_SIZES } from "@/lib/partner-options";

const selectClass =
  "h-9 w-full rounded-md border border-theme-border bg-theme-bg px-3 text-sm text-theme-primary outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

/** The installer application form on /partner. Saves to the admin app and e-mails the admins (see /api/partners). */
export function PartnerForm() {
  const [states, setStates] = React.useState<string[]>([]);
  const [services, setServices] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");

  const toggle = (list: string[], set: (v: string[]) => void, item: string) => set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    if (states.length === 0 || services.length === 0) {
      setStatus("error");
      setError(states.length === 0 ? "Choose at least one state you work in." : "Choose at least one service you offer.");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: get("companyName"),
          contactName: get("contactName"),
          phone: get("phone"),
          email: get("email"),
          website: get("website"),
          states,
          cities: get("cities"),
          services,
          yearsInBusiness: get("yearsInBusiness"),
          installsCompleted: get("installsCompleted"),
          teamSize: get("teamSize"),
          certifications: get("certifications"),
          message: get("message"),
          website_url: get("website_url"),
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) {
        setStatus("error");
        setError(json?.error ?? "Couldn't send your application. Please try again.");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Couldn't send your application. Please check your connection and try again.");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-theme-border bg-theme-surface px-7 py-10 text-center sm:px-10">
        <CheckCircle2 className="mx-auto size-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold text-theme-primary">Thanks, we have your application.</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-theme-secondary">
          We have e-mailed you a confirmation. Our team will review it and get in touch on the phone number or e-mail you gave us.
        </p>
      </div>
    );
  }

  const field = "space-y-1.5";
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">About your company</p>
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className={field}>
          <Label htmlFor="pf-company">Company name</Label>
          <Input id="pf-company" name="companyName" required minLength={2} autoComplete="organization" />
        </div>
        <div className={field}>
          <Label htmlFor="pf-website">
            Website <span className="font-normal text-theme-muted">(optional)</span>
          </Label>
          <Input id="pf-website" name="website" inputMode="url" autoComplete="url" />
        </div>
        <div className={field}>
          <Label htmlFor="pf-contact">Contact person</Label>
          <Input id="pf-contact" name="contactName" required minLength={2} autoComplete="name" />
        </div>
        <div className={field}>
          <Label htmlFor="pf-phone">Mobile number</Label>
          <Input id="pf-phone" name="phone" type="tel" required minLength={6} autoComplete="tel" />
        </div>
        <div className={`${field} sm:col-span-2`}>
          <Label htmlFor="pf-email">E-mail</Label>
          <Input id="pf-email" name="email" type="email" required autoComplete="email" />
        </div>
      </div>

      <fieldset className="mt-8">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">What you do</legend>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PARTNER_SERVICES.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2.5 text-sm text-theme-secondary">
              <Checkbox checked={services.includes(s.id)} onCheckedChange={() => toggle(services, setServices, s.id)} aria-label={s.label} />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-8">
        <legend className="flex w-full items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">
          <span>Where you work</span>
          <span className="font-normal normal-case tracking-normal">{states.length} selected</span>
        </legend>
        <div className="mt-4 grid max-h-60 grid-cols-1 gap-x-4 gap-y-2.5 overflow-y-auto rounded-xl border border-theme-border bg-theme-bg p-4 sm:grid-cols-2 lg:grid-cols-3">
          {PARTNER_STATES.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2.5 text-sm text-theme-secondary">
              <Checkbox checked={states.includes(s)} onCheckedChange={() => toggle(states, setStates, s)} aria-label={s} />
              <span>{s}</span>
            </label>
          ))}
        </div>
        <div className={`${field} mt-4`}>
          <Label htmlFor="pf-cities">
            Cities or districts <span className="font-normal text-theme-muted">(optional)</span>
          </Label>
          <Textarea id="pf-cities" name="cities" rows={2} placeholder="For example: Chennai, Coimbatore, Madurai" />
        </div>
      </fieldset>

      <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">Your experience</p>
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className={field}>
          <Label htmlFor="pf-years">
            Years in business <span className="font-normal text-theme-muted">(optional)</span>
          </Label>
          <Input id="pf-years" name="yearsInBusiness" type="number" min={0} max={100} inputMode="numeric" />
        </div>
        <div className={field}>
          <Label htmlFor="pf-installs">Installations so far</Label>
          <select id="pf-installs" name="installsCompleted" defaultValue="" className={selectClass}>
            <option value="">Choose</option>
            {PARTNER_INSTALL_RANGES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div className={field}>
          <Label htmlFor="pf-team">Team size</Label>
          <select id="pf-team" name="teamSize" defaultValue="" className={selectClass}>
            <option value="">Choose</option>
            {PARTNER_TEAM_SIZES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`${field} mt-5`}>
        <Label htmlFor="pf-certs">
          Certifications or empanelments <span className="font-normal text-theme-muted">(optional)</span>
        </Label>
        <Textarea id="pf-certs" name="certifications" rows={2} placeholder="For example: state agency empanelment, electrical contractor licence" />
      </div>

      <div className={`${field} mt-5`}>
        <Label htmlFor="pf-message">
          Anything else you would like us to know <span className="font-normal text-theme-muted">(optional)</span>
        </Label>
        <Textarea id="pf-message" name="message" rows={4} />
      </div>

      {/* Honeypot: real visitors never see or fill this. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this empty
          <input type="text" name="website_url" tabIndex={-1} autoComplete="off" />
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
          Send my application
        </Button>
        <p className="text-xs text-theme-muted">Applying doesn&apos;t guarantee a partnership. We will use these details to reply to you.</p>
      </div>
    </form>
  );
}
