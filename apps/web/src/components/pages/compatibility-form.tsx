"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EQUIPMENT = ["Solar inverter", "Battery storage", "Energy meters", "EV chargers", "Diesel generator"];
const OCPP_OPTIONS = ["Not sure", "OCPP 1.6", "OCPP 2.0.1", "Not an OCPP charger", "No chargers"];

/**
 * The compatibility check on the Platform page: what equipment a visitor already has and what they would like to connect. It goes to the team
 * as a lead from "platform_compatibility", with the equipment details in the message.
 */
export function CompatibilityForm() {
  const [has, setHas] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");

  const toggle = (item: string) => setHas((cur) => (cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item]));

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
          city: get("city"),
          message: get("message"),
          source: "platform_compatibility",
          existingEquipment: has.join(", "),
          equipmentDetails: get("equipmentDetails"),
          ocppVersion: get("ocppVersion"),
          website: get("website"),
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) {
        setStatus("error");
        setError(json?.error ?? "Couldn't send your request. Please try again.");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Couldn't send your request. Please check your connection and try again.");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-theme-border bg-theme-surface px-7 py-10 text-center sm:px-10">
        <CheckCircle2 className="mx-auto size-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold text-theme-primary">Thanks, we have your details.</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-theme-secondary">
          We will check compatibility and what connecting your equipment would involve, then get back to you.
        </p>
      </div>
    );
  }

  const field = "space-y-1.5";
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className={field}>
          <Label htmlFor="cc-name">Your name</Label>
          <Input id="cc-name" name="fullName" required minLength={2} autoComplete="name" />
        </div>
        <div className={field}>
          <Label htmlFor="cc-phone">Mobile number</Label>
          <Input id="cc-phone" name="phone" type="tel" required minLength={6} autoComplete="tel" />
        </div>
        <div className={field}>
          <Label htmlFor="cc-email">
            Email <span className="font-normal text-theme-muted">(optional)</span>
          </Label>
          <Input id="cc-email" name="email" type="email" autoComplete="email" />
        </div>
        <div className={field}>
          <Label htmlFor="cc-city">
            City or pincode <span className="font-normal text-theme-muted">(optional)</span>
          </Label>
          <Input id="cc-city" name="city" autoComplete="address-level2" />
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-theme-primary">What do you already have?</legend>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {EQUIPMENT.map((item) => (
            <label key={item} className="flex cursor-pointer items-center gap-2.5 text-sm text-theme-secondary">
              <Checkbox checked={has.includes(item)} onCheckedChange={() => toggle(item)} aria-label={item} />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={`${field} mt-6`}>
        <Label htmlFor="cc-details">Make and model</Label>
        <Textarea id="cc-details" name="equipmentDetails" rows={3} placeholder="For example: Deye SUN-12K inverter, a 7.4 kW AC charger, a three-phase meter" />
      </div>

      <div className={`${field} mt-6 sm:max-w-xs`}>
        <Label htmlFor="cc-ocpp">Charger OCPP version</Label>
        <select
          id="cc-ocpp"
          name="ocppVersion"
          defaultValue="Not sure"
          className="h-9 w-full rounded-md border border-theme-border bg-theme-bg px-3 text-sm text-theme-primary outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {OCPP_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <div className={`${field} mt-6`}>
        <Label htmlFor="cc-message">
          Anything else? <span className="font-normal text-theme-muted">(optional)</span>
        </Label>
        <Textarea id="cc-message" name="message" rows={3} placeholder="What would you like to see or manage?" />
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
          Check my equipment
        </Button>
        <p className="text-xs text-theme-muted">We will use these details to reply to you.</p>
      </div>
    </form>
  );
}
