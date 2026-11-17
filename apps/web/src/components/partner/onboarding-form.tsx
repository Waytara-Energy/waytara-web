"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
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
  CAPABILITIES,
  CLIENT_TYPES,
  EQUIPMENT,
  LICENCE_EXPIRES,
  LICENCE_TYPES,
  ONBOARDING_LIMITS,
  SECTIONS,
  SITE_ROLES,
  siteRoleOf,
  categorySubject,
  documentRequirements,
  isAccountNumber,
  isGstin,
  isIfsc,
  isPan,
  isUdyam,
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
import { AgreementCard } from "./agreement-card";
import { CrewLink, type CrewInviteState } from "./crew-link";
import { VerifyCheck, type CheckView } from "./verify-check";
import { DigilockerCard } from "./digilocker-card";
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

/** The same fingerprint as the one inside the form, for the data as first loaded. */
function fpOf(kind: string, d: OnboardingData): string {
  return kind === "pan" ? `${d.business.pan}|${d.business.kind}|${d.person.name}|${d.business.name}` : kind === "gstin" ? `${d.business.gstin}|${d.business.pan}|${d.business.name}` : kind === "udyam" ? `${d.business.udyam}|${d.business.name}` : `${d.bank.accountNumber}|${d.bank.ifsc}|${d.bank.holder}`;
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

/** Choices to switch on and off, as pills (the way the apply form does it). */
function Pills({ label, options, value, onChange }: { label: string; options: readonly { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2.5">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-1.5 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500",
              on ? "border-emerald-500/60 bg-emerald-500/10 text-theme-primary" : "border-theme-border text-theme-secondary hover:border-theme-muted hover:text-theme-primary",
            )}
          >
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full transition-colors", on ? "bg-emerald-500" : "bg-theme-border")} />
            {o.label}
          </button>
        );
      })}
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
  const [safety, setSafety] = React.useState(false);
  const [signed, setSigned] = React.useState(false);
  const [invites, setInvites] = React.useState<CrewInviteState[]>([]);
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
  const personPatch = (patch: Partial<OnboardingData["person"]>) => set("person", { ...data.person, ...patch });
  const biz = (k: keyof OnboardingData["business"], v: string) => set("business", { ...data.business, [k]: v });
  const bank = (k: keyof OnboardingData["bank"], v: string) => set("bank", { ...data.bank, [k]: v });

  // a file for a newly typed team member needs that person saved first, so the server knows whose it is
  const store = useDocumentStore(base, initialDocuments, { before: saveNow });

  // The partner's own PAN, GST and bank checks: what they have found out so far, and whether checking is set up at all (when it is not, no button is shown).
  const [checks, setChecks] = React.useState<CheckView[]>([]);
  const [checksOn, setChecksOn] = React.useState(false);
  const [checking, setChecking] = React.useState<string | null>(null);
  const [checkError, setCheckError] = React.useState("");
  // What each answer was about (the numbers and names at the time), so an answer is hidden as soon as any of them is changed: it would be for the old number.
  const fingerprint = (kind: string) => fpOf(kind, data);
  const [answeredFor, setAnsweredFor] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    let live = true;
    void call<{ configured: boolean; checks: CheckView[] }>(`${base}/verify`, "GET").then((r) => {
      if (live && r.ok) {
        setChecksOn(r.data.configured);
        setChecks(r.data.checks);
        // an answer the server says is for what is saved is for what is on the page now
        setAnsweredFor(Object.fromEntries(r.data.checks.filter((c) => c.current).map((c) => [c.kind, fpOf(c.kind, latest.current)])));
      }
    });
    return () => {
      live = false;
    };
  }, [base]);
  async function askCheck(kind: "pan" | "gstin" | "udyam" | "bank") {
    setChecking(kind);
    setCheckError("");
    // what is on the page is what is checked: the latest typing is saved first
    if (!(await saveNow())) {
      setChecking(null);
      return setCheckError("Your latest changes couldn't be saved yet. Please try again in a moment.");
    }
    const r = await call<{ configured: boolean; checks: CheckView[]; asked: CheckView[] }>(`${base}/verify`, "POST", { kinds: [kind] });
    setChecking(null);
    if (!r.ok) return setCheckError(r.error);
    setChecksOn(r.data.configured);
    // what was just asked for is shown even when nothing was stored for it (the details were not all there)
    const shownNow = r.data.asked.map((a) => ({ ...a, current: true }));
    setAnsweredFor((f) => ({ ...f, [kind]: fingerprint(kind) }));
    setChecks([...r.data.checks.filter((c) => !shownNow.some((a) => a.kind === c.kind)), ...shownNow]);
  }
  const checkOf = (kind: string) => {
    const c = checks.find((x) => x.kind === kind);
    return c ? { ...c, current: c.current && answeredFor[kind] === fingerprint(kind) } : undefined;
  };
  // What DigiLocker states about the partner, put into the blank fields only (never over what they have typed). One update, so none of the fields overwrites another.
  const fromDigilocker = (i: { name: string; dob: string; gender: string; address: string }) => {
    const p = data.person;
    personPatch({
      ...(!p.name.trim() && i.name ? { name: i.name.slice(0, 200) } : {}),
      ...(!p.dob && i.dob ? { dob: i.dob } : {}),
      ...(!p.gender && i.gender ? { gender: i.gender } : {}),
      ...(!p.permanentAddress.trim() && i.address ? { permanentAddress: i.address.slice(0, 400) } : {}),
    });
  };
  // What the GST register says about the business, offered for the blank fields only (never over what the partner has typed).
  const gstView = checkOf("gstin");
  const gstFill = (() => {
    const f = gstView && gstView.current ? gstView.fill : undefined;
    if (!f) return null;
    const b = data.business;
    const parts: string[] = [];
    if (f.name && !b.name.trim()) parts.push("the business name");
    if (f.address && !b.address.trim()) parts.push("the address");
    if (f.pin && b.pin.length !== 6) parts.push("the PIN code");
    if (f.started && !b.started) parts.push("the year started");
    return parts.length ? { ...f, parts } : null;
  })();
  function fillFromGst(f: NonNullable<typeof gstFill>) {
    const b = data.business;
    // one update for all the blank fields (calling biz() once per field would each start from the same old state and only the last would stick)
    set("business", {
      ...b,
      ...(f.name && !b.name.trim() ? { name: f.name.slice(0, 200) } : {}),
      ...(f.address && !b.address.trim() ? { address: f.address.slice(0, 400) } : {}),
      ...(f.pin && b.pin.length !== 6 ? { pin: f.pin } : {}),
      ...(f.started && !b.started ? { started: f.started } : {}),
    });
  }

  // where each team member's own link stands, whenever the team is on screen
  const loadInvites = React.useCallback(async () => {
    const r = await call<{ invites: CrewInviteState[] }>(`${base}/crew`, "GET");
    if (r.ok) setInvites(r.data.invites);
  }, [base]);
  React.useEffect(() => {
    if (step === "team") void loadInvites();
  }, [step, loadInvites]);

  // The bank and branch an IFSC belongs to are looked up as soon as the code is complete and filled in where the partner has typed nothing; they can always change them.
  const [ifscNote, setIfscNote] = React.useState<{ ok: boolean; text: string } | null>(null);
  const ifsc = data.bank.ifsc;
  React.useEffect(() => {
    if (!isIfsc(ifsc)) return void setIfscNote(null);
    let live = true;
    void call<{ bank: string; branch: string; city: string }>(`/api/partner/ifsc/${ifsc}`, "GET").then((r) => {
      if (!live) return;
      if (!r.ok) return setIfscNote({ ok: false, text: r.error });
      setIfscNote({ ok: true, text: `${r.data.bank}${r.data.branch ? `, ${r.data.branch}` : ""}` });
      const cur = latest.current.bank;
      if (!cur.bankName || !cur.branch) change({ ...latest.current, bank: { ...cur, bankName: cur.bankName || r.data.bank, branch: cur.branch || r.data.branch } });
    });
    return () => {
      live = false;
    };
    // `change` is recreated on every render; the lookup runs only when the code itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ifsc]);

  // ---- what is still missing ----
  const gaps = onboardingGaps(partnerType, data, store.docs);
  const gapsOf = (s: StepId) => gaps.filter((g) => g.section === s);
  const reqs = documentRequirements(partnerType, data);
  const reqsOf = (s: SectionId) => reqs.filter((r) => r.section === s);

  async function send() {
    setSendError("");
    if (gaps.length > 0) return setSendError("A few things are still missing. They are listed above.");
    if (!signed) return setSendError("Please read and sign the partner agreement first.");
    if (!agreed || !safety) return setSendError("Please tick both boxes: that what you sent is true, and that you will follow the safety rules.");
    setSending(true);
    try {
      // what is on the page is what is checked: wait for the last changes to be saved first
      if (!(await saveNow())) return setSendError("Your latest changes couldn't be saved yet. Please try again in a moment.");
      const r = await call<null>(`${base}/submit`, "POST", { declaration: true, safety: true });
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
              {checksOn && <DigilockerCard base={base} onVerified={fromDigilocker} className="sm:col-span-2" />}
              <div className={`${field} sm:col-span-2`}>
                <Label htmlFor="ob-pname">Full name, as on the photo ID</Label>
                <Input id="ob-pname" value={data.person.name} onChange={(e) => person("name", e.target.value)} maxLength={200} autoComplete="name" />
              </div>
              <div className={field}>
                <Label htmlFor="ob-dob">
                  Date of birth
                  <Optional />
                </Label>
                <Input id="ob-dob" type="date" value={data.person.dob} onChange={(e) => person("dob", e.target.value)} max={new Date().toISOString().slice(0, 10)} autoComplete="bday" />
              </div>
              <div className={field}>
                <Label htmlFor="ob-gender">
                  Gender
                  <Optional />
                </Label>
                <Select value={data.person.gender} onValueChange={(v) => person("gender", v)}>
                  <SelectTrigger id="ob-gender">
                    <SelectValue placeholder="Choose one" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Male", "Female", "Other"].map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={`${field} sm:col-span-2`}>
                <Label htmlFor="ob-perm">
                  Permanent address
                  <Optional />
                </Label>
                <Textarea id="ob-perm" value={data.person.permanentAddress} onChange={(e) => person("permanentAddress", e.target.value)} rows={2} maxLength={400} autoComplete="street-address" />
                <p className="text-xs text-theme-muted">As on your ID. Filled in for you when you verify with DigiLocker.</p>
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
              <div className={field}>
                <Label htmlFor="ob-em-name">Someone to call in an emergency</Label>
                <Input id="ob-em-name" value={data.person.emergencyName} onChange={(e) => person("emergencyName", e.target.value)} maxLength={120} placeholder="Name, and how they are related to you" autoComplete="off" />
              </div>
              <div className={field}>
                <Label htmlFor="ob-em-phone">Their phone number</Label>
                <Input id="ob-em-phone" type="tel" value={data.person.emergencyPhone} onChange={(e) => person("emergencyPhone", e.target.value.replace(/[^0-9+ ]/g, "").slice(0, 32))} inputMode="tel" maxLength={32} autoComplete="off" />
              </div>
              <div className="flex items-start gap-3 sm:col-span-2">
                <Checkbox id="ob-cur-same" checked={data.person.currentSame} onCheckedChange={(v) => personPatch({ currentSame: v === true })} className="mt-0.5" />
                <Label htmlFor="ob-cur-same" className="block text-sm font-normal leading-relaxed text-theme-secondary">
                  I live at the address given under {individual ? "Your work details" : "Business details"}
                </Label>
              </div>
              {!data.person.currentSame && (
                <>
                  <div className={`${field} sm:col-span-2`}>
                    <Label htmlFor="ob-cur-address">Your current address</Label>
                    <Textarea id="ob-cur-address" value={data.person.currentAddress} onChange={(e) => person("currentAddress", e.target.value)} rows={2} maxLength={400} />
                  </div>
                  <div className={field}>
                    <Label htmlFor="ob-cur-city">Town or city</Label>
                    <Input id="ob-cur-city" value={data.person.currentCity} onChange={(e) => person("currentCity", e.target.value)} maxLength={100} />
                  </div>
                  <div className={field}>
                    <Label htmlFor="ob-cur-pin">PIN code</Label>
                    <Input id="ob-cur-pin" value={data.person.currentPin} onChange={(e) => person("currentPin", e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} />
                  </div>
                </>
              )}
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
                {checksOn && isGstin(data.business.gstin) && <VerifyCheck label="Check this GST number" view={checkOf("gstin")} ready={isGstin(data.business.gstin)} running={checking === "gstin"} onAsk={() => void askCheck("gstin")} className="pt-1" />}
                {gstFill && (
                  <div className="space-y-1">
                    <Button type="button" size="sm" variant="secondary" onClick={() => fillFromGst(gstFill)}>
                      <Sparkles className="size-4" />
                      Fill my blank details from this registration
                    </Button>
                    <p className="text-xs text-theme-muted">Fills only what is empty: {gstFill.parts.join(", ")}. You can change anything.</p>
                  </div>
                )}
              </div>
              {!individual && (
                <>
                  <div className={field}>
                    <Label htmlFor="ob-udyam">
                      Udyam number
                      <Optional />
                    </Label>
                    <Input id="ob-udyam" value={data.business.udyam} onChange={(e) => biz("udyam", e.target.value.toUpperCase().slice(0, 30))} maxLength={30} placeholder="UDYAM-TN-00-0000000" />
                    {checksOn && isUdyam(data.business.udyam) && <VerifyCheck label="Check this Udyam number" view={checkOf("udyam")} ready={isUdyam(data.business.udyam)} running={checking === "udyam"} onAsk={() => void askCheck("udyam")} className="pt-1" />}
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
            {!individual && (
              <>
                <SubHeading hint="Choose everything your business does. We use it to match you to the right jobs.">What your business does</SubHeading>
                <Pills label="What your business does" options={CAPABILITIES} value={data.business.capabilities} onChange={(v) => set("business", { ...data.business, capabilities: v })} />
                <SubHeading hint="The test equipment you own. Optional, but it helps us place you on jobs that need it.">Test equipment you own</SubHeading>
                <Pills label="Test equipment you own" options={EQUIPMENT} value={data.business.equipment} onChange={(v) => set("business", { ...data.business, equipment: v })} />
              </>
            )}
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
              onAdd={() => set("licences", [...data.licences, { type: "", grade: "", number: "", issuedOn: "", validUntil: "" }])}
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
                      <Label htmlFor={`ob-l-num-${i}`}>{l.type === "pvc" ? "Reference number" : "Number"}</Label>
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
                      <Label htmlFor={`ob-l-issued-${i}`}>
                        Issued on
                        {l.type !== "pvc" && <Optional />}
                      </Label>
                      <Input id={`ob-l-issued-${i}`} type="date" value={l.issuedOn} onChange={(e) => up({ issuedOn: e.target.value })} />
                    </div>
                    <div className={field}>
                      <Label htmlFor={`ob-l-valid-${i}`}>
                        Valid until
                        {!LICENCE_EXPIRES.includes(l.type) && <Optional />}
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
              onAdd={() => set("team", { ...data.team, members: [...data.team.members, { id: crypto.randomUUID(), name: "", role: "", siteRole: "", phone: "", email: "", certificate: "", validUntil: "", needsLicence: true, addedAt: new Date().toISOString() }] })}
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
                      <Label htmlFor={`ob-m-role-${i}`}>What they do on site</Label>
                      <Select
                        value={m.siteRole}
                        onValueChange={(v) => {
                          const r = siteRoleOf(v);
                          if (r) up({ siteRole: r.id, role: r.label, needsLicence: r.needsLicence });
                        }}
                      >
                        <SelectTrigger id={`ob-m-role-${i}`}>
                          <SelectValue placeholder={m.role || "Choose a role"} />
                        </SelectTrigger>
                        <SelectContent>
                          {SITE_ROLES.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={field}>
                      <Label htmlFor={`ob-m-phone-${i}`}>
                        Mobile number
                        <Optional />
                      </Label>
                      <Input id={`ob-m-phone-${i}`} type="tel" value={m.phone} onChange={(e) => up({ phone: e.target.value.replace(/[^0-9+ ]/g, "").slice(0, 32) })} inputMode="tel" maxLength={32} />
                    </div>
                    <div className={`${field} sm:col-span-2`}>
                      <Label htmlFor={`ob-m-email-${i}`}>
                        E-mail
                        <Optional />
                      </Label>
                      <Input id={`ob-m-email-${i}`} type="email" value={m.email} onChange={(e) => up({ email: e.target.value })} maxLength={200} />
                    </div>
                    {m.needsLicence && (
                      <>
                        <div className={field}>
                          <Label htmlFor={`ob-m-cert-${i}`}>{m.siteRole === "supervisor" ? "Permit number" : "Licence or certificate number"}</Label>
                          <Input id={`ob-m-cert-${i}`} value={m.certificate} onChange={(e) => up({ certificate: e.target.value })} maxLength={120} />
                        </div>
                        <div className={field}>
                          <Label htmlFor={`ob-m-valid-${i}`}>
                            Valid until
                            {m.siteRole !== "supervisor" && m.siteRole !== "wireman" && <Optional />}
                          </Label>
                          <Input id={`ob-m-valid-${i}`} type="date" value={m.validUntil} onChange={(e) => up({ validUntil: e.target.value })} />
                        </div>
                      </>
                    )}
                    {m.name && <CrewLink base={base} memberId={memberKey(m, i)} name={m.name} email={m.email} phone={m.phone} invite={invites.find((x) => x.memberId === memberKey(m, i))} onSent={() => void loadInvites()} beforeSend={saveNow} />}
                    <div className="space-y-3 sm:col-span-2">
                      {m.name ? (
                        memberRequirements(m.needsLicence, m.siteRole).map((r) => (
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
            <p className="mb-7 mt-2 text-sm leading-relaxed text-theme-secondary">
              {individual ? "Nothing here is required, but photos of finished work and a few projects we can ask about make verifying you much quicker." : "How many projects you have done, and at least one we can ask about. Photos of finished work make verifying you much quicker."}
            </p>
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
              <div className={field}>
                <Label htmlFor="ob-installs">
                  {partnerType === "survey" ? "Surveys completed so far" : "Projects completed so far"}
                  {individual && <Optional />}
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
              onAdd={() => set("work", { ...data.work, projects: [...data.work.projects, { title: "", place: "", size: "", year: "", note: "", clientType: "", specs: "" }] })}
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
                      <Label htmlFor={`ob-p-client-${i}`}>
                        Customer
                        {individual && <Optional />}
                      </Label>
                      <Select value={p.clientType} onValueChange={(v) => up({ clientType: v })}>
                        <SelectTrigger id={`ob-p-client-${i}`}>
                          <SelectValue placeholder="Choose one" />
                        </SelectTrigger>
                        <SelectContent>
                          {CLIENT_TYPES.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={field}>
                      <Label htmlFor={`ob-p-specs-${i}`}>
                        What was installed
                        <Optional />
                      </Label>
                      <Input id={`ob-p-specs-${i}`} value={p.specs} onChange={(e) => up({ specs: e.target.value })} maxLength={200} placeholder="12 panels, 5 kW inverter" />
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
                {checksOn && <VerifyCheck label="Check my PAN" view={checkOf("pan")} ready={isPan(data.business.pan)} running={checking === "pan"} onAsk={() => void askCheck("pan")} className="pt-1" />}
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
                {ifscNote && (
                  <p role="status" className={cn("text-xs", ifscNote.ok ? "text-emerald-700 dark:text-emerald-300" : "text-theme-muted")}>
                    {ifscNote.text}
                  </p>
                )}
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
            {checksOn && (
              <div className="mt-6 max-w-xl space-y-2">
                <VerifyCheck label="Check my bank account" view={checkOf("bank")} ready={isAccountNumber(data.bank.accountNumber) && isIfsc(data.bank.ifsc) && data.bank.holder.trim().length > 0} running={checking === "bank"} onAsk={() => void askCheck("bank")} />
                <p className="text-xs leading-relaxed text-theme-muted">This asks the bank whether the account exists and whether the name on it matches the name you gave. Your bank may show a very small test credit. You do not have to do anything about it.</p>
              </div>
            )}
            {checkError && (
              <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
                {checkError}
              </p>
            )}
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

            <AgreementCard base={base} partnerType={partnerType} email={contact.email} onSigned={setSigned} />

            <div className="mt-8 flex items-start gap-3">
              <Checkbox id="ob-agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
              <Label htmlFor="ob-agree" className="block max-w-xl text-sm font-normal leading-relaxed text-theme-secondary">
                I confirm that what I have told you and the documents I have sent are true and are mine to send, that the people I listed agreed to my sending their documents, and that you may check all of it with the authorities that issued them.
              </Label>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <Checkbox id="ob-safety" checked={safety} onCheckedChange={(v) => setSafety(v === true)} className="mt-0.5" />
              <Label htmlFor="ob-safety" className="block max-w-xl text-sm font-normal leading-relaxed text-theme-secondary">
                I will follow the electrical safety regulations, the standards of the electricity distribution company, and the rules on safety gear that apply to the work I do for WayTara.
              </Label>
            </div>
            {sendError && (
              <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
                {sendError}
              </p>
            )}
            <Button type="button" onClick={() => void send()} disabled={sending || gaps.length > 0 || !signed} className="mt-6">
              {sending && <Loader2 className="size-4 animate-spin" />}
              {sending ? "Sending…" : "Send for verification"}
            </Button>
            {(gaps.length > 0 || !signed) && <p className="mt-2 text-xs text-theme-muted">You can send once the parts above are complete{signed ? "" : " and the partner agreement is signed"}.</p>}
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
