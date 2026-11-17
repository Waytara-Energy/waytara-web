import type { Metadata } from "next";
import { Logo } from "@/components/shared/logo";
import { PartnerTrackerClosed } from "@/components/partner/partner-tracker";
import { CrewDocuments } from "@/components/partner/crew-documents";
import { loadCrewSession } from "@/lib/partner-crew-server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { memberSubject, siteRoleOf, type OnboardingDocument } from "@waytara/supabase/partner-onboarding";

// Private to one person: never cached, never indexed, and the address is not passed on to other sites.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add your documents", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Where the link a partner sends a team member leads. No account and no password: the long link is the key, it works only for that person, and it can file nothing
 * under anyone else. A link that is wrong, old, replaced, or whose application has moved on shows the same quiet "not active" page.
 */
export default async function CrewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await loadCrewSession(token);
  if (!s) return <PartnerTrackerClosed />;

  const { data: rows } = await createServiceRoleClient()
    .from("partner_documents")
    .select("id, kind, subject, file_name, size_bytes, uploaded_at")
    .eq("application_id", s.app.id)
    .eq("subject", memberSubject(s.key))
    .order("uploaded_at", { ascending: true });
  const docs: OnboardingDocument[] = (rows ?? []).map((d) => ({ id: d.id, kind: d.kind, subject: d.subject, name: d.file_name, size: d.size_bytes, uploadedAt: d.uploaded_at }));
  const business = s.data.business.name || s.app.companyName;
  const first = s.member.name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="min-h-dvh bg-theme-bg">
      <div className="fluid-container py-6 sm:py-8">
        <Logo />
      </div>
      <main className="fluid-container pb-20 pt-6 sm:pt-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-theme-muted">Hi {first}</p>
          <h1 className="mt-2 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight tracking-tight text-theme-primary">Add your documents</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-theme-secondary">
            {s.app.contactName} of {business} has listed you{siteRoleOf(s.member.siteRole) ? ` as a ${siteRoleOf(s.member.siteRole)!.label.toLowerCase()}` : ""} on their team for WayTara projects. To count as part of the team you are verified on your own, so please add your own documents. Only the WayTara team sees them, and only to verify you. PDF, JPG, PNG or WebP, up to 10 MB each.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-theme-muted">We never ask for your Aadhaar number. If you send an Aadhaar copy as your ID, hide all but its last four digits.</p>
          <div className="mt-8">
            <CrewDocuments token={token} memberKey={s.key} needsLicence={s.member.needsLicence} siteRole={s.member.siteRole} initialDocuments={docs} alreadyDone={s.invite.status === "completed"} />
          </div>
          <p className="mt-10 text-xs leading-relaxed text-theme-muted">This page is private to you. Anyone with this link can add files under your name, so please keep it to yourself.</p>
        </div>
      </main>
    </div>
  );
}
