"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const EQUIPMENT = ["Solar inverter", "Battery storage", "Energy meters", "EV chargers", "Diesel generator"];
const CHARGER_TYPES = ["Not sure", "OCPP 1.6", "OCPP 2.0.1", "Not an OCPP charger"];
const STEPS = 3;

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
        "inline-flex h-12 items-center gap-2 rounded-full border px-6 text-[15px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500",
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
 * The compatibility check on the Platform page, as three short steps with one question each: what the visitor already has (tap to choose, and the
 * charger type if they have chargers), the make and model (optional), and how to reach them (name, mobile number, email and city or place, all required).
 * It goes to the team as a lead from "platform_compatibility".
 */
export function CompatibilityForm() {
  const [step, setStep] = React.useState(0);
  const [has, setHas] = React.useState<string[]>([]);
  const [chargerType, setChargerType] = React.useState("Not sure");
  const [details, setDetails] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");

  const toggle = (item: string) => setHas((cur) => (cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item]));
  const hasChargers = has.includes("EV chargers");

  async function send(form: FormData) {
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
          source: "platform_compatibility",
          existingEquipment: has.join(", "),
          equipmentDetails: details.trim(),
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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < STEPS - 1) {
      setStep(step + 1); // Enter moves on to the next question
      return;
    }
    void send(new FormData(e.currentTarget));
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

  const last = step === STEPS - 1;
  const recap = [has.length ? has.join(", ") + (hasChargers ? ` (${chargerType})` : "") : "", details.trim()].filter(Boolean).join(" · ");

  return (
    <form onSubmit={onSubmit} className="relative">
      {/* Where you are: three bars and "Step 1 of 3". */}
      <div className="flex items-center gap-4">
        <div className="flex flex-1 gap-2" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-emerald-500" : "bg-theme-border")} />
          ))}
        </div>
        <p aria-live="polite" className="shrink-0 text-sm font-medium text-theme-muted">
          Step {step + 1} of {STEPS}
        </p>
      </div>

      <div className="mt-10 min-h-[17rem]">
        {step === 0 && (
          <fieldset>
            <legend className="text-[clamp(1.5rem,2.2vw,2rem)] font-bold leading-tight tracking-tight text-theme-primary">What do you already have?</legend>
            <p className="mt-2 text-[15px] text-theme-secondary">Tap everything that applies. Nothing yet? Just carry on.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {EQUIPMENT.map((item) => (
                <Choice key={item} label={item} on={has.includes(item)} onToggle={() => toggle(item)} />
              ))}
            </div>
            {hasChargers && (
              <div className="mt-8">
                <p className="text-sm font-medium text-theme-primary">What kind of charger?</p>
                <div role="radiogroup" aria-label="Charger type" className="mt-3 flex flex-wrap gap-3">
                  {CHARGER_TYPES.map((item) => (
                    <Choice key={item} label={item} single on={chargerType === item} onToggle={() => setChargerType(item)} />
                  ))}
                </div>
              </div>
            )}
          </fieldset>
        )}

        {step === 1 && (
          <div>
            <Label htmlFor="cc-details" className="text-[clamp(1.5rem,2.2vw,2rem)] font-bold leading-tight tracking-tight text-theme-primary">
              Do you know the make and model?
            </Label>
            <p className="mt-2 text-[15px] text-theme-secondary">It helps us check faster. Skip it if you are not sure.</p>
            <Input
              id="cc-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={300}
              autoFocus
              className="mt-6 h-14 text-base"
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-[clamp(1.5rem,2.2vw,2rem)] font-bold leading-tight tracking-tight text-theme-primary">How can we reach you?</p>
            <p className="mt-2 text-[15px] text-theme-secondary">We will call, message or e-mail you with the answer.</p>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cc-name">Your name</Label>
                <Input id="cc-name" name="fullName" required minLength={2} autoComplete="name" autoFocus className="h-14 text-base" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-phone">Mobile number</Label>
                <Input id="cc-phone" name="phone" type="tel" required minLength={6} autoComplete="tel" className="h-14 text-base" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-email">Email</Label>
                <Input id="cc-email" name="email" type="email" required autoComplete="email" className="h-14 text-base" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-city">City or place</Label>
                <Input id="cc-city" name="city" required minLength={2} autoComplete="address-level2" className="h-14 text-base" />
              </div>
            </div>
            {recap && (
              <p className="mt-6 text-sm leading-relaxed text-theme-muted">
                <span className="font-semibold text-theme-secondary">Checking: </span>
                {recap}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Honeypot: real visitors never see or fill this. */}
      {last && (
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
      )}

      {status === "error" && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-5">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="inline-flex h-12 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-theme-secondary outline-none hover:text-theme-primary focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </button>
        )}
        <Button type="submit" variant="gradient" disabled={status === "sending"} className="h-12 rounded-full px-8">
          {status === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {last ? "Check my equipment" : step === 0 && has.length === 0 ? "Skip" : "Next"}
          {!last && <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
        {step === 1 && !details.trim() && <p className="text-sm text-theme-muted">You can leave it empty.</p>}
      </div>
    </form>
  );
}
