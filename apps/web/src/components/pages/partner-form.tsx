"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PARTNER_CITIES, PARTNER_INSTALL_RANGES, PARTNER_SERVICES, PARTNER_STATES, PARTNER_TEAM_SIZES } from "@/lib/partner-options";

const STATE_OPTIONS: MultiSelectOption[] = PARTNER_STATES.map((s) => ({ value: s, label: s }));
/** A listed city is kept as "State|City" (two states can share a name); one the installer typed is kept as it was typed. */
const cityLabel = (v: string) => (v.includes("|") ? v.split("|")[1] : v);

function Part({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-theme-border py-9 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div className="mb-6 flex items-baseline gap-3" aria-hidden="true">
        <span className="text-sm font-semibold tabular-nums text-theme-highlight">{String(n).padStart(2, "0")}</span>
        <h3 className="text-lg font-bold tracking-tight text-theme-primary sm:text-xl">{title}</h3>
        {hint && <span className="text-sm text-theme-muted">{hint}</span>}
      </div>
      {children}
    </fieldset>
  );
}

const Optional = () => <span className="font-normal text-theme-muted"> (optional)</span>;

/** The installer application form on /partner. Saves to the admin app and e-mails the admins (see /api/partners). */
export function PartnerForm() {
  const [states, setStates] = React.useState<string[]>([]);
  const [cities, setCities] = React.useState<string[]>([]);
  const [services, setServices] = React.useState<string[]>([]);
  const [installs, setInstalls] = React.useState("");
  const [team, setTeam] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");

  // The places to pick from are those of the states chosen, grouped by state.
  const cityOptions = React.useMemo<MultiSelectOption[]>(
    () => PARTNER_STATES.filter((s) => states.includes(s)).flatMap((s) => PARTNER_CITIES[s].map((c) => ({ value: `${s}|${c}`, label: c, group: s }))),
    [states]
  );
  const chooseStates = (next: string[]) => {
    setStates(next);
    // a city of a state that is no longer chosen goes with it; one the installer typed stays
    setCities((prev) => prev.filter((c) => !c.includes("|") || next.includes(c.split("|")[0])));
  };
  const toggleService = (id: string) => setServices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    if (services.length === 0 || states.length === 0) {
      setStatus("error");
      setError(services.length === 0 ? "Choose at least one thing you do." : "Choose at least one state you work in.");
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
          cities: cities.map(cityLabel).join(", "),
          services,
          yearsInBusiness: get("yearsInBusiness"),
          installsCompleted: installs,
          teamSize: team,
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
      <div role="status" className="border-t border-theme-border pt-10">
        <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="mt-5 text-xl font-bold tracking-tight text-theme-primary">Thanks, we have your application.</p>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-theme-secondary">
          We have e-mailed you a confirmation. Our team will review it and get in touch on the phone number or e-mail you gave us.
        </p>
      </div>
    );
  }

  const field = "space-y-2";
  return (
    <form onSubmit={onSubmit} className="relative">
      <Part n={1} title="Your company">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className={field}>
            <Label htmlFor="pf-company">Company name</Label>
            <Input id="pf-company" name="companyName" required minLength={2} autoComplete="organization" />
          </div>
          <div className={field}>
            <Label htmlFor="pf-website">
              Website
              <Optional />
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
          <div className={cn(field, "sm:col-span-2")}>
            <Label htmlFor="pf-email">E-mail</Label>
            <Input id="pf-email" name="email" type="email" required autoComplete="email" />
          </div>
        </div>
      </Part>

      <Part n={2} title="What you do" hint="Tap everything that applies">
        <div className="flex flex-wrap gap-3">
          {PARTNER_SERVICES.map((s) => {
            const on = services.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleService(s.id)}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  on ? "border-emerald-500/60 bg-emerald-500/10 text-theme-primary" : "border-theme-border text-theme-secondary hover:border-theme-muted hover:text-theme-primary"
                )}
              >
                <span aria-hidden="true" className={cn("size-2 rounded-full transition-colors", on ? "bg-emerald-500" : "bg-theme-border")} />
                {s.label}
              </button>
            );
          })}
        </div>
      </Part>

      <Part n={3} title="Where you work" hint="Search and pick">
        <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
          <div className={cn(field, "sm:col-span-1")}>
            <Label htmlFor="pf-states">States and union territories</Label>
            <MultiSelect
              id="pf-states"
              options={STATE_OPTIONS}
              value={states}
              onChange={chooseStates}
              placeholder="Choose the states you work in"
              searchPlaceholder="Search states"
              emptyText="No state found."
              aria-invalid={status === "error" && states.length === 0}
            />
          </div>
          <div className={field}>
            <Label htmlFor="pf-cities">
              Cities or districts
              <Optional />
            </Label>
            <MultiSelect
              id="pf-cities"
              options={cityOptions}
              value={cities}
              onChange={setCities}
              placeholder={states.length === 0 ? "Choose a state first" : "Choose the places you cover"}
              searchPlaceholder="Search places, or type one to add it"
              emptyText="Not listed. Type the full name to add it."
              allowCustom
              disabled={states.length === 0}
            />
          </div>
        </div>
      </Part>

      <Part n={4} title="Your experience">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className={field}>
            <Label htmlFor="pf-years">
              Years in business
              <Optional />
            </Label>
            <Input id="pf-years" name="yearsInBusiness" type="number" min={0} max={100} inputMode="numeric" />
          </div>
          <div className={field}>
            <Label htmlFor="pf-installs">
              Installations so far
              <Optional />
            </Label>
            <Select value={installs} onValueChange={setInstalls}>
              <SelectTrigger id="pf-installs">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {PARTNER_INSTALL_RANGES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={field}>
            <Label htmlFor="pf-team">
              Team size
              <Optional />
            </Label>
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger id="pf-team">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {PARTNER_TEAM_SIZES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={cn(field, "sm:col-span-3")}>
            <Label htmlFor="pf-certs">
              Certifications or empanelments
              <Optional />
            </Label>
            <Textarea id="pf-certs" name="certifications" rows={2} />
          </div>
        </div>
      </Part>

      <Part n={5} title="Anything else">
        <div className={field}>
          <Label htmlFor="pf-message">
            What would you like us to know?
            <Optional />
          </Label>
          <Textarea id="pf-message" name="message" rows={4} />
        </div>
      </Part>

      {/* Honeypot: real visitors never see or fill this. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this empty
          <input type="text" name="website_url" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-theme-border pt-8">
        <Button type="submit" variant="gradient" disabled={status === "sending"} className="h-11 rounded-full px-7">
          {status === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Send my application
        </Button>
        <p className="text-xs text-theme-muted">Applying doesn&apos;t guarantee a partnership. We use these details only to reply to you.</p>
      </div>
    </form>
  );
}
