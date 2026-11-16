import { ActionForm } from "@waytara/ui/action-form";
import { BUSINESS_KINDS, LICENCE_TYPES, memberKey, type OnboardingData } from "@waytara/supabase/partner-onboarding";
import { licenceStatus, todayIst } from "@waytara/supabase/partner-account";
import { CHECKS, MEMBER_CHECKS, memberChecklist, memberStatus, memberSubject, type CheckKey } from "@waytara/supabase/partner-verification";
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
import { DocList, Fact, StateBadge, VerifyRow, type PartnerDoc } from "./partner-ui";

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

/** The partner's own check of this kind, as a row to set. */
function Check({ app, v, k }: { app: AppView; v: VerificationData; k: CheckKey }) {
  const def = CHECKS.find((c) => c.key === k)!;
  return <VerifyRow appId={app.id} subject="partner" itemKey={k} label={def.label} hint={def.hint} state={v.states[k] ?? "pending"} note={v.rows[k]?.note ?? null} checkedAt={v.rows[k]?.checked_at ?? null} />;
}

const docsOf = (docs: PartnerDoc[], kinds: string[]) => docs.filter((d) => d.subject === "partner" && kinds.includes(d.kind));

export function LeadTab({ app }: { app: AppView }) {
  const answers = readAnswers(app.answers);
  return (
    <div className="space-y-4">
      <Section title="What they applied with" description="From the short application on the Partner page.">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Applying as">{PARTNER_TYPE_LABEL[app.partner_type ?? ""] ?? ""}</Fact>
          <Fact label="Reference">{app.reference}</Fact>
          <Fact label="Applied">{when(app.created_at)}</Fact>
          <Fact label="Where">{app.cities}</Fact>
          <Fact label="Services" wide>
            {app.services.map((s) => PARTNER_SERVICE_LABEL[s] ?? s).join(", ")}
          </Fact>
          {answers.map((x) => (
            <Fact key={x.q} label={x.q} wide>
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

export function ScreeningTab({ app, calls }: { app: AppView; calls: CallRow[] }) {
  return (
    <div className="space-y-4">
      <Section title="Log a call" description="Call them on the number they gave, then note what you found out. Entries are kept as they are: correct a mistake with another entry.">
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

export function PersonalTab({ app, v }: { app: AppView; v: VerificationData }) {
  return (
    <div className="space-y-4">
      <Section title="Personal details">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Name">{app.contact_name}</Fact>
          <Fact label="Phone">
            <a href={`tel:${app.phone}`} className="hover:underline">
              {app.phone}
            </a>
          </Fact>
          <Fact label="E-mail">
            <a href={`mailto:${app.email}`} className="break-all hover:underline">
              {app.email}
            </a>
          </Fact>
          <Fact label="Website">{app.website}</Fact>
        </dl>
      </Section>
      <Section title="Verification" description="Confirm you reached the person on the number they gave and that the e-mail address is theirs.">
        <Check app={app} v={v} k="contact" />
      </Section>
    </div>
  );
}

export function BusinessTab({ app, v, data, docs }: { app: AppView; v: VerificationData; data: OnboardingData | null; docs: PartnerDoc[] }) {
  const b = data?.business;
  return (
    <div className="space-y-4">
      <Section title="Business details" description={data ? undefined : "They have not sent their business details yet."}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Business name">{b?.name || app.company_name}</Fact>
          <Fact label="Kind of business">{BUSINESS_KINDS.find((k) => k.id === b?.kind)?.label ?? b?.kind}</Fact>
          <Fact label="Started">{b?.started}</Fact>
          <Fact label="GSTIN">{b?.gstin}</Fact>
          <Fact label="Address" wide>
            {[b?.address, b?.city, b?.pin].filter(Boolean).join(", ")}
          </Fact>
          <Fact label="Website">{b?.website}</Fact>
          <Fact label="Districts">{data?.areas.districts.join(", ")}</Fact>
          <Fact label="Jobs a month">{data?.areas.capacity}</Fact>
          <Fact label="Team">{[data?.team.size && `${data.team.size} people`, data?.team.certified && `${data.team.certified} certified`].filter(Boolean).join(", ")}</Fact>
        </dl>
      </Section>
      <Section title="Registration documents" description="Business registration (GST, company or firm, Udyam) and insurance.">
        <DocList appId={app.id} docs={docsOf(docs, ["registration", "insurance"])} />
      </Section>
      <Section title="Verification">
        <Check app={app} v={v} k="registration" />
      </Section>
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
        const mine = docs.filter((d) => d.subject === memberSubject(key));
        return (
          <Card key={key} className="gap-4 shadow-none">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-sm">{m.name || `Team member ${i + 1}`}</CardTitle>
                  <CardDescription className="text-xs">
                    {m.role || "No role given"} · {m.needsLicence ? "Needs a licence or certificate" : "No licence needed"}
                    {m.certificate ? ` · No. ${m.certificate}` : ""}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {app.status === "approved" && status !== "verified" && <Badge variant="secondary">Added after approval</Badge>}
                  <StateBadge state={status} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <DocList appId={app.id} docs={mine} empty="No documents sent for this person yet." />
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
      <Section title="Licences and certificates" description={licences.length === 0 ? "No licence has been entered." : undefined}>
        {licences.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {licences.map((l, i) => {
              const s = licenceStatus(l.validUntil, today);
              return (
                <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
                  <span>
                    {LICENCE_TYPES.find((t) => t.id === l.type)?.label.split(" (")[0] ?? "Licence"} · {l.number || "no number"}
                    {l.grade ? ` · class ${l.grade}` : ""}
                  </span>
                  <span className={s.state === "expired" ? "font-medium text-destructive" : s.state === "soon" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                    {l.validUntil ? `${s.state === "expired" ? "Expired" : "Valid until"} ${l.validUntil}` : "No date given"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <DocList appId={app.id} docs={docsOf(docs, ["licence", "certificate"])} />
      </Section>
      <Section title="Verification" description="Check the licence with the authority that issued it.">
        <Check app={app} v={v} k="licence" />
      </Section>
    </div>
  );
}

export function KycTab({ app, v, docs }: { app: AppView; v: VerificationData; docs: PartnerDoc[] }) {
  return (
    <div className="space-y-4">
      <Section title="KYC documents" description="Identity of the person we deal with, and the business's KYC proofs. They may hide all but the last four digits of any number.">
        <DocList appId={app.id} docs={docsOf(docs, ["identity", "kyc"])} />
      </Section>
      <Section title="Verification">
        <Check app={app} v={v} k="identity" />
        <Check app={app} v={v} k="kyc" />
      </Section>
    </div>
  );
}

export function BankTab({ app, v, docs }: { app: AppView; v: VerificationData; docs: PartnerDoc[] }) {
  return (
    <div className="space-y-4">
      <Section title="Bank details" description="Account holder, bank and IFSC are collected on the partner's page soon; for now, the cancelled cheque or passbook page they send.">
        <DocList appId={app.id} docs={docsOf(docs, ["bank_proof"])} empty="No bank proof sent yet." />
      </Section>
      <Section title="Verification">
        <Check app={app} v={v} k="bank" />
      </Section>
    </div>
  );
}

export function WorkTab({ app, v, data, docs }: { app: AppView; v: VerificationData; data: OnboardingData | null; docs: PartnerDoc[] }) {
  const w = data?.work;
  return (
    <div className="space-y-4">
      <Section title="Past work" description={data ? undefined : "They have not sent their past work yet."}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Installations so far">{w?.installs}</Fact>
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
      <Section title="Photos and survey records">
        <DocList appId={app.id} docs={docsOf(docs, ["work_photo", "survey_record"])} />
      </Section>
      <Section title="Verification" description="Check that their past work or references are real.">
        <Check app={app} v={v} k="work" />
      </Section>
    </div>
  );
}
