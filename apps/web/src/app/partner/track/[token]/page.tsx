import type { Metadata } from "next";
import { PartnerTracker, PartnerTrackerClosed } from "@/components/partner/partner-tracker";
import { OnboardingForm } from "@/components/partner/onboarding-form";
import { AccountForm } from "@/components/partner/account-form";
import { adminSignInUrl } from "@/lib/partner-track-api";
import { findTrackedRecord } from "@/lib/partner-track-server";
import { loadOnboarding } from "@/lib/partner-onboarding-server";

// Private to one applicant: never cached, never indexed, and the address is not passed on to other sites.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your application", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PartnerTrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const record = await findTrackedRecord(token);
  if (!record) return <PartnerTrackerClosed />;

  // The page shows only these few fields (never the id, the e-mail address or the contact name beyond the first name).
  const { reference, partnerType, firstName, status, appliedOn, message, messageAt } = record;
  const app = { reference, partnerType, firstName, status, appliedOn, message, messageAt };

  // Once the team has opened onboarding, the page is the forms (the applicant's own saved answers and the names of their files, nothing more).
  if (status === "onboarding") {
    const state = await loadOnboarding(record.id);
    return (
      <PartnerTracker app={app}>
        <OnboardingForm token={token} partnerType={partnerType} initial={state.data} initialDocuments={state.documents} submittedAt={state.submittedAt} />
      </PartnerTracker>
    );
  }
  // Approved: the last step is choosing a password for the partner account (the link closes once it exists).
  if (status === "approved" && !record.profileId) {
    return (
      <PartnerTracker app={app}>
        <AccountForm token={token} email={record.email} signInUrl={adminSignInUrl()} />
      </PartnerTracker>
    );
  }
  return <PartnerTracker app={app} />;
}
