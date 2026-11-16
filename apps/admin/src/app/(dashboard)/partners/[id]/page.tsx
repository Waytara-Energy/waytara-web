import Link from "next/link";
import { createClient } from "@waytara/supabase/server";
import { ActionForm } from "@waytara/ui/action-form";
import { Button } from "@waytara/ui/button";
import { ToneBadge, type Tone } from "@/components/page-kit";
import { PARTNER_SERVICE_LABEL, PARTNER_STATUSES, PARTNER_STATUS_LABEL, PARTNER_TYPE_LABEL, readAnswers } from "@/lib/partners";
import { BUSINESS_KINDS, DOCUMENT_KIND_LABEL, LICENCE_TYPES, readOnboarding } from "@waytara/supabase/partner-onboarding";
import { CHECK_STATE_LABEL, DECLINE_LABEL, approvalGaps, checklistFor, isCheckKey, isCheckState, requiredChecks, type CheckKey, type CheckState } from "@waytara/supabase/partner-verification";
import { PartnerDecision } from "./partner-decision";
import { resendPartnerTrackingLink, reviewPartnerApplication, savePartnerChecks } from "./actions";

const TONES: Record<string, Tone> = { new: "info", in_review: "warn", shortlisted: "warn", onboarding: "warn", verification: "warn", approved: "good", rejected: "neutral" };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children || "—"}</dd>
    </div>
  );
}

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: app, error } = await supabase
    .from("partner_applications")
    .select("*, reviewer:profiles!partner_applications_reviewed_by_fkey(full_name)")
    .eq("id", id)
    .single();

  if (error || !app) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Couldn&apos;t load this application.{error ? ` (${error.message})` : ""}
      </div>
    );
  }

  const answers = readAnswers(app.answers);
  // What the applicant filled in on their onboarding page, and the files they sent (names only here; the file viewer, with its access log, comes with verification).
  const [{ data: onboardingRow }, { data: docRows }, { data: checkRows }, { data: accessRows }] = await Promise.all([
    supabase.from("partner_onboarding").select("data, submitted_at, updated_at").eq("application_id", id).maybeSingle(),
    supabase.from("partner_documents").select("id, kind, file_name, size_bytes, uploaded_at").eq("application_id", id).order("uploaded_at", { ascending: true }),
    supabase.from("partner_checks").select("key, state, note, checked_at, checker:profiles!partner_checks_checked_by_fkey(full_name)").eq("application_id", id),
    supabase
      .from("partner_document_access")
      .select("id, file_name, action, accessed_at, accessor:profiles!partner_document_access_accessed_by_fkey(full_name)")
      .eq("application_id", id)
      .order("accessed_at", { ascending: false })
      .limit(50),
  ]);
  const onboarding = onboardingRow ? readOnboarding(onboardingRow.data) : null;
  const documents = docRows ?? [];
  const checks = new Map((checkRows ?? []).map((c) => [c.key, c]));
  const checkStates: Partial<Record<CheckKey, CheckState>> = {};
  for (const c of checkRows ?? []) if (isCheckKey(c.key) && isCheckState(c.state)) checkStates[c.key] = c.state;
  const gaps = approvalGaps(app.partner_type, checkStates);
  const finished = app.status === "approved" || app.status === "rejected";
  const when = (iso: string) => new Date(iso).toLocaleString("en-IN");
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/partners" className="text-xs text-muted-foreground hover:underline">
          ← Back to Partners
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{app.company_name}</h1>
          <ToneBadge tone={TONES[app.status] ?? "neutral"}>{PARTNER_STATUS_LABEL[app.status] ?? app.status}</ToneBadge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {app.partner_type ? `${PARTNER_TYPE_LABEL[app.partner_type] ?? app.partner_type} · ` : ""}
          {app.reference ? `${app.reference} · ` : ""}Received {new Date(app.created_at).toLocaleString("en-IN")}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Contact</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Item label="Contact person">{app.contact_name}</Item>
          <Item label="Phone">
            <a href={`tel:${app.phone}`} className="hover:underline">
              {app.phone}
            </a>
          </Item>
          <Item label="E-mail">
            <a href={`mailto:${app.email}`} className="hover:underline">
              {app.email}
            </a>
          </Item>
          <Item label="Website">{app.website}</Item>
        </dl>
      </div>

      {answers.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Their answers</h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {answers.map((x) => (
              <Item key={x.q} label={x.q}>
                {x.a}
              </Item>
            ))}
          </dl>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Their work</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Item label="Services">{app.services.map((s) => PARTNER_SERVICE_LABEL[s] ?? s).join(", ")}</Item>
          </div>
          <div className="sm:col-span-2">
            <Item label={`Works in (${app.states.length})`}>{app.states.join(", ")}</Item>
          </div>
          <div className="sm:col-span-2">
            <Item label="Cities or districts">{app.cities}</Item>
          </div>
          <Item label="Years in business">{app.years_in_business != null ? String(app.years_in_business) : ""}</Item>
          <Item label="Installations so far">{app.installs_completed}</Item>
          <Item label="Team size">{app.team_size}</Item>
          <Item label="Certifications or empanelments">{app.certifications}</Item>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Their message</dt>
            <dd className="whitespace-pre-wrap text-sm">{app.message ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Onboarding</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {onboardingRow?.submitted_at
            ? `Sent for verification on ${when(onboardingRow.submitted_at)}.`
            : onboardingRow
              ? `Not sent yet. Draft last saved ${when(onboardingRow.updated_at)}.`
              : documents.length > 0
                ? "Not sent yet. Some files have been uploaded."
                : app.status === "onboarding"
                  ? "Open: the applicant has not started."
                  : "Not open. It opens when you move the application to Onboarding, and the applicant is e-mailed a link."}
        </p>
        {onboarding && (
          <div className="mt-4 space-y-5">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Item label="Business name">{onboarding.business.name}</Item>
              <Item label="Kind">{BUSINESS_KINDS.find((k) => k.id === onboarding.business.kind)?.label ?? onboarding.business.kind}</Item>
              <div className="sm:col-span-2">
                <Item label="Address">{[onboarding.business.address, onboarding.business.city, onboarding.business.pin].filter(Boolean).join(", ")}</Item>
              </div>
              <Item label="Started">{onboarding.business.started}</Item>
              <Item label="GSTIN">{onboarding.business.gstin}</Item>
              <Item label="Website">{onboarding.business.website}</Item>
              <Item label="Team">{[onboarding.team.size && `${onboarding.team.size} people`, onboarding.team.certified && `${onboarding.team.certified} certified`].filter(Boolean).join(", ")}</Item>
              <div className="sm:col-span-2">
                <Item label={`Districts (${onboarding.areas.districts.length})`}>{onboarding.areas.districts.join(", ")}</Item>
              </div>
              <Item label="Jobs a month">{onboarding.areas.capacity}</Item>
              <Item label="Installations so far">{onboarding.work.installs}</Item>
              <Item label="Largest system">{onboarding.work.largest ? `${onboarding.work.largest} kW` : ""}</Item>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">About their work</dt>
                <dd className="whitespace-pre-wrap text-sm">{onboarding.work.summary || "—"}</dd>
              </div>
            </dl>

            {onboarding.licences.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Licences and certificates</h3>
                <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
                  {onboarding.licences.map((l, i) => {
                    const expired = l.validUntil && new Date(`${l.validUntil}T23:59:59`) < new Date();
                    return (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
                        <span>
                          {LICENCE_TYPES.find((t) => t.id === l.type)?.label ?? (l.type || "Licence")} · {l.number || "no number"}
                          {l.grade ? ` · ${l.grade}` : ""}
                        </span>
                        <span className={expired ? "text-destructive" : "text-muted-foreground"}>{l.validUntil ? `${expired ? "Expired" : "Valid until"} ${l.validUntil}` : "No date given"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {onboarding.team.members.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Key people</h3>
                <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
                  {onboarding.team.members.map((m, i) => (
                    <li key={i} className="px-3 py-2">
                      {m.name || "—"}
                      <span className="text-muted-foreground">{[m.role, m.certificate].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {onboarding.work.projects.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Projects</h3>
                <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
                  {onboarding.work.projects.map((p, i) => (
                    <li key={i} className="px-3 py-2">
                      {p.title || "—"}
                      <span className="text-muted-foreground">{[p.place, p.size && `${p.size} kW`, p.year].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
                      {p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {documents.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-medium text-muted-foreground">Documents sent ({documents.length})</h3>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
              {documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
                  <span>
                    <span className="font-medium">{DOCUMENT_KIND_LABEL[d.kind] ?? d.kind}</span> · {d.file_name}
                  </span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span>
                      {d.size_bytes >= 1048576 ? `${(d.size_bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(d.size_bytes / 1024))} KB`} · {when(d.uploaded_at)}
                    </span>
                    {/* plain links, not the router: each one is a download-or-view that the server logs before it serves the file */}
                    <a href={`/partners/${app.id}/files/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">
                      View
                    </a>
                    <a href={`/partners/${app.id}/files/${d.id}?download=1`} className="font-medium text-foreground underline-offset-4 hover:underline">
                      Download
                    </a>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Every time you open or download a file it is recorded below, with your name and the time. The applicant cannot open them.</p>
          </div>
        )}

        {(accessRows ?? []).length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-medium text-muted-foreground">Who opened these files</h3>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
              {(accessRows ?? []).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
                  <span>
                    {a.accessor?.full_name ?? "A former admin"} {a.action === "download" ? "downloaded" : "viewed"} <span className="font-medium">{a.file_name}</span>
                  </span>
                  <span className="text-muted-foreground">{when(a.accessed_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Verification</h2>
        {app.status === "rejected" ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Declined{app.declined_at ? ` on ${when(app.declined_at)}` : ""}.{" "}
            {app.declined_handling ? `Their data: ${DECLINE_LABEL[app.declined_handling] ?? app.declined_handling}.` : "Their private link is closed."}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Check each item against the documents and with the people and authorities concerned, then mark it. {requiredChecks(app.partner_type).length} of the checks must be Verified before you can approve.
          </p>
        )}
        <ActionForm action={savePartnerChecks.bind(null, app.id)} loading="Saving…" success="Checklist saved." className="mt-4 space-y-3">
          {checklistFor(app.partner_type).map((c) => {
            const row = checks.get(c.key);
            const required = requiredChecks(app.partner_type).includes(c.key);
            return (
              <div key={c.key} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_11rem]">
                <div>
                  <p className="text-sm font-medium">
                    {c.label} {required ? <span className="text-xs font-normal text-muted-foreground">(required)</span> : <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.hint}</p>
                  {row?.checked_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last set by {row.checker?.full_name ?? "a former admin"} on {when(row.checked_at)}.
                    </p>
                  )}
                </div>
                <select
                  name={`state_${c.key}`}
                  defaultValue={row?.state ?? "pending"}
                  aria-label={`${c.label}: state`}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {(Object.keys(CHECK_STATE_LABEL) as CheckState[]).map((s) => (
                    <option key={s} value={s}>
                      {CHECK_STATE_LABEL[s]}
                    </option>
                  ))}
                </select>
                <input
                  name={`note_${c.key}`}
                  defaultValue={row?.note ?? ""}
                  maxLength={500}
                  placeholder="Note (what you checked, who you spoke to, reference number)"
                  aria-label={`${c.label}: note`}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
                />
              </div>
            );
          })}
          <Button type="submit" size="sm" variant="outline">
            Save checklist
          </Button>
        </ActionForm>

        {!finished && (
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">Decision</h3>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">Save the checklist first: approving looks at what is saved.</p>
            <PartnerDecision id={app.id} reference={app.reference} status={app.status} gaps={gaps} />
          </div>
        )}
        {app.status === "rejected" && <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">To take a declined application further, move it to another status in the Review box below.</p>}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Review</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {app.reviewed_at
            ? `Last updated by ${app.reviewer?.full_name ?? "an admin"} on ${new Date(app.reviewed_at).toLocaleString("en-IN")}.`
            : "Not reviewed yet."}
        </p>
        <ActionForm action={reviewPartnerApplication.bind(null, app.id)} loading="Saving…" success="Application updated." className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={app.status}
              className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* Approved and Declined are reached only by the Approve and Decline buttons above; here they show only when that is where the application already is */}
              {PARTNER_STATUSES.filter((s) => (s !== "approved" && s !== "rejected") || s === app.status).map((s) => (
                <option key={s} value={s}>
                  {PARTNER_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <p className="max-w-xl text-xs text-muted-foreground">
              Moving an application to Onboarding opens the forms for the applicant and e-mails them a new private link (the earlier link stops working). Moving it to any other status hides the forms again; if the applicant had already sent them, they open again with their answers and files kept.
            </p>
          </div>
          <label className="flex max-w-xl items-start gap-2.5 text-sm">
            <input type="checkbox" name="listedPublicly" defaultChecked={app.listed_publicly} className="mt-0.5 size-4" />
            <span>
              <span className="font-medium">Show in the public partner directory</span>
              <span className="block text-xs text-muted-foreground">
                Only for an approved partner who has agreed to be listed. The page shows the business name, the kind of partner and the districts, nothing else. Moving the application out of Approved
                removes the listing.
              </span>
            </span>
          </label>
          <div className="space-y-1.5">
            <label htmlFor="adminNotes" className="text-sm font-medium">
              Notes <span className="font-normal text-muted-foreground">(only the admins see these)</span>
            </label>
            <textarea
              id="adminNotes"
              name="adminNotes"
              rows={5}
              maxLength={5000}
              defaultValue={app.admin_notes ?? ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="statusMessage" className="text-sm font-medium">
              Note for the applicant <span className="font-normal text-muted-foreground">(they see this on their tracking page)</span>
            </label>
            <textarea
              id="statusMessage"
              name="statusMessage"
              rows={3}
              maxLength={600}
              defaultValue={app.status_message ?? ""}
              placeholder="For example: we will call you this week to talk about your licences."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Up to 600 characters. Leave it empty to show no note. Do not put anything private here.</p>
          </div>
          <Button type="submit" size="sm">
            Save
          </Button>
        </ActionForm>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Tracking link</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {app.access_token_hash
            ? app.access_expires_at && new Date(app.access_expires_at) > new Date()
              ? `The applicant's private link is active until ${new Date(app.access_expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`
              : "The applicant's private link has expired."
            : "This application has no tracking link (it was received before links existed)."}{" "}
          The link itself is never stored, so it cannot be shown again. Sending a new one e-mails it to {app.email} and closes the old one straight away, which is also what to do if a link has been shared by mistake.
        </p>
        <ActionForm action={resendPartnerTrackingLink.bind(null, app.id)} loading="Sending…" success="A new link was e-mailed and the old one is closed." className="mt-3">
          <Button type="submit" size="sm" variant="outline">
            Send a new tracking link
          </Button>
        </ActionForm>
      </div>
    </div>
  );
}
