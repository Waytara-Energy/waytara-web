"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FormPart } from "./form-part";

const contactFormSchema = z.object({
  fullName: z.string().trim().min(2, "Please tell us your name."),
  phone: z.string().trim().min(10, "Please give a 10-digit mobile number."),
  email: z.string().trim().email("Please give a valid e-mail address."),
  city: z.string().trim().min(2, "Please tell us your city or pincode."),
  segment: z.enum(["home", "commercial", "ev_fleet"]),
  message: z.string().trim().min(5, "Please tell us a little about what you need."),
  // Honeypot: left blank and hidden for real visitors; bots that fill every field trip it.
  website: z.string().optional(),
});
type ContactFormData = z.infer<typeof contactFormSchema>;

const INTERESTS = [
  { id: "home", label: "My home" },
  { id: "commercial", label: "My business or building" },
  { id: "ev_fleet", label: "EV charging" },
] as const;

const Error_ = ({ text }: { text?: string }) =>
  text ? (
    <p role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
      {text}
    </p>
  ) : null;

/** The contact form on /contact. Saves to /api/leads as a "contact_page" lead (same API as before). */
export function ContactForm() {
  const [done, setDone] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({ resolver: zodResolver(contactFormSchema), defaultValues: { segment: "home" } });
  const segment = useWatch({ control, name: "segment" });

  async function onSubmit(data: ContactFormData) {
    setSubmitError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, source: "contact_page" }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Something went wrong. Please try again.");
      setDone(String(result.data.id));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (done) {
    return (
      <div role="status" className="border-t border-theme-border pt-10">
        <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="mt-5 text-xl font-bold tracking-tight text-theme-primary">Thanks, we have your message.</p>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-theme-secondary">
          One of our engineers will read it and get back to you by phone or e-mail. Your reference is <span className="font-mono font-semibold text-theme-primary">{done}</span>.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-6">
          <Link href="/planner" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
            Plan my system while you wait
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => {
              setDone(null);
              reset();
            }}
            className="text-sm font-medium text-theme-secondary underline-offset-4 hover:text-theme-primary hover:underline"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  const field = "space-y-2";
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="relative">
      {/* Honeypot: off-screen, never reachable by real visitors. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <FormPart n={1} title="About you">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className={field}>
            <Label htmlFor="fullName">Your name</Label>
            <Input id="fullName" autoComplete="name" aria-invalid={!!errors.fullName} {...register("fullName")} />
            <Error_ text={errors.fullName?.message} />
          </div>
          <div className={field}>
            <Label htmlFor="phone">Mobile number</Label>
            <Input id="phone" type="tel" autoComplete="tel" aria-invalid={!!errors.phone} {...register("phone")} />
            <Error_ text={errors.phone?.message} />
          </div>
          <div className={field}>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
            <Error_ text={errors.email?.message} />
          </div>
          <div className={field}>
            <Label htmlFor="city">City or pincode</Label>
            <Input id="city" autoComplete="address-level2" aria-invalid={!!errors.city} {...register("city")} />
            <Error_ text={errors.city?.message} />
          </div>
        </div>
      </FormPart>

      <FormPart n={2} title="What it is for" hint="Tap one">
        <div role="radiogroup" aria-label="What it is for" className="flex flex-wrap gap-3">
          {INTERESTS.map((o) => {
            const on = segment === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setValue("segment", o.id, { shouldDirty: true })}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500",
                  on ? "border-emerald-500/60 bg-emerald-500/10 text-theme-primary" : "border-theme-border text-theme-secondary hover:border-theme-muted hover:text-theme-primary"
                )}
              >
                <span aria-hidden="true" className={cn("size-2 rounded-full transition-colors", on ? "bg-emerald-500" : "bg-theme-border")} />
                {o.label}
              </button>
            );
          })}
        </div>
      </FormPart>

      <FormPart n={3} title="Your message">
        <div className={field}>
          <Label htmlFor="message">What would you like to do?</Label>
          <p className="text-sm text-theme-muted">Your property, your monthly bill and what you want from the system, in your own words.</p>
          <Textarea id="message" rows={5} aria-invalid={!!errors.message} {...register("message")} />
          <Error_ text={errors.message?.message} />
        </div>
      </FormPart>

      {submitError && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          {submitError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-theme-border pt-8">
        <Button type="submit" variant="gradient" disabled={isSubmitting} className="h-11 rounded-full px-7">
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Send my message
        </Button>
        <p className="text-xs text-theme-muted">We use these details only to reply to you.</p>
      </div>
    </form>
  );
}
