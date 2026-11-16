"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TN_DISTRICTS } from "@/lib/partner-network";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_TYPES,
  BUSINESS_KINDS,
  LICENCE_TYPES,
  ONBOARDING_LIMITS,
  SECTIONS,
  categorySubject,
  documentRequirements,
  memberKey,
  memberRequirements,
  memberSubject,
  onboardingGaps,
  workCategories,
  type DocRequirement,
  type Gap,
  type OnboardingData,
  type OnboardingDocument,
  type SectionId,
} from "@waytara/supabase/partner-onboarding";
import { DocumentError, DocumentSlot, ExtraDocuments, useDocumentStore, type DocumentStore } from "./file-slots";

const DISTRICT_OPTIONS: MultiSelectOption[] = TN_DISTRICTS.map((d) => ({ value: d, label: d }));
const field = "space-y-2";
const Optional = () => <span className="font-normal text-theme-muted"> (optional)</span>;
type StepId = SectionId | "review";

type Reply<T> = { ok: true; data: T } | { ok: false; error: string; gaps?: Gap[] };

/** One call to the website's own onboarding routes. Never throws: a network failure is an `ok: false` with words the applicant can read. */
async function call<T>(url: string, method: string, body?: unknown): Promise<Reply<T>> {
  try {
    const res = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: string; gaps?: Gap[] } | null;
    if (res.ok && json?.success) return { ok: true, data: json.data as T };
    return { ok: false, error: json?.error ?? "Something went wrong. Please try again.", gaps: json?.gaps };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Please check your connection and try again." };
  }
}

/** A list of rows the applicant can add to and take from (licences, people, projects). */
function Rows<T>({ items, max, addLabel, onAdd, onRemove, children }: { items: T[]; max: number; addLabel: string; onAdd: () => void; onRemove: (i: number) => void; children: (item: T, i: number) => React.ReactNode }) {
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className="relative rounded-2xl border border-theme-border p-4 pr-12 sm:p-5 sm:pr-14">
          {children(item, i)}
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${i + 1}`}
            className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full text-theme-muted outline-none transition-colors hover:bg-theme-surface hover:text-theme-primary focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      {items.length < max && (
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-4" /> {addLabel}
        </Button>
      )}
    </div>
  );
}

function SubHeading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 mt-10 border-t border-theme-border pt-7">
      <h3 className="text-[15px] font-semibold text-theme-primary">{children}</h3>
      {hint && <p className="mt-1 max-w-xl text-sm leading-relaxed text-theme-muted">{hint}</p>}
    </div>
  );
}

/** The documents asked for on one page, each as its own slot, then "Add another document" for anything else. */
function Slots({ store, reqs, extraKinds }: { store: DocumentStore; reqs: DocRequirement[]; extraKinds?: readonly string[] }) {
  const mine = store.docs.filter((d) => d.subject === "partner").map((d) => d.kind);
  return (
    <div className="space-y-3">
      {reqs.map((r) => (
        <DocumentSlot key={r.kind} store={store} kind={r.kind} label={r.label} hint={r.hint} need={r.need} satisfied={r.anyOf ? r.anyOf.some((k) => mine.includes(k)) : undefined} />
      ))}
      {extraKinds && <ExtraDocuments store={store} kinds={extraKinds} shownKinds={reqs.map((r) => r.kind)} />}
      <DocumentError store={store} />
    </div>
  );
}

export interface OnboardingContact {
  name: string;
  phone: string;
  email: string;
}

/**
 * The onboarding of a partner applicant, one page a part: who they are, the business, licences and certificates, the team, where they work, past work with photos,
 * and KYC with the bank account; then a review of what is still missing, and Send. It saves as they type (a draft, nothing has to be complete), takes files straight
 * to private storage, and lets them send it for verification once everything the law and a payment need is there. Everything goes through the website's own routes
 * under /api/partner/track/me, which act only for the signed-in partner.
 */
export function OnboardingForm({ token, partnerType, contact, initial, initialDocuments, submittedAt }: { token: string; partnerType: string | null; contact: OnboardingContact; initial: OnboardingData; initialDocuments: OnboardingDocument[]; submittedAt: string | null }) {
  const router = useRouter();
  const base = `/api/partner/track/${token}`;
  const individual = partnerType === "technician" || partnerType === "survey";
  const [data, setData] = React.useState<OnboardingData>(initial);
  const [save, setSave] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [agreed, setAgreed] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState("");
  const [sent, setSent] = React.useState(Boolean(submittedAt));
  const [visited, setVisited] = React.useState<StepId[]>([]);

  const steps = React.useMemo(() => {
    const list: { id: StepId; label: string }[] = SECTIONS.filter((s) => !(individual && s.id === "team")).map((s) => ({ id: s.id, label: s.id === "business" && individual ? "Your work details" : s.label }));
    return [...list, { id: "review" as StepId, label: "Review and send" }];
  }, [individual]);
  const [step, setStep] = React.useState<StepId>("personal");
  const top = React.useRef<HTMLDivElement>(null);
  const go = (next: StepId) => {
    // A part shows what it still needs once they have been past it, and at once when they come to it from the review ("Complete").
    setVisited((v) => Array.from(new Set([...v, step, ...(step === "review" ? [next] : [])])));
    setStep(next);
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const at = steps.findIndex((s) => s.id === step);

  // ---- saving as they type ----
  const latest = React.useRef(data);
  const dirty = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNow = React.useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return true;
    dirty.current = false;
    setSave("saving");
    const r = await call<{ savedAt: string }>(base, "PUT", { data: latest.current });
    if (!r.ok) {
      dirty.current = true;
      setSave("error");
      return false;
    }
    setSave(dirty.current ? "saving" : "saved");
    return true;
  }, [base]);
  const change = (next: OnboardingData) => {
    latest.current = next;
    dirty.current = true;
    setData(next);
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNow(), 1200);
  };
  React.useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // a failed save is tried again by itself
  React.useEffect(() => {
    if (save !== "error") return;
    const t = setTimeout(() => void saveNow(), 8000);
    return () => clearTimeout(t);
  }, [save, saveNow]);

  const set = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => change({ ...data, [key]: value });
  const person = (k: keyof OnboardingData["person"], v: string) => set("person", { ...data.person, [k]: v });
  const biz = (k: keyof OnboardingData["business"], v: string) => set("business", { ...data.business, [k]: v });
  const bank = (k: keyof OnboardingData["bank"], v: string) => set("bank", { ...data.bank, [k]: v });

  // a file for a newly typed team member needs that person saved first, so the server knows whose it is
  const store = useDocumentStore(base, initialDocuments, { before: saveNow });

  // ---- what is still missing ----
  const gaps = onboardingGaps(partnerType, data, store.docs);
  const gapsOf = (s: StepId) => gaps.filter((g) => g.section === s);
  const reqs = documentRequirements(partnerType, data);
  const reqsOf = (s: SectionId) => reqs.filter((r) => r.section === s);

  async function send() {
    setSendError("");
    if (gaps.length > 0) return setSendError("A few things are still missing. They are listed above.");
    if (!agreed) return setSendError("Please tick the box to confirm that what you sent is true.");
    setSending(true);
    try {
      // what is on the page is what is checked: wait for the last changes to be saved first
      if (!(await saveNow())) return setSendError("Your latest changes couldn't be saved yet. Please try again in a moment.");
      const r = await call<null>(`${base}/submit`, "POST", { declaration: true });
      if (r.ok) {
        setSent(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        // the application is now at Verification: reload the page's own words from the server
        router.refresh();
      } else setSendError(r.error);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="mt-10 max-w-xl border-t border-theme-border pt-8">
        <CheckCircle2 className="size-6 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-semibold text-theme-primary">We have your details</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-theme-secondary">
          Thank you. Our team will now check what you sent, and we will tell you the outcome here and by e-mail. We may ask you for something more first. You do not need to do anything now.
        </p>
      </div>
    );
  }

  /** What this page still needs, shown once they have been past it (or on the review page), so a fresh page is not a wall of red. */
  const missing = (s: SectionId) =>
    visited.includes(s) && gapsOf(s).length > 0 ? (
      <ul className="mb-6 space-y-1 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-theme-primary" role="status">
        {gapsOf(s).map((g) => (
          <li key={g.text}>Still needed: {g.text}</li>
        ))}
      </ul>
    ) : null;

  const removeMember = (i: number) => {
    const m = data.team.members[i];
    // their files go with them
    for (const d of store.docs.filter((x) => x.subject === memberSubject(memberKey(m, i)))) void store.remove(d.id);
    set("team", { ...data.team, members: data.team.members.filter((_, j) => j !== i) });
  };

  return (
    <div ref={top} className="mt-10 scroll-mt-28 grid grid-cols-1 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
      {/* the parts: a column on a wide screen, a row that scrolls on a phone */}
      <nav aria-label="Onboarding parts" className="lg:sticky lg:top-28 lg:self-start">
        <p className="mb-3 text-xs text-theme-muted lg:hidden">
          Part {at + 1} of {steps.length}
        </p>
        <ol className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
          {steps.map((s, i) => {
            const open = s.id === "review" ? gaps.length : gapsOf(s.id).length;
            const on = s.id === step;
            const done = s.id !== "review" && open === 0;
            return (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(s.id)}
                  aria-current={on ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500",
                    on ? "bg-theme-surface font-medium text-theme-primary" : "text-theme-secondary hover:bg-theme-surface/60 hover:text-theme-primary",
                  )}
                >
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium", done ? "bg-emerald-600 text-white" : on ? "border-2 border-theme-primary text-theme-primary" : "border border-theme-border text-theme-muted")}>
                    {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap lg:whitespace-normal">{s.label}</span>
                  {!done && open > 0 && visited.includes(s.id) && <span className="ml-auto hidden text-xs text-amber-700 dark:text-amber-300 lg:inline">{open} to add</span>}
                  <span className="sr-only">{done ? " (complete)" : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 hidden text-xs text-theme-muted lg:block" role="status" aria-live="polite">
          {save === "saving" && "Saving…"}
          {save === "saved" && "All changes saved"}
          {save === "error" && "Couldn't save. We will try again; your changes are still on this page."}
          {save === "idle" && "We save as you type."}
        </p>
      </nav>

      <div className="min-w-0 max-w-2xl">
        <p className="mb-5 text-xs text-theme-muted lg:hidden" role="status" aria-live="polite">
          {save === "saving" ? "Saving…" : save === "error" ? "Couldn't save. We will try again." : save === "saved" ? "All changes saved" : "We save as you type."}
        </p>

        {step === "personal" && (
          <section aria-labelledby="ob-h-personal">
            <h2 id="ob-h-personal" className="text-xl font-bold tracking-tight text-theme-primary">
              Personal details
            </h2>
            <p className="mb-7 mt-2 text-sm leading-relaxed text-theme-secondary">{individual ? "About you, as on your photo ID." : "The person we deal with for this business, as on their photo ID."}</p>
            {missing("personal")}
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
              <div className={`${field} sm:col-span-2`}>
                <Label htmlFor="ob-pname">Full name, as on the photo ID</Label>
                <Input id="ob-pname" value={data.person.name} onChange={(e) => person("name", e.target.value)} maxLength={200} autoComplete="name" />
              </div>
              {!individual && (
                <div className={field}>
                  <Label htmlFor="ob-desig">
                    Your role in the business
                    <Optional />
                  </Label>
                  <Input id="ob-desig" value={data.person.designation} onChange={(e) => person("designation", e.target.value)} maxLength={80} placeholder="Owner, partner, director, manager" autoComplete="organization-title" />
                </div>
              )}
              <div className={field}>
                <Label htmlFor="ob-alt">
                  Another phone number
                  <Optional />
                </Label>
                <Input id="ob-alt" type="tel" value={data.person.altPhone} onChange={(e) => person("altPhone", e.target.value.replace(/[^0-9+ ]/g, "").slice(0, 32))} inputMode="tel" maxLength={32} />
              </div>
              <div className={field}>
                <Label htmlFor="ob-phone">Mobile number</Label>
                <Input id="ob-phone" value={contact.phone} readOnly disabled />
              </div>
              <div className={field}>
                <Label htmlFor="ob-email">E-mail address</Label>
                <Input id="ob-email" value={contact.email} readOnly disabled />
              </div>
              <p className="text-xs text-theme-muted sm:col-span-2">The mobile number and e-mail address are the ones we confirmed with you. To change either, write to us under Support.</p>
            </div>
            <SubHeading hint="PDF, JPG, PNG or WebP, up to 10 MB each. Only the WayTara team sees your files, and only to verify you.">Documents</SubHeading>
            <Slots store={store} reqs={reqsOf("personal")} />
          </section>
        )}

        {step === "business" && (
          <section aria-labelledby="ob-h-business">
            <h2 id="ob-h-business" className="text-xl font-bold tracking-tight text-theme-primary">
              {individual ? "Your work details" : "Business details"}
            </h2>
            <p className="mb-7 mt-2 text-sm leading-relaxed text-theme-secondary">{individual ? "The name you work under and where you are based." : "The business as it is registered, and its registrations."}</p>
            {missing("business")}
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
              <div className={`${field} sm:col-span-2`}>
                <Label htmlFor="ob-name">{individual ? "The name you work under" : "Business name"}</Label>
                <Input id="ob-name" value={data.business.name} onChange={(e) => biz("name", e.target.value)} maxLength={200} autoComplete="organization" />
              </div>
              <div className={field}>
                <Label htmlFor="ob-kind">
                  {individual ? "How you work" : "Kind of business"}
                  {individual && <Optional />}
                </Label>
                <Select value={data.business.kind} onValueChange={(v) => biz("kind", v)}>
                  <SelectTrigger id="ob-kind">
                    <SelectValue placeholder="Choose one" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_KINDS.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={field}>
                <Label htmlFor="ob-started">
                  Year started
                  <Optional />
                </Label>
                <Input id="ob-started" value={data.business.started} onChange={(e) => biz("started", e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="2015" />
              </div>
              <div className={`${field} sm:col-span-2`}>
                <Label htmlFor="ob-address">Address</Label>
                <Textarea id="ob-address" value={data.business.address} onChange={(e) => biz("address", e.target.value)} rows={2} maxLength={400} autoComplete="street-address" />
              </div>
              <div className={field}>
                <Label htmlFor="ob-city">Town or city</Label>
                <Input id="ob-city" value={data.business.city} onChange={(e) => biz("city", e.target.value)} maxLength={100} autoComplete="address-level2" />
              </div>
              <div className={field}>
                <Label htmlFor="ob-pin">PIN code</Label>
                <Input id="ob-pin" value={data.business.pin} onChange={(e) => biz("pin", e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} autoComplete="postal-code" />
              </div>
              <div className={field}>
                <Label htmlFor="ob-gstin">
                  GST number (GSTIN)
                  <Optional />
                </Label>
                <Input id="ob-gstin" value={data.business.gstin} onChange={(e) => biz("gstin", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))} maxLength={15} placeholder="33ABCDE1234F1Z5" />
                <p className="text-xs text-theme-muted">Leave it empty if you are not registered for GST.</p>
              </div>
              {!individual && (
                <>
                  <div className={field}>
                    <Label htmlFor="ob-udyam">
                      Udyam number
                      <Optional />
                    </Label>
                    <Input id="ob-udyam" value={data.business.udyam} onChange={(e) => biz("udyam", e.target.value.toUpperCase().slice(0, 30))} maxLength={30} placeholder="UDYAM-TN-00-0000000" />
                  </div>
                  <div className={`${field} sm:col-span-2`}>
                    <Label htmlFor="ob-web">
                      Website
                      <Optional />
                    </Label>
                    <Input id="ob-web" value={data.business.website} onChange={(e) => biz("website", e.target.value)} maxLength={300} inputMode="url" />
                  </div>
                </>
              )}
            </div>
            <SubHeading hint="Send what applies to your business. The ones marked Required are needed before you can send.">Business documents</SubHeading>
            <Slots store={store} reqs={reqsOf("business")} extraKinds={["other"]} />
          </section>
        )}

        {step === "licences" && (
          <section aria-labelledby="ob-h-licences">
            <h2 id="ob-h-licences" className="text-xl font-bold tracking-tight text-theme-primary">
              Licences and certificates
            </h2>
            <p className="mb-7 mt-2 text-sm leading-relaxed text-theme-secondary">List each licence or certificate with its number and when it is valid until, then send a copy of each. We check them with the authority that issued them.</p>
            {missing("licences")}
            <Rows
              items={data.licences}
              max={ONBOARDING_LIMITS.licences}
              addLabel="Add a licence or certificate"
              onAdd={() => set("licences", [...data.licences, { type: "", grade: "", number: "", validUntil: "" }])}
              onRemove={(i) => set("licences", data.licences.filter((_, j) => j !== i))}
            >
              {(l, i) => {
                const up = (patch: Partial<typeof l>) => set("licences", data.licences.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                    <div className={`${field} sm:col-span-2`}>
                      <Label htmlFor={`ob-l-type-${i}`}>Kind</Label>
                      <Select value={l.type} onValueChange={(v) => up({ type: v })}>
                        <SelectTrigger id={`ob-l-type-${i}`}>
                          <SelectValue placeholder="Choose one" />
                        </SelectTrigger>
                        <SelectContent>
                          {LICENCE_TYPES.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={field}>
                      <Label htmlFor={`ob-l-num-${i}`}>Number</Label>
                      <Input id={`ob-l-num-${i}`} value={l.number} onChange={(e) => up({ number: e.target.value })} maxLength={60} />
                    </div>
                    <div className={field}>
                      <Label htmlFor={`ob-l-grade-${i}`}>
                        Class or grade
                        <Optional />
                      </Label>
                      <Input id={`ob-l-grade-${i}`} value={l.grade} onChange={(e) => up({ grade: e.target.value })} maxLength={60} />
                    </div>
                    <div className={field}>
                      <Label htmlFor={`ob-l-valid-${i}`}>
                        Valid until
                        <Optional />
                      </Label>
                      <Input id={`ob-l-valid-${i}`} type="date" value={l.validUntil} onChange={(e) => up({ validUntil: e.target.value })} />
                    </div>
                  </div>
                );
              }}
            </Rows>
            <SubHeading hint="A clear scan or photo of every page, with the number and the validity readable.">Copies</SubHeading>
            <Slots store={store} reqs={reqsOf("licences")} extraKinds={["certificate", "trade_certificate", "training_certificate", "other"].filter((k) => !reqsOf("licences").some((r) => r.kind === k))} />
          </section>
        )}

        {step === "team" && (
          <section aria-labelledby="ob-h-team">
            <h2 id="ob-h-team" className="text-xl font-bold tracking-tight text-theme-primary">
              Team
            </h2>
            <p className="mb-7 mt-2 text-sm leading-relaxed text-theme-secondary">
              Add the people who will work on WayTara projects. We verify each person: their photo ID, and their licence or certificate if their work needs one. If you work alone, leave this empty.
            </p>
            {missing("team")}
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
              <div className={field}>
                <Label htmlFor="ob-team">
                  People who work with you
                  <Optional />
                </Label>
                <Input id="ob-team" value={data.team.size} onChange={(e) => set("team", { ...data.team, size: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} />
              </div>
              <div className={field}>
                <Label htmlFor="ob-cert">
                  Of them, holding a licence or certificate
                  <Optional />
                </Label>
                <Input id="ob-cert" value={data.team.certified} onChange={(e) => set("team", { ...data.team, certified: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} />
              </div>
            </div>
            <SubHeading hint="Removing a person removes their files too.">People</SubHeading>
            <Rows
              items={data.team.members}
              max={ONBOARDING_LIMITS.members}
              addLabel="Add a person"
              onAdd={() => set("team", { ...data.team, members: [...data.team.members, { id: crypto.randomUUID(), name: "", role: "", phone: "", certificate: "", needsLicence: true, addedAt: new Date().toISOString() }] })}
              onRemove={removeMember}
            >
              {(m, i) => {
                const up = (patch: Partial<typeof m>) => set("team", { ...data.team, members: data.team.members.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                const subject = memberSubject(memberKey(m, i));
                const theirs = store.docs.filter((d) => d.subject === subject).map((d) => d.kind);
                return (
                  <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                    <div className={field}>
                      <Label htmlFor={`ob-m-name-${i}`}>Name</Label>
                      <Input id={`ob-m-name-${i}`} value={m.name} onChange={(e) => up({ name: e.target.value })} maxLength={120} />
                    </div>
                    <div className={field}>
                      <Label htmlFor={`ob-m-role-${i}`}>
                        Role
                        <Optional />
                      </Label>
                      <Input id={`ob-m-role-${i}`} value={m.role} onChange={(e) => up({ role: e.target.value })} maxLength={80} placeholder="Supervisor, electrician, helper" />
                    </div>
                    <div className="flex items-start gap-3 sm:col-span-2">
                      <Checkbox id={`ob-m-needs-${i}`} checked={m.needsLicence} onCheckedChange={(v) => up({ needsLicence: v === true })} className="mt-0.5" />
                      <Label htmlFor={`ob-m-needs-${i}`} className="block text-sm font-normal leading-relaxed text-theme-secondary">
                        This person needs a licence or certificate to do their work (a supervisor or a wireman, for example).
                      </Label>
                    </div>
                    {m.needsLicence && (
                      <div className={`${field} sm:col-span-2`}>
                        <Label htmlFor={`ob-m-cert-${i}`}>Licence or certificate number</Label>
                        <Input id={`ob-m-cert-${i}`} value={m.certificate} onChange={(e) => up({ certificate: e.target.value })} maxLength={120} />
                      </div>
                    )}
                    <div className="space-y-3 sm:col-span-2">
                      {m.name ? (
                        memberRequirements(m.needsLicence).map((r) => (
                          <DocumentSlot key={r.kind} store={store} kind={r.kind} subject={subject} label={r.label} hint={r.hint} need={r.need} satisfied={r.anyOf ? r.anyOf.some((k) => theirs.includes(k)) : undefined} />
                        ))
                      ) : (
                        <p className="text-xs text-theme-muted">Type their name first, then add their documents.</p>
                      )}
                    </div>
                  </div>
                );
              }}
            </Rows>
            <div className="mt-4">
              <DocumentError store={store} />
            </div>
          </section>
        )}

        {step === "areas" && (
          <section aria-labelledby="ob-h-areas">
            <h2 id="ob-h-areas" className="text-xl font-bold tracking-tight text-theme-primary">
              Where you work
            </h2>
            <p className="mb-7 mt-2 text-sm leading-relaxed text-theme-secondary">The districts you can take work in, and how much.</p>
            {missing("areas")}
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
              <div className={`${field} sm:col-span-2`}>
                <Label htmlFor="ob-districts">Districts and cities you can work in</Label>
                <MultiSelect id="ob-districts" options={DISTRICT_OPTIONS} value={data.areas.districts} onChange={(v) => set("areas", { ...data.areas, districts: v })} placeholder="Choose districts" searchPlaceholder="Search districts" emptyText="No district found." />
              </div>
              <div className={field}>
                <Label htmlFor="ob-capacity">
                  Jobs you can take on in a month
                  <Optional />
                </Label>
                <Input id="ob-capacity" value={data.areas.capacity} onChange={(e) => set("areas", { ...data.areas, capacity: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} />
              </div>
            </div>
          </section>
        )}

        {step === "work" && (
          <section aria-labelledby="ob-h-work">
            <h2 id="ob-h-work" className="text-xl font-bold tracking-tight text-theme-primary">
              Past work and photos
            </h2>
            <p className="mb-7 mt-2 text-sm leading-relaxed text-theme-secondary">Nothing here is required, but photos of finished work and a few projects we can ask about make verifying you much quicker.</p>
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
              <div className={field}>
                <Label htmlFor="ob-installs">
                  {partnerType === "survey" ? "Surveys completed so far" : "Installations completed so far"}
                  <Optional />
                </Label>
                <Input id="ob-installs" value={data.work.installs} onChange={(e) => set("work", { ...data.work, installs: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} />
              </div>
              {partnerType !== "survey" && (
                <div className={field}>
                  <Label htmlFor="ob-largest">
                    Largest system, in kW
                    <Optional />
                  </Label>
                  <Input id="ob-largest" value={data.work.largest} onChange={(e) => set("work", { ...data.work, largest: e.target.value.replace(/[^0-9.]/g, "").slice(0, 8) })} inputMode="decimal" maxLength={8} />
                </div>
              )}
              <div className={`${field} sm:col-span-2`}>
                <Label htmlFor="ob-summary">
                  Tell us about the work you do
                  <Optional />
                </Label>
                <Textarea id="ob-summary" value={data.work.summary} onChange={(e) => set("work", { ...data.work, summary: e.target.value })} rows={4} maxLength={1500} />
              </div>
            </div>

            <SubHeading hint="A few clear photos of each kind of work you do. Please do not show a customer's face, name or address.">Photos and records</SubHeading>
            <div className="space-y-3">
              {workCategories(partnerType).map((c) => (
                <DocumentSlot key={c.id} store={store} kind={c.kind} subject={categorySubject(c.id)} label={c.label} need="optional" hint={c.kind === "survey_record" ? "Survey reports, sketches or measurement sheets" : "Photos of finished work"} />
              ))}
              <DocumentSlot store={store} kind="completion_certificate" label="Completion certificates and references" need="optional" hint="A work completion certificate, or a letter from a customer we may call" />
              <DocumentError store={store} />
            </div>

            <SubHeading>Projects we can ask you about</SubHeading>
            <Rows
              items={data.work.projects}
              max={ONBOARDING_LIMITS.projects}
              addLabel="Add a project"
              onAdd={() => set("work", { ...data.work, projects: [...data.work.projects, { title: "", place: "", size: "", year: "", note: "" }] })}
              onRemove={(i) => set("work", { ...data.work, projects: data.work.projects.filter((_, j) => j !== i) })}
            >
              {(p, i) => {
                const up = (patch: Partial<typeof p>) => set("work", { ...data.work, projects: data.work.projects.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                    <div className={`${field} sm:col-span-2`}>
                      <Label htmlFor={`ob-p-title-${i}`}>What it was</Label>
                      <Input id={`ob-p-title-${i}`} value={p.title} onChange={(e) => up({ title: e.target.value })} maxLength={120} placeholder="5 kW rooftop solar for a home" />
                    </div>
                    <div className={field}>
                      <Label htmlFor={`ob-p-place-${i}`}>Where</Label>
                      <Input id={`ob-p-place-${i}`} value={p.place} onChange={(e) => up({ place: e.target.value })} maxLength={120} />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div className={field}>
                        <Label htmlFor={`ob-p-size-${i}`}>kW</Label>
                        <Input id={`ob-p-size-${i}`} value={p.size} onChange={(e) => up({ size: e.target.value.replace(/[^0-9.]/g, "").slice(0, 8) })} inputMode="decimal" maxLength={8} />
                      </div>
                      <div className={field}>
                        <Label htmlFor={`ob-p-year-${i}`}>Year</Label>
                        <Input id={`ob-p-year-${i}`} value={p.year} onChange={(e) => up({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" maxLength={4} />
                      </div>
                    </div>
                    <div className={`${field} sm:col-span-2`}>
                      <Label htmlFor={`ob-p-note-${i}`}>
                        Anything to add
                        <Optional />
                      </Label>
                      <Textarea id={`ob-p-note-${i}`} value={p.note} onChange={(e) => up({ note: e.target.value })} rows={2} maxLength={400} />
                    </div>
                  </div>
                );
              }}
            </Rows>
          </section>
        )}

        {step === "bank" && (
          <section aria-labelledby="ob-h-bank">
            <h2 id="ob-h-bank" className="text-xl font-bold tracking-tight text-theme-primary">
              KYC and bank
            </h2>
            <p className="mb-7 mt-2 text-sm leading-relaxed text-theme-secondary">
              The PAN and the bank account we would pay. We use them only for payments and tax, show the account number to our team with all but the last four digits hidden, and record each time it is opened.
            </p>
            {missing("bank")}
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
              <div className={field}>
                <Label htmlFor="ob-pan">PAN</Label>
                <Input id="ob-pan" value={data.business.pan} onChange={(e) => biz("pan", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} maxLength={10} placeholder="ABCDE1234F" autoComplete="off" />
                <p className="text-xs text-theme-muted">{individual ? "Your own PAN." : "The business's PAN, or your own for a proprietorship."}</p>
              </div>
            </div>

            <SubHeading>Bank account</SubHeading>
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
              <div className={`${field} sm:col-span-2`}>
                <Label htmlFor="ob-holder">Name on the account</Label>
                <Input id="ob-holder" value={data.bank.holder} onChange={(e) => bank("holder", e.target.value)} maxLength={200} autoComplete="off" />
              </div>
              <div className={field}>
                <Label htmlFor="ob-bank">Bank</Label>
                <Input id="ob-bank" value={data.bank.bankName} onChange={(e) => bank("bankName", e.target.value)} maxLength={120} autoComplete="off" />
              </div>
              <div className={field}>
                <Label htmlFor="ob-branch">
                  Branch
                  <Optional />
                </Label>
                <Input id="ob-branch" value={data.bank.branch} onChange={(e) => bank("branch", e.target.value)} maxLength={120} autoComplete="off" />
              </div>
              <div className={field}>
                <Label htmlFor="ob-acct">Account number</Label>
                <Input id="ob-acct" value={data.bank.accountNumber} onChange={(e) => bank("accountNumber", e.target.value.replace(/\D/g, "").slice(0, 18))} inputMode="numeric" maxLength={18} autoComplete="off" />
              </div>
              <div className={field}>
                <Label htmlFor="ob-ifsc">IFSC</Label>
                <Input id="ob-ifsc" value={data.bank.ifsc} onChange={(e) => bank("ifsc", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))} maxLength={11} placeholder="SBIN0001234" autoComplete="off" />
              </div>
              <div className={field}>
                <Label htmlFor="ob-atype">
                  Kind of account
                  <Optional />
                </Label>
                <Select value={data.bank.accountType} onValueChange={(v) => bank("accountType", v)}>
                  <SelectTrigger id="ob-atype">
                    <SelectValue placeholder="Choose one" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SubHeading hint="We never ask for your Aadhaar number. If you send an Aadhaar copy as an address proof, hide all but its last four digits.">Proofs</SubHeading>
            <Slots store={store} reqs={reqsOf("bank")} />
          </section>
        )}

        {step === "review" && (
          <section aria-labelledby="ob-h-review">
            <h2 id="ob-h-review" className="text-xl font-bold tracking-tight text-theme-primary">
              Review and send
            </h2>
            <p className="mb-7 mt-2 text-sm leading-relaxed text-theme-secondary">When you send it, we start verifying. You will not be able to change it after that, but we may ask you for something more.</p>
            <ul className="divide-y divide-theme-border rounded-2xl border border-theme-border">
              {steps
                .filter((s) => s.id !== "review")
                .map((s) => {
                  const open = gapsOf(s.id);
                  return (
                    <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="flex items-center gap-2 text-sm font-medium text-theme-primary">
                          {open.length === 0 ? <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />}
                          {s.label}
                        </p>
                        {open.length === 0 ? (
                          <p className="mt-0.5 pl-6 text-xs text-theme-muted">Complete</p>
                        ) : (
                          <ul className="mt-1 space-y-0.5 pl-6 text-xs text-theme-secondary">
                            {open.map((g) => (
                              <li key={g.text}>{g.text}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => go(s.id)}>
                        {open.length === 0 ? "Open" : "Complete"}
                      </Button>
                    </li>
                  );
                })}
            </ul>
            <p className="mt-4 text-xs text-theme-muted">
              {store.docs.length} file{store.docs.length === 1 ? "" : "s"} sent.
            </p>

            <div className="mt-8 flex items-start gap-3">
              <Checkbox id="ob-agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
              <Label htmlFor="ob-agree" className="block max-w-xl text-sm font-normal leading-relaxed text-theme-secondary">
                I confirm that what I have told you and the documents I have sent are true and are mine to send, that the people I listed agreed to my sending their documents, and that you may check all of it with the authorities that issued them.
              </Label>
            </div>
            {sendError && (
              <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
                {sendError}
              </p>
            )}
            <Button type="button" onClick={() => void send()} disabled={sending || gaps.length > 0} className="mt-6">
              {sending && <Loader2 className="size-4 animate-spin" />}
              {sending ? "Sending…" : "Send for verification"}
            </Button>
            {gaps.length > 0 && <p className="mt-2 text-xs text-theme-muted">You can send once the parts above are complete.</p>}
          </section>
        )}

        {/* back and on */}
        <div className="mt-12 flex items-center justify-between gap-3 border-t border-theme-border pt-6">
          {at > 0 ? (
            <Button type="button" variant="outline" onClick={() => go(steps[at - 1].id)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          ) : (
            <span />
          )}
          {at < steps.length - 1 && (
            <Button type="button" onClick={() => go(steps[at + 1].id)}>
              {steps[at + 1].id === "review" ? "Review" : "Continue"} <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
