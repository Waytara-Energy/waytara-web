"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormPart } from "@/components/pages/form-part";
import { TN_DISTRICTS } from "@/lib/partner-network";
import {
  BUSINESS_KINDS,
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABEL,
  DOCUMENT_MAX_FILES,
  LICENCE_TYPES,
  ONBOARDING_LIMITS,
  documentProblem,
  onboardingGaps,
  type Gap,
  type OnboardingData,
  type OnboardingDocument,
} from "@waytara/supabase/partner-onboarding";

const DISTRICT_OPTIONS: MultiSelectOption[] = TN_DISTRICTS.map((d) => ({ value: d, label: d }));
const field = "space-y-2";
const Optional = () => <span className="font-normal text-theme-muted"> (optional)</span>;
const sizeLabel = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

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

/**
 * The onboarding page of a shortlisted partner applicant: their business, licences, team, areas and past work, and their documents. It saves as they type (a draft,
 * nothing has to be complete), takes files straight to private storage, and lets them send it for verification once what we truly need is there. Everything goes
 * through the website's own routes under /api/partner/track/<link>, which check the link first.
 */
export function OnboardingForm({ token, partnerType, initial, initialDocuments, submittedAt }: { token: string; partnerType: string | null; initial: OnboardingData; initialDocuments: OnboardingDocument[]; submittedAt: string | null }) {
  const router = useRouter();
  const base = `/api/partner/track/${token}`;
  const person = partnerType === "technician";
  const [data, setData] = React.useState<OnboardingData>(initial);
  const [docs, setDocs] = React.useState<OnboardingDocument[]>(initialDocuments);
  const [save, setSave] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [docError, setDocError] = React.useState("");
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [agreed, setAgreed] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState("");
  const [sent, setSent] = React.useState(Boolean(submittedAt));
  const [showGaps, setShowGaps] = React.useState(false);

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
  const biz = (k: keyof OnboardingData["business"], v: string) => set("business", { ...data.business, [k]: v });

  // ---- documents ----
  async function addFile(kind: string, file: File) {
    setDocError("");
    const problem = documentProblem(file.name, file.size);
    if (problem) return setDocError(`${file.name}: ${problem}`);
    setUploading(kind);
    try {
      const start = await call<{ path: string; uploadUrl: string }>(`${base}/upload`, "POST", { kind, name: file.name, size: file.size });
      if (!start.ok) return setDocError(`${file.name}: ${start.error}`);
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      let put: Response | null = null;
      try {
        put = await fetch(start.data.uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } });
      } catch {
        put = null;
      }
      if (!put?.ok) return setDocError(`${file.name} didn't upload. Please check your connection and try again.`);
      const done = await call<OnboardingDocument>(`${base}/documents`, "POST", { kind, name: file.name, path: start.data.path });
      if (!done.ok) return setDocError(`${file.name}: ${done.error}`);
      setDocs((d) => [...d, done.data]);
    } finally {
      setUploading(null);
    }
  }
  async function removeFile(id: string) {
    setDocError("");
    const r = await call<null>(`${base}/documents/${id}`, "DELETE");
    if (r.ok) setDocs((d) => d.filter((x) => x.id !== id));
    else setDocError(r.error);
  }

  // ---- sending ----
  const gaps = onboardingGaps(partnerType, data, docs.map((d) => d.kind));
  async function send() {
    setSendError("");
    setShowGaps(true);
    if (gaps.length > 0) return setSendError("A few things are still missing. They are listed below.");
    if (!agreed) return setSendError("Please tick the box to confirm that what you sent is true.");
    setSending(true);
    try {
      // what is on the page is what is checked: wait for the last changes to be saved first
      if (!(await saveNow())) return setSendError("Your latest changes couldn't be saved yet. Please try again in a moment.");
      const r = await call<null>(`${base}/submit`, "POST", { declaration: true });
      if (r.ok) {
        setSent(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        // the application is now at Verification: reload the page's own words (headline, steps) from the server
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

  const gapsFor = (s: Gap["section"]) => (showGaps ? gaps.filter((g) => g.section === s) : []);
  const missing = (s: Gap["section"]) =>
    gapsFor(s).length > 0 ? (
      <ul className="mb-5 space-y-1 text-sm text-red-600 dark:text-red-400" role="alert">
        {gapsFor(s).map((g) => (
          <li key={g.text}>Still needed: {g.text}</li>
        ))}
      </ul>
    ) : null;

  return (
    <div className="mt-10 max-w-2xl">
      <p className="sticky top-0 z-10 -mx-1 mb-6 bg-theme-bg/90 px-1 py-2 text-xs text-theme-muted backdrop-blur" role="status" aria-live="polite">
        {save === "saving" && "Saving…"}
        {save === "saved" && "All changes saved"}
        {save === "error" && "Couldn't save. We will try again; your changes are still on this page."}
        {save === "idle" && "We save as you type."}
      </p>

      <div id="onb-business" className="scroll-mt-16">
        <FormPart n={1} title={person ? "About you" : "Your business"}>
          {missing("business")}
          <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
            <div className={`${field} sm:col-span-2`}>
              <Label htmlFor="ob-name">{person ? "Your name as on your certificate" : "Business name"}</Label>
              <Input id="ob-name" value={data.business.name} onChange={(e) => biz("name", e.target.value)} maxLength={200} autoComplete="organization" />
            </div>
            <div className={field}>
              <Label htmlFor="ob-kind">
                {person ? "How you work" : "Kind of business"}
                <Optional />
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
              <Label htmlFor="ob-address">
                Address
                <Optional />
              </Label>
              <Textarea id="ob-address" value={data.business.address} onChange={(e) => biz("address", e.target.value)} rows={2} maxLength={400} autoComplete="street-address" />
            </div>
            <div className={field}>
              <Label htmlFor="ob-city">Town or city</Label>
              <Input id="ob-city" value={data.business.city} onChange={(e) => biz("city", e.target.value)} maxLength={100} autoComplete="address-level2" />
            </div>
            <div className={field}>
              <Label htmlFor="ob-pin">
                PIN code
                <Optional />
              </Label>
              <Input id="ob-pin" value={data.business.pin} onChange={(e) => biz("pin", e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} autoComplete="postal-code" />
            </div>
            {!person && (
              <>
                <div className={field}>
                  <Label htmlFor="ob-gstin">
                    GSTIN
                    <Optional />
                  </Label>
                  <Input id="ob-gstin" value={data.business.gstin} onChange={(e) => biz("gstin", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))} maxLength={15} />
                </div>
                <div className={field}>
                  <Label htmlFor="ob-web">
                    Website
                    <Optional />
                  </Label>
                  <Input id="ob-web" value={data.business.website} onChange={(e) => biz("website", e.target.value)} maxLength={300} inputMode="url" />
                </div>
              </>
            )}
          </div>
        </FormPart>
      </div>

      <div id="onb-licences" className="scroll-mt-16">
        <FormPart n={2} title="Licences and certificates" hint={partnerType === "contractor" || person ? "At least one" : "If you hold any"}>
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
        </FormPart>
      </div>

      <FormPart n={3} title="Your team">
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
        <p className="mb-3 mt-7 text-sm font-medium text-theme-primary">
          Key people <span className="font-normal text-theme-muted">(optional)</span>
        </p>
        <Rows
          items={data.team.members}
          max={ONBOARDING_LIMITS.members}
          addLabel="Add a person"
          onAdd={() => set("team", { ...data.team, members: [...data.team.members, { name: "", role: "", certificate: "" }] })}
          onRemove={(i) => set("team", { ...data.team, members: data.team.members.filter((_, j) => j !== i) })}
        >
          {(m, i) => {
            const up = (patch: Partial<typeof m>) => set("team", { ...data.team, members: data.team.members.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                <div className={field}>
                  <Label htmlFor={`ob-m-name-${i}`}>Name</Label>
                  <Input id={`ob-m-name-${i}`} value={m.name} onChange={(e) => up({ name: e.target.value })} maxLength={120} />
                </div>
                <div className={field}>
                  <Label htmlFor={`ob-m-role-${i}`}>Role</Label>
                  <Input id={`ob-m-role-${i}`} value={m.role} onChange={(e) => up({ role: e.target.value })} maxLength={80} placeholder="Supervisor, electrician…" />
                </div>
                <div className={`${field} sm:col-span-2`}>
                  <Label htmlFor={`ob-m-cert-${i}`}>
                    Licence or certificate number
                    <Optional />
                  </Label>
                  <Input id={`ob-m-cert-${i}`} value={m.certificate} onChange={(e) => up({ certificate: e.target.value })} maxLength={120} />
                </div>
              </div>
            );
          }}
        </Rows>
      </FormPart>

      <div id="onb-areas" className="scroll-mt-16">
        <FormPart n={4} title="Where you work">
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
        </FormPart>
      </div>

      <FormPart n={5} title="Your past work">
        <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
          <div className={field}>
            <Label htmlFor="ob-installs">
              Installations completed so far
              <Optional />
            </Label>
            <Input id="ob-installs" value={data.work.installs} onChange={(e) => set("work", { ...data.work, installs: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} />
          </div>
          <div className={field}>
            <Label htmlFor="ob-largest">
              Largest system, in kW
              <Optional />
            </Label>
            <Input id="ob-largest" value={data.work.largest} onChange={(e) => set("work", { ...data.work, largest: e.target.value.replace(/[^0-9.]/g, "").slice(0, 8) })} inputMode="decimal" maxLength={8} />
          </div>
          <div className={`${field} sm:col-span-2`}>
            <Label htmlFor="ob-summary">
              Tell us about the work you do
              <Optional />
            </Label>
            <Textarea id="ob-summary" value={data.work.summary} onChange={(e) => set("work", { ...data.work, summary: e.target.value })} rows={4} maxLength={1500} />
          </div>
        </div>
        <p className="mb-3 mt-7 text-sm font-medium text-theme-primary">
          Projects we can ask you about <span className="font-normal text-theme-muted">(optional)</span>
        </p>
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
      </FormPart>

      <div id="onb-documents" className="scroll-mt-16">
        <FormPart n={6} title="Your documents" hint="PDF, JPG, PNG or WebP, up to 10 MB each">
          {missing("documents")}
          <p className="mb-6 max-w-xl text-sm leading-relaxed text-theme-secondary">
            We use these only to verify your application. Nobody outside the WayTara team sees them, and we do not share them. Once sent, a file cannot be opened from this page, but you can remove it and send another.
          </p>
          <div className="divide-y divide-theme-border border-y border-theme-border">
            {DOCUMENT_KINDS.map((k) => {
              const mine = docs.filter((d) => d.kind === k.id);
              return (
                <div key={k.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="text-[15px] font-medium text-theme-primary">{k.label}</p>
                      <p className="mt-0.5 text-sm text-theme-muted">{k.hint}</p>
                    </div>
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                        className="sr-only peer"
                        disabled={uploading !== null || docs.length >= DOCUMENT_MAX_FILES}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) void addFile(k.id, f);
                        }}
                      />
                      <span className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-theme-border px-3 text-sm font-medium text-theme-primary transition-colors hover:bg-theme-surface peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                        {uploading === k.id ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        {uploading === k.id ? "Sending…" : "Add a file"}
                      </span>
                    </label>
                  </div>
                  {mine.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {mine.map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-theme-secondary">
                            {d.name} <span className="text-theme-muted">· {sizeLabel(d.size)}</span>
                          </span>
                          <button type="button" onClick={() => void removeFile(d.id)} className="shrink-0 text-theme-muted underline underline-offset-4 outline-none hover:text-theme-primary focus-visible:ring-2 focus-visible:ring-emerald-500">
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          {docError && (
            <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
              {docError}
            </p>
          )}
          {docs.length > 0 && <p className="mt-3 text-xs text-theme-muted">{docs.length} file{docs.length === 1 ? "" : "s"} sent: {Array.from(new Set(docs.map((d) => DOCUMENT_KIND_LABEL[d.kind] ?? d.kind))).join(", ")}.</p>}
        </FormPart>
      </div>

      <div className="border-t border-theme-border pt-9">
        <h3 className="text-lg font-bold tracking-tight text-theme-primary sm:text-xl">Send it to us</h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-theme-secondary">When you send it, we start verifying. You will not be able to change it after that, but you can write to us if something needs correcting.</p>
        <div className="mt-5 flex items-start gap-3">
          <Checkbox id="ob-agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
          <Label htmlFor="ob-agree" className="block max-w-xl text-sm font-normal leading-relaxed text-theme-secondary">
            I confirm that what I have told you and the documents I have sent are true and are mine to send, and that you may check them with the authorities that issued them.
          </Label>
        </div>
        {sendError && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {sendError}
          </p>
        )}
        <Button type="button" onClick={() => void send()} disabled={sending} className="mt-6">
          {sending && <Loader2 className="size-4 animate-spin" />}
          {sending ? "Sending…" : "Send for verification"}
        </Button>
      </div>
    </div>
  );
}
