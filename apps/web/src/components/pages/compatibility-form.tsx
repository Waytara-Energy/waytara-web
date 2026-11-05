"use client";

import * as React from "react";
import { Check, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const EQUIPMENT = ["Solar inverter", "Battery storage", "Energy meters", "EV chargers", "Diesel generator"];
const CHARGER_TYPES = ["Not sure", "OCPP 1.6", "OCPP 2.0.1", "Not an OCPP charger"];

/** A choice you tap on or off, with a tick when it is on. */
function Choice({ label, on, onToggle, single = false }: { label: string; on: boolean; onToggle: () => void; single?: boolean }) {
  return (
    <button
      type="button"
      role={single ? "radio" : undefined}
      aria-checked={single ? on : undefined}
      aria-pressed={single ? undefined : on}
      onClick={onToggle}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500",
        on
          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-theme-border bg-theme-surface text-theme-secondary hover:border-emerald-500/50 hover:text-theme-primary"
      )}
    >
      {on && <Check className="size-4" aria-hidden="true" />}
      {label}
    </button>
  );
}

/**
 * The compatibility check on the Platform page, kept to what is needed to reply: a name and a mobile number, what the visitor already has (tap
 * to choose), and an optional line for the make and model. The charger type is asked only when they choose EV chargers. It goes to the team as
 * a lead from "platform_compatibility".
 */
export function CompatibilityForm() {
  const [has, setHas] = React.useState<string[]>([]);
  const [chargerType, setChargerType] = React.useState("Not sure");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");

  const toggle = (item: string) => setHas((cur) => (cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item]));
  const hasChargers = has.includes("EV chargers");

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
          source: "platform_compatibility",
          existingEquipment: has.join(", "),
          equipmentDetails: get("equipmentDetails"),
          ocppVersion: hasChargers ? chargerType : "",
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
      <div role="status">
        <CheckCircle2 className="size-12 stroke-[1.1] text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="mt-6 text-xl font-bold tracking-tight text-theme-primary">Thanks, we have your details.</p>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-theme-secondary sm:text-base">
          We will check compatibility and what connecting your equipment would involve, then get back to you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cc-name">Your name</Label>
          <Input id="cc-name" name="fullName" required minLength={2} autoComplete="name" className="h-12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cc-phone">Mobile number</Label>
          <Input id="cc-phone" name="phone" type="tel" required minLength={6} autoComplete="tel" className="h-12" />
        </div>
      </div>

      <fieldset className="mt-8">
        <legend className="text-sm font-medium text-theme-primary">What do you already have? <span className="font-normal text-theme-muted">Tap all that apply.</span></legend>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {EQUIPMENT.map((item) => (
            <Choice key={item} label={item} on={has.includes(item)} onToggle={() => toggle(item)} />
          ))}
        </div>
      </fieldset>

      {hasChargers && (
        <fieldset className="mt-8">
          <legend className="text-sm font-medium text-theme-primary">What kind of charger?</legend>
          <div role="radiogroup" aria-label="Charger type" className="mt-3 flex flex-wrap gap-2.5">
            {CHARGER_TYPES.map((item) => (
              <Choice key={item} label={item} single on={chargerType === item} onToggle={() => setChargerType(item)} />
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-8 space-y-2">
        <Label htmlFor="cc-details">
          Make and model <span className="font-normal text-theme-muted">(optional)</span>
        </Label>
        <Input id="cc-details" name="equipmentDetails" maxLength={300} placeholder="For example: Deye SUN-12K inverter, a 7.4 kW AC charger" className="h-12" />
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

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button type="submit" variant="gradient" disabled={status === "sending"} className="h-12 rounded-full px-8">
          {status === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Check my equipment
        </Button>
        <p className="text-sm text-theme-muted">We will use these details to reply to you.</p>
      </div>
    </form>
  );
}
