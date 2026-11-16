import Link from "next/link";
import { redirect } from "next/navigation";
import { LICENCE_TYPES } from "@waytara/supabase/partner-onboarding";
import { licenceStatus, todayIst } from "@waytara/supabase/partner-account";
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
  // An approved partner: any licence that has run out, or runs out within 60 days, is the one thing worth their attention here.
  if (status === "approved") {
    const { data } = await loadOnboarding(record.id);
    const today = todayIst();
    const due = data.licences.map((l) => ({ l, s: licenceStatus(l.validUntil, today) })).filter((x) => x.s.state === "expired" || x.s.state === "soon");
    return (
      <PartnerTracker app={app} embedded>
        {due.length > 0 && (
          <section aria-labelledby="due-heading" className="mt-8 max-w-xl rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
            <h2 id="due-heading" className="text-sm font-semibold">
              Licences to renew
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {due.map(({ l, s }, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-x-4">
                  <span>
                    {LICENCE_TYPES.find((t) => t.id === l.type)?.label ?? "Licence"} · {l.number || "no number"}
                  </span>
                  <span className={s.state === "expired" ? "font-medium text-red-600 dark:text-red-400" : "text-theme-muted"}>
                    {s.state === "expired" ? `Expired ${Math.abs(s.days ?? 0)} day${Math.abs(s.days ?? 0) === 1 ? "" : "s"} ago` : s.days === 0 ? "Runs out today" : `Runs out in ${s.days} day${s.days === 1 ? "" : "s"}`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              <Link href="/partner/portal/licences" className="underline underline-offset-4">
                Update your licences
              </Link>
            </p>
          </section>
        )}
      </PartnerTracker>
    );
  }
  return <PartnerTracker app={app} embedded />;
}
