"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FormPart } from "./form-part";
import { PARTNER_QUESTIONS, PARTNER_TYPES, TN_DISTRICTS, checkPartnerAnswers, isAsked, isPartnerType, type PartnerTypeId, type Question } from "@/lib/partner-network";

const DISTRICT_OPTIONS: MultiSelectOption[] = TN_DISTRICTS.map((d) => ({ value: d, label: d }));
type Answers = Record<string, string | string[]>;

const Optional = () => <span className="font-normal text-theme-muted"> (optional)</span>;

const pill =
  "inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
const pillState = (on: boolean) => (on ? "border-emerald-500/60 bg-emerald-500/10 text-theme-primary" : "border-theme-border text-theme-secondary hover:border-theme-muted hover:text-theme-primary");
const Dot = ({ on }: { on: boolean }) => <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full transition-colors", on ? "bg-emerald-500" : "bg-theme-border")} />;

/** One question of a partner's kind: choices as pills (one, or any number), or a short line of text. */
function QuestionField({ q, value, onChange, invalid }: { q: Question; value: string | string[] | undefined; onChange: (v: string | string[]) => void; invalid: boolean }) {
  const labelId = `pf-q-${q.key}-label`;
  if (q.kind === "text") {
    return (
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`pf-q-${q.key}`}>{q.label}</Label>
        <Input id={`pf-q-${q.key}`} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} minLength={2} maxLength={200} aria-invalid={invalid} autoComplete={q.key === "business" ? "organization" : "off"} />
      </div>
    );
  }
  const multi = q.kind === "multi";
  const chosen = multi ? ((value as string[] | undefined) ?? []) : value ? [value as string] : [];
  return (
    <div className="space-y-3 sm:col-span-2">
      <p id={labelId} className="text-sm font-medium text-theme-primary">
        {q.label}
        {multi && <span className="font-normal text-theme-muted"> (choose all that apply)</span>}
        {invalid && <span className="sr-only"> (required)</span>}
      </p>
      <div role={multi ? "group" : "radiogroup"} aria-labelledby={labelId} className="flex flex-wrap gap-3">
        {q.options?.map((o) => {
          const on = chosen.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              {...(multi ? { "aria-pressed": on } : { role: "radio", "aria-checked": on })}
              onClick={() => onChange(multi ? (on ? chosen.filter((x) => x !== o.id) : [...chosen, o.id]) : o.id)}
              className={cn(pill, pillState(on), invalid && !on && "border-red-500/40")}
            >
              <Dot on={on} />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The Partner Network application on /partner: a short first-stage form. The visitor chooses what they are (contractor, solar installer, EV charging partner or
 * technician), gives their contact details and district, and answers the few questions of their kind. No documents are asked for at this stage. Saves to the
 * admin app and e-mails the admins and the applicant (see /api/partners). A link such as /partner#apply-solar opens it on that kind.
 */
export function PartnerForm() {
  const [type, setType] = React.useState<PartnerTypeId | null>(null);
  const [answers, setAnswers] = React.useState<Answers>({});
  const [district, setDistrict] = React.useState("");
  const [others, setOthers] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [agreed, setAgreed] = React.useState(false);

  const typeRef = React.useRef<PartnerTypeId | null>(null);
  const choose = React.useCallback((next: PartnerTypeId) => {
    // another kind has other questions: what was answered for the last one goes
    if (typeRef.current !== next) setAnswers({});
    typeRef.current = next;
    setType(next);
  }, []);

  // The cards of the page ("Apply as a contractor") and the links of the campaign (/partner#apply-solar) choose the kind: on arrival, on a click on one of them
  // (a soft navigation to the same page raises no hashchange), and when the address changes.
  React.useEffect(() => {
    const fromHash = (hash: string) => {
      const id = hash.replace(/^#apply-/, "");
      if (hash.startsWith("#apply-") && isPartnerType(id)) choose(id);
    };
    fromHash(window.location.hash);
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href*="#apply-"]');
      if (a) fromHash(`#${(a.getAttribute("href") ?? "").split("#")[1] ?? ""}`);
    };
    const onHash = () => fromHash(window.location.hash);
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHash);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHash);
    };
  }, [choose]);

  // The form is much shorter than its thanks: bring the thanks (and the reference) into view.
  const thanks = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (status === "sent") thanks.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [status]);

  const questions = type ? PARTNER_QUESTIONS[type].filter((q) => isAsked(q, answers)) : [];
  const setAnswer = (key: string, v: string | string[]) => setAnswers((prev) => ({ ...prev, [key]: v }));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!type) {
      setStatus("error");
      setError("Choose what you are applying as.");
      return;
    }
    if (!district) {
      setStatus("error");
      setError("Choose the district you mainly work in.");
      return;
    }
    if (!agreed) {
      setStatus("error");
      setError("Please tick the box to agree before you send your application.");
      return;
    }
    const checked = checkPartnerAnswers(type, answers);
    if (!checked.ok) {
      setStatus("error");
      setError(checked.error);
      return;
    }
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          contactName: get("contactName"),
          phone: get("phone"),
          email: get("email"),
          district,
          otherDistricts: others,
          answers,
          message: get("message"),
          website_url: get("website_url"),
          consent: true,
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; data?: { reference?: string } } | null;
      if (!res.ok || !json?.success) {
        setStatus("error");
        setError(json?.error ?? "Couldn't send your application. Please try again.");
        return;
      }
      setReference(json.data?.reference ?? "");
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Couldn't send your application. Please check your connection and try again.");
    }
  }

  if (status === "sent") {
    return (
      <div ref={thanks} role="status" className="scroll-mt-32 border-t border-theme-border pt-10">
        <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="mt-5 text-xl font-bold tracking-tight text-theme-primary">Thanks, we have your application.</p>
        {reference && reference !== "WTP-0000-00000" && (
          <p className="mt-4 text-sm text-theme-secondary">
            Your application reference
            <span className="mt-1 block text-2xl font-bold tracking-wide tabular-nums text-theme-primary">{reference}</span>
          </p>
        )}
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-theme-secondary">
          We have e-mailed you a confirmation with a private link to follow your application. Our partnerships team will review your details and contact you on the phone number or e-mail
          you gave us. If you are shortlisted, the same page is where you add your business details and credentials. Please keep your reference to hand when we speak.
        </p>
      </div>
    );
  }

  const field = "space-y-2";
  const missing = (key: string) => status === "error" && Boolean(questions.find((q) => q.key === key)?.required) && (answers[key] === undefined || answers[key] === "" || (Array.isArray(answers[key]) && (answers[key] as string[]).length === 0));
  return (
    <form onSubmit={onSubmit} className="relative">
      <FormPart n={1} title="What are you applying as?" hint="Choose one">
        <div role="radiogroup" aria-label="What you are applying as" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PARTNER_TYPES.map((t) => {
            const on = type === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => choose(t.id)}
                className={cn("flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500", pillState(on))}
              >
                <span className="pt-1.5">
                  <Dot on={on} />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-theme-primary">{t.label}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-theme-secondary">{t.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      </FormPart>

      {type && (
        <>
          <FormPart n={2} title="Your details">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className={cn(field, "sm:col-span-2")}>
                <Label htmlFor="pf-contact">Full name</Label>
                <Input id="pf-contact" name="contactName" required minLength={2} autoComplete="name" />
              </div>
              <div className={field}>
                <Label htmlFor="pf-phone">Mobile number</Label>
                <Input id="pf-phone" name="phone" type="tel" required minLength={6} autoComplete="tel" />
              </div>
              <div className={field}>
                <Label htmlFor="pf-email">E-mail</Label>
                <Input id="pf-email" name="email" type="email" required autoComplete="email" />
              </div>
            </div>
          </FormPart>

          <FormPart n={3} title="Where you work" hint="In Tamil Nadu">
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
              <div className={field}>
                <Label htmlFor="pf-district">{type === "technician" ? "Your district" : "Your main district"}</Label>
                <Select value={district} onValueChange={setDistrict}>
                  <SelectTrigger id="pf-district" aria-invalid={status === "error" && !district}>
                    <SelectValue placeholder="Choose a district or city" />
                  </SelectTrigger>
                  <SelectContent>
                    {TN_DISTRICTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={field}>
                <Label htmlFor="pf-others">
                  Other places you can work in
                  <Optional />
                </Label>
                <MultiSelect
                  id="pf-others"
                  options={DISTRICT_OPTIONS.filter((o) => o.value !== district)}
                  value={others}
                  onChange={setOthers}
                  placeholder="Choose more districts"
                  searchPlaceholder="Search districts"
                  emptyText="No district found."
                />
              </div>
            </div>
          </FormPart>

          <FormPart n={4} title="About your work">
            <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2">
              {questions.map((q) => (
                <QuestionField key={`${type}-${q.key}`} q={q} value={answers[q.key]} onChange={(v) => setAnswer(q.key, v)} invalid={missing(q.key)} />
              ))}
            </div>
          </FormPart>

          <FormPart n={5} title="Anything else">
            <div className={field}>
              <Label htmlFor="pf-message">
                What would you like us to know?
                <Optional />
              </Label>
              <Textarea id="pf-message" name="message" rows={4} maxLength={2000} />
            </div>
          </FormPart>

          {/* Honeypot: real visitors never see or fill this. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Leave this empty
              <input type="text" name="website_url" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
        </>
      )}

      {status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {type && (
        <div className="mt-2 space-y-6 border-t border-theme-border pt-8">
          <div className="flex items-start gap-3">
            <Checkbox id="pf-agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
            <Label htmlFor="pf-agree" className="block text-sm font-normal leading-relaxed text-theme-secondary">
              I agree to the{" "}
              <Link href="/partner-terms" target="_blank" className="font-semibold text-theme-highlight underline-offset-4 hover:underline">
                Partner Terms
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" target="_blank" className="font-semibold text-theme-highlight underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              , and I understand that I will sign a WayTara Partner Agreement before any work if I am approved.
            </Label>
          </div>
          <Button type="submit" variant="gradient" disabled={status === "sending"} className="h-11 rounded-full px-7">
            {status === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Submit application
          </Button>
        </div>
      )}
    </form>
  );
}
