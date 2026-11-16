import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "@waytara/ui/cn";
import { ActionForm } from "@waytara/ui/action-form";
import { DOCUMENT_KIND_LABEL } from "@waytara/supabase/partner-onboarding";
import { CHECKS, CHECK_STATE_LABEL, approvalGaps, memberStatus, type CheckState } from "@waytara/supabase/partner-verification";
import { loadVerification } from "@/lib/partner-verification-data";
import { createClient } from "@waytara/supabase/server";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PARTNER_STATUS_LABEL, PARTNER_TYPE_LABEL } from "@/lib/partners";
import { DangerZone } from "./danger-zone";
import { ListingToggle } from "./listing-toggle";
import { PartnerComposer } from "./partner-composer";
import { PartnerDecision } from "./partner-decision";
import { BankTab, BusinessTab, KycTab, LeadTab, LegalTab, PersonalTab, ScreeningTab, TeamTab, WorkTab, type AppView, type CallRow } from "./partner-tabs";
import { type PartnerDoc } from "./partner-ui";
import { StatusMenu } from "./status-menu";
import { resendPartnerTrackingLink } from "./actions";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const STEPS = ["Applied", "Screening", "Onboarding", "Verification", "Approved"];
const STEP_OF: Record<string, number> = { new: 0, in_review: 1, shortlisted: 1, onboarding: 2, verification: 3, approved: 4, rejected: 4 };
const TAB_IDS = ["lead", "screening", "personal", "business", "team", "legal", "kyc", "bank", "work", "activity"] as const;
type TabId = (typeof TAB_IDS)[number];
const DEFAULT_TAB: Record<string, TabId> = { new: "lead", in_review: "screening", shortlisted: "screening", onboarding: "lead", verification: "personal", approved: "lead", rejected: "lead" };

/** The small mark on a tab: a tick when everything in it is verified, a warning when something has a problem, nothing while it is still open. */
function TabMark({ states }: { states: (CheckState | undefined)[] }) {
  if (states.length === 0) return null;
  if (states.some((s) => s === "problem")) return <CircleAlert className="size-3.5 text-destructive" aria-label="Problem found" />;
  if (states.every((s) => s === "verified")) return <CheckCircle2 className="size-3.5 text-emerald-500" aria-label="Verified" />;
  return null;
}

export default async function PartnerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: app, error } = await supabase
    .from("partner_applications")
    .select("*, reviewer:profiles!partner_applications_reviewed_by_fkey(full_name), account:profiles!partner_applications_profile_id_fkey(deactivated_at)")
    .eq("id", id)
    .single();

  if (error || !app) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">Couldn&apos;t load this application.{error ? ` (${error.message})` : ""}</div>;
  }

  const tab: TabId = TAB_IDS.includes(sp.tab as TabId) ? (sp.tab as TabId) : (DEFAULT_TAB[app.status] ?? "lead");
  const [v, { data: docRows }, { data: accessRows }, { data: callRows }, { data: checkRows }, { data: onboardingRow }] = await Promise.all([
    loadVerification(supabase, id),
    supabase.from("partner_documents").select("id, kind, file_name, size_bytes, uploaded_at, subject").eq("application_id", id).order("uploaded_at", { ascending: true }),
    supabase.from("partner_document_access").select("id, file_name, action, accessed_at, accessor:profiles!partner_document_access_accessed_by_fkey(full_name)").eq("application_id", id).order("accessed_at", { ascending: false }).limit(50),
    supabase.from("partner_screening_calls").select("id, called_at, outcome, notes, next_step, caller:profiles!partner_screening_calls_called_by_fkey(full_name)").eq("application_id", id).order("called_at", { ascending: false }).limit(100),
    supabase.from("partner_item_checks").select("subject, key, state, note, checked_at, checker:profiles!partner_item_checks_checked_by_fkey(full_name)").eq("application_id", id),
    supabase.from("partner_onboarding").select("submitted_at").eq("application_id", id).maybeSingle(),
  ]);

  const docs: PartnerDoc[] = docRows ?? [];
  const calls: CallRow[] = (callRows ?? []).map((c) => ({ id: c.id, called_at: c.called_at, outcome: c.outcome, notes: c.notes, next_step: c.next_step, caller: c.caller?.full_name ?? null }));
  const view: AppView = { id: app.id, status: app.status, partner_type: app.partner_type, company_name: app.company_name, contact_name: app.contact_name, phone: app.phone, email: app.email, website: app.website, reference: app.reference, created_at: app.created_at, answers: app.answers, message: app.message, services: app.services, cities: app.cities, account_note: app.status !== "approved" ? "" : app.profile_id ? (app.account?.deactivated_at ? "Suspended" : `Active since ${app.account_created_at ? when(app.account_created_at) : "signing up"}`) : "Not created yet", last_updated: app.reviewed_at ? `${app.reviewer?.full_name ?? "An admin"}, ${when(app.reviewed_at)}` : "" };
  const gaps = approvalGaps(app.partner_type, v.states, v.members, v.memberStates);
  const finished = app.status === "approved" || app.status === "rejected";
  const stepIndex = STEP_OF[app.status] ?? 0;
  const hasAside = !finished || (app.status !== "rejected" && !app.profile_id);
  const memberMarks = v.members.map((m) => memberStatus(m, v.memberStates));

  // Everything that happened, newest first, for the Activity tab.
  const events: { at: string; text: string }[] = [{ at: app.created_at, text: "Applied" }];
  if (app.account_created_at) events.push({ at: app.account_created_at, text: "The applicant confirmed their e-mail and created their account" });
  const memberName = (subject: string) => v.onboarding?.team.members.find((m, i) => `member:${m.id || `m${i}`}` === subject)?.name || "a team member";
  for (const d of docs) events.push({ at: d.uploaded_at, text: `Document sent: ${DOCUMENT_KIND_LABEL[d.kind] ?? d.kind}, ${d.file_name}${d.subject.startsWith("member:") ? ` (${memberName(d.subject)})` : ""}` });
  if (onboardingRow?.submitted_at) events.push({ at: onboardingRow.submitted_at, text: "Onboarding sent for verification" });
  for (const c of checkRows ?? []) {
    if (!c.checked_at) continue;
    const label = CHECKS.find((x) => x.key === c.key)?.label ?? (c.key === "member_licence" ? "Licence or certificate" : "Identity");
    events.push({ at: c.checked_at, text: `${c.checker?.full_name ?? "A former admin"} set ${label}${c.subject !== "partner" ? ` of ${memberName(c.subject)}` : ""} to ${CHECK_STATE_LABEL[c.state as CheckState] ?? c.state}${c.note ? `: ${c.note}` : ""}` });
  }
  for (const c of calls) events.push({ at: c.called_at, text: `${c.caller ?? "A former admin"} logged a screening call` });
  for (const a of accessRows ?? []) events.push({ at: a.accessed_at, text: `${a.accessor?.full_name ?? "A former admin"} ${a.action === "download" ? "downloaded" : "viewed"} ${a.file_name}` });
  if (app.reviewed_at) events.push({ at: app.reviewed_at, text: `${app.reviewer?.full_name ?? "An admin"} last updated the application (${PARTNER_STATUS_LABEL[app.status] ?? app.status})` });
  if (app.declined_at) events.push({ at: app.declined_at, text: "Declined" });
  if (app.status_message && app.status_message_at) events.push({ at: app.status_message_at, text: `Note shown to the applicant: ${app.status_message}` });
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const triggers: { id: TabId; label: string; mark?: (CheckState | undefined)[]; count?: number }[] = [
    { id: "lead", label: "Lead details" },
    { id: "screening", label: "Screening", count: calls.length },
    { id: "personal", label: "Personal", mark: [v.states.contact] },
    { id: "business", label: "Business", mark: [v.states.registration] },
    { id: "team", label: "Team", mark: v.members.length > 0 ? memberMarks : [], count: v.members.length },
    { id: "legal", label: "Legal certificates", mark: [v.states.licence] },
    { id: "kyc", label: "KYC", mark: [v.states.identity, v.states.kyc] },
    { id: "bank", label: "Bank", mark: [v.states.bank] },
    { id: "work", label: "Past work", mark: [v.states.work] },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-6 pb-6">
    <div className={cn("grid items-start gap-5", hasAside && "xl:grid-cols-[minmax(0,1fr)_21rem]")}>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/partners">Partners</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{app.company_name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-semibold tracking-tight">{app.company_name}</h1>
          <p className="text-sm text-muted-foreground">
            {app.partner_type ? `${PARTNER_TYPE_LABEL[app.partner_type] ?? app.partner_type} · ` : ""}
            {app.reference ? `${app.reference} · ` : ""}Received {when(app.created_at)}
          </p>
          <ol aria-label="Progress" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className={cn("flex items-center gap-1.5", i <= stepIndex && app.status !== "rejected" ? "font-medium text-foreground" : "text-muted-foreground")}>
                  <span className={cn("size-1.5 rounded-full", i <= stepIndex && app.status !== "rejected" ? "bg-primary" : "bg-muted-foreground/40")} />
                  {s}
                </span>
                {i < STEPS.length - 1 && <span aria-hidden="true" className={cn("h-px w-6", i < stepIndex && app.status !== "rejected" ? "bg-primary" : "bg-border")} />}
              </li>
            ))}
            {app.status === "rejected" && <li className="font-medium text-destructive">· Declined</li>}
          </ol>
          </div>
          <div className="flex items-center gap-2">
            {app.status === "approved" && <ListingToggle id={app.id} listed={app.listed_publicly} />}
            <StatusMenu id={app.id} status={app.status} />
          </div>
        </div>

        <Tabs key={app.id} defaultValue={tab} className="gap-4">
          <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-1 border-b border-border">
            {triggers.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-1.5 px-3 py-1.5">
                {t.label}
                {t.count ? <span className="text-xs text-muted-foreground">{t.count}</span> : null}
                {t.mark ? <TabMark states={t.mark} /> : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="lead">
            <LeadTab app={view} />
          </TabsContent>
          <TabsContent value="screening">
            <ScreeningTab app={view} calls={calls} />
          </TabsContent>
          <TabsContent value="personal">
            <PersonalTab app={view} v={v} />
          </TabsContent>
          <TabsContent value="business">
            <BusinessTab app={view} v={v} data={v.onboarding} docs={docs} />
          </TabsContent>
          <TabsContent value="team">
            <TeamTab app={view} v={v} data={v.onboarding} docs={docs} />
          </TabsContent>
          <TabsContent value="legal">
            <LegalTab app={view} v={v} data={v.onboarding} docs={docs} />
          </TabsContent>
          <TabsContent value="kyc">
            <KycTab app={view} v={v} docs={docs} />
          </TabsContent>
          <TabsContent value="bank">
            <BankTab app={view} v={v} docs={docs} />
          </TabsContent>
          <TabsContent value="work">
            <WorkTab app={view} v={v} data={v.onboarding} docs={docs} />
          </TabsContent>
          <TabsContent value="activity" className="space-y-4">
            {app.admin_notes && (
              <Card className="gap-2 shadow-none">
                <CardHeader>
                  <CardTitle className="text-sm">Internal notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm">{app.admin_notes}</p>
                </CardContent>
              </Card>
            )}
            <Card className="gap-3 shadow-none">
              <CardHeader>
                <CardTitle className="text-sm">Activity</CardTitle>
                <p className="text-xs text-muted-foreground">Everything that happened to this application, newest first.</p>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 border-l border-border pl-5">
                  {events.map((e, i) => (
                    <li key={i} className="relative text-sm">
                      <span aria-hidden="true" className="absolute -left-[1.55rem] top-1.5 size-2 rounded-full bg-primary/60" />
                      {e.text}
                      <span className="ml-2 text-xs text-muted-foreground">{when(e.at)}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
            <PartnerComposer id={app.id} />
          </TabsContent>
        </Tabs>
      </div>

      {hasAside && (
      <aside className="min-w-0 space-y-4">
        {!finished && (
          <Card className="gap-3 shadow-none">
            <CardHeader>
              <CardTitle className="text-sm">Decision</CardTitle>
              <p className="text-xs text-muted-foreground">Approving needs the required items verified, and every person on the team.</p>
            </CardHeader>
            <CardContent>
              <PartnerDecision id={app.id} reference={app.reference} status={app.status} gaps={gaps} parts={["approve", "ask"]} />
            </CardContent>
          </Card>
        )}

        {app.status !== "rejected" && !app.profile_id && (
          <Card className="gap-3 shadow-none">
            <CardHeader>
              <CardTitle className="text-sm">Invite link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {app.access_token_hash ? (app.access_expires_at && new Date(app.access_expires_at) > new Date() ? `Active until ${new Date(app.access_expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.` : "The link has expired.") : "No invite link."} It is never stored, so it cannot be shown again; sending a new one e-mails it to {app.email} and closes the old one.
              </p>
              <ActionForm action={resendPartnerTrackingLink.bind(null, app.id)} loading="Sending…" success="A new link was e-mailed and the old one is closed.">
                <Button type="submit" size="sm" variant="outline">
                  Send a new link
                </Button>
              </ActionForm>
            </CardContent>
          </Card>
        )}
      </aside>
      )}
    </div>
    <DangerZone id={app.id} reference={app.reference} status={app.status} hasAccount={Boolean(app.profile_id)} suspended={Boolean(app.account?.deactivated_at)} />
    </div>
  );
}
