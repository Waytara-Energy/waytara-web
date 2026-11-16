import { redirect } from "next/navigation";
import { PartnerTracker } from "@/components/partner/partner-tracker";
import { OnboardingForm } from "@/components/partner/onboarding-form";
import { findSessionRecord } from "@/lib/partner-track-server";
import { loadOnboarding } from "@/lib/partner-onboarding-server";

export const dynamic = "force-dynamic";

/**
 * The partner's Application page: where they are in the four steps, the team's note, and (while onboarding is open) the forms. It is the old tracking page, reached by
 * signing in instead of by a link: the application comes from the session, and the forms talk to the same routes as before with "me" in place of a link code.
 */
export default async function PartnerPortalPage() {
  const record = await findSessionRecord();
  if (!record) redirect("/login");
  const { reference, partnerType, firstName, status, appliedOn, message, messageAt } = record;
  const app = { reference, partnerType, firstName, status, appliedOn, message, messageAt };

  if (status === "onboarding") {
    const state = await loadOnboarding(record.id);
    return (
      <PartnerTracker app={app} embedded>
        <OnboardingForm token="me" partnerType={partnerType} initial={state.data} initialDocuments={state.documents} submittedAt={state.submittedAt} />
      </PartnerTracker>
    );
  }
  return <PartnerTracker app={app} embedded />;
}
