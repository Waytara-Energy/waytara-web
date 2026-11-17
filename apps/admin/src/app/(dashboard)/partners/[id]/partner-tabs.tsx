import { Mail, Phone, UserRound } from "lucide-react";
import { ActionForm } from "@waytara/ui/action-form";
import {
  ACCOUNT_TYPES,
  BUSINESS_KINDS,
  CAPABILITIES,
  EQUIPMENT,
  LICENCE_TYPES,
  categorySubject,
  documentRequirements,
  emptyOnboarding,
  maskAccount,
  memberKey,
  memberRequirements,
  siteRoleOf,
  workCategories,
  type OnboardingData,
  type SectionId,
} from "@waytara/supabase/partner-onboarding";
import { licenceStatus, todayIst } from "@waytara/supabase/partner-account";
import { CHECKS, MEMBER_CHECKS, checklistFor, memberChecklist, memberStatus, memberSubject, screeningChecklist, type CheckKey } from "@waytara/supabase/partner-verification";
import type { VerificationData } from "@/lib/partner-verification-data";
import { PARTNER_SERVICE_LABEL, PARTNER_TYPE_LABEL, readAnswers } from "@/lib/partners";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { logScreeningCall } from "./actions";
import { BankReveal } from "./bank-reveal";
import { AutoChecks, DocList, DocSlots, Fact, StateBadge, VerifyRow, type DocSlot, type PartnerDoc } from "./partner-ui";
import { ScreeningChecklist, type ScreeningSaved } from "./screening-checklist";

export interface AppView {
  id: string;
  status: string;
  partner_type: string | null;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  website: string | null;
  reference: string | null;
  created_at: string;
  answers: unknown;
  message: string | null;
  services: string[];
  cities: string | null;
  /** "Active", "Suspended", "Not created yet" or empty (not approved), and who last updated the application and when: for the Lead details tab. */
  account_note: string;
  last_updated: string;
  /** When they proved the e-mail address with the code and made their account, or empty. */
  email_confirmed: string;
}

export interface CallRow {
  id: string;
  called_at: string;
  outcome: string;
  notes: string | null;
  next_step: string | null;
  caller: string | null;
}

const OUTCOME: Record<string, string> = { reached: "Reached", no_answer: "No answer", call_back: "Call back later", wrong_number: "Wrong number" };
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/** The partner's own check of this kind, as a row to set (nothing for a kind of partner that is not checked on it). */
function Check({ app, v, k }: { app: AppView; v: VerificationData; k: CheckKey }) {
  if (!checklistFor(app.partner_type).some((c) => c.key === k)) return null;
  const def = CHECKS.find((c) => c.key === k)!;
  return <VerifyRow appId={app.id} subject="partner" itemKey={k} label={def.label} hint={def.hint} state={v.states[k] ?? "pending"} note={v.rows[k]?.note ?? null} checkedAt={v.rows[k]?.checked_at ?? null} />;
}

/** The documents asked of this partner in one part of the onboarding, as slots for the admin's page. */
function slotsOf(app: AppView, data: OnboardingData | null, section: SectionId, only?: readonly string[]): DocSlot[] {
  return documentRequirements(app.partner_type, data ?? emptyOnboarding())
    .filter((r) => r.section === section && (!only || only.includes(r.kind)))
    .map((r) => ({ kind: r.kind, label: r.label, need: r.need, basis: r.basis, anyOf: r.anyOf }));
}
/** A better copy can be asked for only while the partner can still act on it. */
const canAsk = (app: AppView) => app.status === "verification" || app.status === "onboarding";
const notYet = (data: OnboardingData | null) => (data ? undefined : "They have not started their onboarding yet. This is what they will be asked for.");

export function LeadTab({ app }: { app: AppView }) {
  const answers = readAnswers(app.answers);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Contact" description="Who to call and write to.">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Contact person">
              <span className="inline-flex items-center gap-2">
                <UserRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {app.contact_name}
              </span>
            </Fact>
            <Fact label="Phone">
              <a href={`tel:${app.phone}`} className="inline-flex items-center gap-2 hover:underline">
                <Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {app.phone}
              </a>
            </Fact>
            <Fact label="E-mail" wide>
              <a href={`mailto:${app.email}`} className="inline-flex items-center gap-2 break-all hover:underline">
                <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {app.email}
              </a>
            </Fact>
            <Fact label="Website" wide>
              {app.website}
            </Fact>
          </dl>
        </Section>

        <Section title="The application" description="From the short form on the Partner page.">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Applying as">{PARTNER_TYPE_LABEL[app.partner_type ?? ""] ?? ""}</Fact>
            <Fact label="Reference">{app.reference}</Fact>
            <Fact label="Applied">{when(app.created_at)}</Fact>
            <Fact label="Where">{app.cities}</Fact>
            <Fact label="Partner account">{app.account_note}</Fact>
            <Fact label="Last updated by">{app.last_updated}</Fact>
            <Fact label="Services" wide>
              {app.services.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {app.services.map((s) => (
                    <Badge key={s} variant="secondary">
                      {PARTNER_SERVICE_LABEL[s] ?? s}
                    </Badge>
                  ))}
                </span>
              ) : (
                ""
              )}
            </Fact>
          </dl>
        </Section>
      </div>

      <Section title="Their answers" description="What they told us about their work when they applied.">
        <dl className="grid gap-4 sm:grid-cols-2">
          {answers.map((x) => (
            <Fact key={x.q} label={x.q}>
              {x.a}
            </Fact>
          ))}
          <Fact label="Their message" wide>
            {app.message}
          </Fact>
        </dl>
      </Section>
    </div>
  );
}

export function ScreeningTab({ app, v, calls, setBy }: { app: AppView; v: VerificationData; calls: CallRow[]; setBy: Record<string, string> }) {
  const items = screeningChecklist(app.partner_type);
  const saved: Record<string, ScreeningSaved> = Object.fromEntries(items.map((i) => [i.key, { ticked: v.screening[i.key] === "verified", note: v.screeningRows[i.key]?.note ?? "", by: setBy[i.key] ?? "" }]));
  const before = app.status === "new" || app.status === "in_review" || app.status === "shortlisted";
  return (
    <div className="space-y-4">
      <Section
        title="Screening checklist"
        description={`Call ${app.contact_name} on ${app.phone} and confirm each of these. When the required ones are ticked and saved, send the onboarding link: it goes to ${app.email}, and a code sent to that address opens it.`}
      >
        <ScreeningChecklist appId={app.id} items={items} saved={saved} canSend={before} sendHint={`Moves the application to Onboarding and e-mails the link to ${app.email}.`} />
        {!before && <p className="text-xs text-muted-foreground">The onboarding link has been sent. The checklist can still be corrected.</p>}
      </Section>

      <Section title="Log a call" description="Note what you found out on each call. Entries are kept as they are: correct a mistake with another entry.">
        <ActionForm key={calls.length} action={logScreeningCall.bind(null, app.id)} loading="Saving…" success="Call logged." className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="grid gap-1.5">
              <Label>What came of it</Label>
              <Select name="outcome" defaultValue="reached">
                <SelectTrigger className="w-full" aria-label="What came of the call">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OUTCOME).map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="next_step">Next step</Label>
              <Input id="next_step" name="next_step" maxLength={300} placeholder="For example: send the onboarding link, call again on Friday" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="call-notes">Notes from the call</Label>
            <Textarea id="call-notes" name="notes" rows={4} maxLength={2000} placeholder="What their work is, their licences, their team, what they want from us…" />
          </div>
          <Button type="submit" size="sm">
            Log the call
          </Button>
        </ActionForm>
      </Section>

      <Section title={`Calls so far (${calls.length})`}>
        {calls.length === 0 ? (
          <p className="text-sm text-muted-foreground">No call has been logged yet.</p>
        ) : (
          <ol className="space-y-3">
            {calls.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={c.outcome === "reached" ? "default" : "secondary"}>{OUTCOME[c.outcome] ?? c.outcome}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {c.caller ?? "A former admin"} · {when(c.called_at)}
                  </span>
                </div>
                {c.notes && <p className="mt-2 whitespace-pre-wrap">{c.notes}</p>}
                {c.next_step && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Next:</span> {c.next_step}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

export function PersonalTab({ app, v, data, docs }: { app: AppView; v: VerificationData; data: OnboardingData | null; docs: PartnerDoc[] }) {
  return (
    <div className="space-y-4">
      <Section title="Personal details" description={notYet(data)}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Name on the photo ID">{data?.person.name || app.contact_name}</Fact>
          <Fact label="Role in the business">{data?.person.designation}</Fact>
          <Fact label="Phone">
            <a href={`tel:${app.phone}`} className="hover:underline">
              {app.phone}
            </a>
          </Fact>
          <Fact label="Another phone">{data?.person.altPhone}</Fact>
          <Fact label="Emergency contact">{data?.person.emergencyName ? `${data.person.emergencyName}${data.person.emergencyPhone ? ` · ${data.person.emergencyPhone}` : ""}` : ""}</Fact>
          <Fact label="Lives at">{data ? (data.person.currentSame ? "The address under Business details" : [data.person.currentAddress, data.person.currentCity, data.person.currentPin].filter(Boolean).join(", ")) : ""}</Fact>
          <Fact label="E-mail">
            <a href={`mailto:${app.email}`} className="break-all hover:underline">
              {app.email}
            </a>
          </Fact>
          <Fact label="E-mail confirmed by code">{app.email_confirmed}</Fact>
        </dl>
      </Section>
      <Section title="Identity documents">
        <DocSlots appId={app.id} slots={slotsOf(app, data, "personal")} docs={docs} canAsk={canAsk(app)} restKinds={["identity", "selfie", "photo", "police_verification", "driving_licence"]} />
      </Section>
      <Section title="Partner agreement" description={v.agreements.length === 0 ? "Not signed yet. The partner signs it with an e-mail code on the last page of their onboarding, and cannot send the application before." : "Accepted with a code e-mailed to the address we confirmed. The fingerprint is of the exact text that was shown."}>
        {v.agreements.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {v.agreements.map((a) => (
              <li key={a.version} className="space-y-0.5 px-3 py-2">
                <p className="font-medium">
                  Version {a.version} <span className="font-normal text-muted-foreground">· signed {new Date(a.signed_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.signer_name} · {a.signer_email}
                  {a.signer_ip ? ` · from ${a.signer_ip}` : ""} · fingerprint <span className="font-mono">{a.text_hash.slice(0, 16)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Automatic checks" description="The selfie against the photo on the ID, and whether the selfie is a live face. Evidence for your own check below, never the decision.">
        <AutoChecks appId={app.id} subject="partner" kinds={["face_match", "face_liveness"]} results={v.checks} on={v.autoOn} env={v.autoEnv} accept={{ face_match: { label: "Identity", state: v.states.identity ?? "pending" } }} all />
      </Section>
      <Section title="Verification">
        <Check app={app} v={v} k="identity" />
      </Section>
    </div>
  );
}

export function BusinessTab({ app, v, data, docs }: { app: AppView; v: VerificationData; data: OnboardingData | null; docs: PartnerDoc[] }) {
  const b = data?.business;
  return (
    <div className="space-y-4">
      <Section title="Business details" description={notYet(data)}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Business name">{b?.name || app.company_name}</Fact>
          <Fact label="Kind of business">{BUSINESS_KINDS.find((k) => k.id === b?.kind)?.label ?? b?.kind}</Fact>
          <Fact label="Started">{b?.started}</Fact>
          <Fact label="GST number">{b?.gstin ? <span className="font-mono">{b.gstin}</span> : data ? "Not registered (none given)" : ""}</Fact>
          <Fact label="Udyam number">{b?.udyam}</Fact>
          <Fact label="Website">{b?.website}</Fact>
          <Fact label="Address" wide>
            {[b?.address, b?.city, b?.pin].filter(Boolean).join(", ")}
          </Fact>
          <Fact label="What the business does" wide>
            {b?.capabilities.map((id) => CAPABILITIES.find((c) => c.id === id)?.label ?? id).join(", ")}
          </Fact>
          <Fact label="Test equipment owned" wide>
            {b?.equipment.map((id) => EQUIPMENT.find((c) => c.id === id)?.label ?? id).join(", ")}
          </Fact>
          <Fact label="Districts">{data?.areas.districts.join(", ")}</Fact>
          <Fact label="Jobs a month">{data?.areas.capacity}</Fact>
        </dl>
      </Section>
      <Section title="Business documents" description="What a business of this kind is asked for, and why.">
        <DocSlots appId={app.id} slots={slotsOf(app, data, "business")} docs={docs} canAsk={canAsk(app)} restKinds={["other"]} />
      </Section>
      {data?.business.gstin && (
        <Section title="Automatic check" description="Whether the GST number is active, whose it is, and that it is built on the PAN they gave. The registration document itself is still yours to look at.">
          <AutoChecks appId={app.id} subject="partner" kinds={["gstin"]} results={v.checks} on={v.autoOn} env={v.autoEnv} />
        </Section>
      )}
      {checklistFor(app.partner_type).some((c) => c.key === "registration") && (
        <Section title="Verification">
          <Check app={app} v={v} k="registration" />
        </Section>
      )}
    </div>
  );
}

export function TeamTab({ app, v, data, docs }: { app: AppView; v: VerificationData; data: OnboardingData | null; docs: PartnerDoc[] }) {
  const members = data?.team.members ?? [];
  return (
    <div className="space-y-4">
      <Section
        title="Team"
        description={
          members.length === 0
            ? "No team members were added. Nothing here needs verifying. If they add people later, each one is verified here before they count as part of the team."
            : "Everyone added to the team is verified on their own: identity, and their licence or certificate where their work needs one. All of them must be verified before the partner can be approved."
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="People who work with them">{data?.team.size}</Fact>
          <Fact label="Holding a licence or certificate">{data?.team.certified}</Fact>
        </dl>
      </Section>

      {members.map((m, i) => {
        const key = memberKey(m, i);
        const ref = { key, name: m.name, needsLicence: m.needsLicence };
        const status = memberStatus(ref, v.memberStates);
        return (
          <Card key={key} className="gap-4 shadow-none">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-sm">{m.name || `Team member ${i + 1}`}</CardTitle>
                  <CardDescription className="text-xs">
                    {siteRoleOf(m.siteRole)?.label ?? (m.role || "No role given")} · {m.needsLicence ? "Needs a licence or certificate" : "No licence needed"}
                    {m.certificate ? ` · No. ${m.certificate}` : ""}
                    {m.validUntil ? ` · valid until ${m.validUntil}` : ""}
                    {m.phone ? ` · ${m.phone}` : ""}
                    {m.email ? ` · ${m.email}` : ""}
                    {v.invites[key] ? ` · their link: ${v.invites[key].expired ? "expired" : v.invites[key].status === "completed" ? "finished" : v.invites[key].status === "opened" ? "opened" : "sent, not opened"}` : ""}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {app.status === "approved" && status !== "verified" && <Badge variant="secondary">Added after approval</Badge>}
                  <StateBadge state={status} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <AutoChecks appId={app.id} subject={memberSubject(key)} kinds={["face_match", "face_liveness"]} results={v.checks} on={v.autoOn} env={v.autoEnv} accept={{ face_match: { label: "Identity", state: v.memberStates[key]?.member_identity ?? "pending" } }} />
              <DocSlots appId={app.id} subject={memberSubject(key)} slots={memberRequirements(m.needsLicence, m.siteRole).map((r) => ({ kind: r.kind, label: r.label, need: r.need, anyOf: r.anyOf }))} docs={docs} canAsk={canAsk(app)} restKinds="all" />
              {memberChecklist(m.needsLicence).map((c) => {
                const def = MEMBER_CHECKS.find((x) => x.key === c.key)!;
                return <VerifyRow key={c.key} appId={app.id} subject={memberSubject(key)} itemKey={c.key} label={def.label} hint={def.hint} state={v.memberStates[key]?.[c.key] ?? "pending"} note={v.memberRows[key]?.[c.key]?.note ?? null} checkedAt={v.memberRows[key]?.[c.key]?.checked_at ?? null} />;
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function LegalTab({ app, v, data, docs }: { app: AppView; v: VerificationData; data: OnboardingData | null; docs: PartnerDoc[] }) {
  const today = todayIst();
  const licences = data?.licences ?? [];
  return (
    <div className="space-y-4">
      <Section title="Licences and certificates" description={licences.length === 0 ? (data ? "No licence has been entered." : notYet(data)) : undefined}>
        {licences.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {licences.map((l, i) => {
              const s = licenceStatus(l.validUntil, today);
              return (
                <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
                  <span>
                    {LICENCE_TYPES.find((t) => t.id === l.type)?.label.split(" (")[0] ?? "Licence"} · <span className="font-mono">{l.number || "no number"}</span>
                    {l.grade ? ` · class ${l.grade}` : ""}
                    {l.issuedOn ? ` · issued ${l.issuedOn}` : ""}
                  </span>
                  <span className={s.state === "expired" ? "font-medium text-destructive" : s.state === "soon" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                    {l.validUntil ? `${s.state === "expired" ? "Expired" : "Valid until"} ${l.validUntil}` : "No date given"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <Section title="Copies" description="What this kind of partner is asked for, and why.">
        <DocSlots appId={app.id} slots={slotsOf(app, data, "licences")} docs={docs} canAsk={canAsk(app)} restKinds={["licence", "supervisor_permit", "contractor_tieup", "certificate", "trade_certificate", "discom_registration", "training_certificate", "drone_certificate"]} />
      </Section>
      {checklistFor(app.partner_type).some((c) => c.key === "licence") && (
        <Section title="Verification" description="Check the licence with the authority that issued it.">
          <Check app={app} v={v} k="licence" />
        </Section>
      )}
    </div>
  );
}

export function KycTab({ app, v, data, docs }: { app: AppView; v: VerificationData; data: OnboardingData | null; docs: PartnerDoc[] }) {
  return (
    <div className="space-y-4">
      <Section title="KYC" description={notYet(data) ?? "We never ask for an Aadhaar number. An Aadhaar copy, if they sent one, must show only the last four digits."}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="PAN">{data?.business.pan ? <span className="font-mono">{data.business.pan}</span> : ""}</Fact>
          <Fact label="GST number">{data?.business.gstin ? <span className="font-mono">{data.business.gstin}</span> : ""}</Fact>
        </dl>
      </Section>
      <Section title="KYC documents">
        <DocSlots appId={app.id} slots={slotsOf(app, data, "bank", ["pan", "kyc"])} docs={docs} canAsk={canAsk(app)} />
      </Section>
      <Section title="Automatic check" description="Whether the PAN is valid and active, and the name it is registered to against the name we expect.">
        <AutoChecks appId={app.id} subject="partner" kinds={["pan"]} results={v.checks} on={v.autoOn} env={v.autoEnv} accept={{ pan: { label: "PAN and KYC", state: v.states.kyc ?? "pending" } }} />
      </Section>
      <Section title="Verification">
        <Check app={app} v={v} k="kyc" />
      </Section>
    </div>
  );
}

export function BankTab({ app, v, data, docs }: { app: AppView; v: VerificationData; data: OnboardingData | null; docs: PartnerDoc[] }) {
  const k = data?.bank;
  return (
    <div className="space-y-4">
      <Section title="Bank account" description={notYet(data) ?? "The account number is hidden but for its last four digits. Showing it is recorded in the Activity tab."}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Name on the account">{k?.holder}</Fact>
          <Fact label="Bank">{[k?.bankName, k?.branch].filter(Boolean).join(", ")}</Fact>
          <Fact label="Account number">{k?.accountNumber ? <BankReveal appId={app.id} masked={maskAccount(k.accountNumber)} /> : ""}</Fact>
          <Fact label="IFSC">{k?.ifsc ? <span className="font-mono">{k.ifsc}</span> : ""}</Fact>
          <Fact label="Kind of account">{ACCOUNT_TYPES.find((t) => t.id === k?.accountType)?.label}</Fact>
        </dl>
      </Section>
      <Section title="Bank proof">
        <DocSlots appId={app.id} slots={slotsOf(app, data, "bank", ["bank_proof"])} docs={docs} canAsk={canAsk(app)} />
      </Section>
      <Section title="Automatic checks" description="Whether the bank confirms the account and whose name it is in, and whether that is the name registered to the PAN.">
        <AutoChecks appId={app.id} subject="partner" kinds={["bank", "name_match"]} results={v.checks} on={v.autoOn} env={v.autoEnv} accept={{ bank: { label: "Bank account", state: v.states.bank ?? "pending" } }} />
      </Section>
      <Section title="Verification">
        <Check app={app} v={v} k="bank" />
      </Section>
    </div>
  );
}

export function WorkTab({ app, v, data, docs }: { app: AppView; v: VerificationData; data: OnboardingData | null; docs: PartnerDoc[] }) {
  const w = data?.work;
  const categories = workCategories(app.partner_type);
  const known = new Set(categories.map((c) => categorySubject(c.id)));
  const loose = docs.filter((d) => (d.subject.startsWith("category:") && !known.has(d.subject)) || (d.subject === "partner" && (d.kind === "work_photo" || d.kind === "survey_record")));
  return (
    <div className="space-y-4">
      <Section title="Past work" description={notYet(data)}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Completed so far">{w?.installs}</Fact>
          <Fact label="Largest system">{w?.largest ? `${w.largest} kW` : ""}</Fact>
          <Fact label="About their work" wide>
            {w?.summary}
          </Fact>
        </dl>
        {(w?.projects.length ?? 0) > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {w!.projects.map((p, i) => (
              <li key={i} className="px-3 py-2">
                {p.title || "—"}
                <span className="text-muted-foreground">{[p.place, p.size && `${p.size} kW`, p.year].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
                {p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {categories.map((c) => {
        const files = docs.filter((d) => d.subject === categorySubject(c.id));
        return (
          <Section key={c.id} title={`${c.label} (${files.length})`}>
            <DocList appId={app.id} docs={files} canAsk={canAsk(app)} empty="Nothing sent for this yet." />
          </Section>
        );
      })}
      <Section title="Completion certificates and references">
        <DocList appId={app.id} docs={docs.filter((d) => d.subject === "partner" && d.kind === "completion_certificate")} canAsk={canAsk(app)} />
      </Section>
      {loose.length > 0 && (
        <Section title="Other photos and records" description="Sent before photos were grouped by kind of work.">
          <DocList appId={app.id} docs={loose} canAsk={canAsk(app)} />
        </Section>
      )}
      <Section title="Verification" description="Check that their past work or references are real.">
        <Check app={app} v={v} k="work" />
      </Section>
    </div>
  );
}
