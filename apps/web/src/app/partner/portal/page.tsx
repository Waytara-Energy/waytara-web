import Link from "next/link";
import { redirect } from "next/navigation";
import { LICENCE_TYPES } from "@waytara/supabase/partner-onboarding";
import { licenceStatus, todayIst } from "@waytara/supabase/partner-account";
import { PartnerTracker } from "@/components/partner/partner-tracker";
import { OnboardingForm } from "@/components/partner/onboarding-form";
import { PARTNER_TYPE_LABEL } from "@/lib/partner-network";
import { findSessionRecord } from "@/lib/partner-track-server";
import { loadOnboarding } from "@/lib/partner-onboarding-server";

export const dynamic = "force-dynamic";

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

/**
 * The partner's Application page. While onboarding is open it is the onboarding itself: a short header (what this is, the team's note if they asked for something)
 * over the parts to fill in. At every other stage it is the tracker: where they are in the four steps and what we say about it.
 */
export default async function PartnerPortalPage() {
  const record = await findSessionRecord();
  if (!record) redirect("/login");
  const { reference, partnerType, firstName, status, appliedOn, message, messageAt } = record;
  const app = { reference, partnerType, firstName, status, appliedOn, message, messageAt };

  if (status === "onboarding") {
    const state = await loadOnboarding(record.id);
    // their name is offered as the name on the photo ID until they type it themselves
    const initial = state.data.person.name ? state.data : { ...state.data, person: { ...state.data.person, name: record.contactName } };
    if (state.submittedAt) {
      return (
        <PartnerTracker app={app} embedded>
          <OnboardingForm token="me" partnerType={partnerType} contact={{ name: record.contactName, phone: record.phone, email: record.email }} initial={initial} initialDocuments={state.documents} submittedAt={state.submittedAt} />
        </PartnerTracker>
      );
    }
    return (
      <main className="fluid-container pb-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-theme-muted">Hi {firstName}</p>
          <h1 className="mt-2 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight tracking-tight text-theme-primary">Your onboarding</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-theme-secondary">
            Fill in each part and send us your documents. We save as you go, so you can sign out and come back whenever you like. When every part is complete, send it and our team will verify it.
          </p>
          <p className="mt-3 text-sm text-theme-muted">
            {[reference, partnerType ? PARTNER_TYPE_LABEL[partnerType] : null].filter(Boolean).join(" · ")}
          </p>

          {message && (
            <div className="mt-7 max-w-2xl rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
              <p className="text-sm font-medium text-theme-primary">Our team asked for something{messageAt ? `, ${dateLabel(messageAt)}` : ""}</p>
              <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-theme-primary">{message}</p>
              <p className="mt-2 text-xs text-theme-muted">Add or change what is asked for in the parts below, then send it again from Review and send.</p>
            </div>
          )}

          <OnboardingForm token="me" partnerType={partnerType} contact={{ name: record.contactName, phone: record.phone, email: record.email }} initial={initial} initialDocuments={state.documents} submittedAt={state.submittedAt} />

          <p className="mt-12 text-sm text-theme-muted">
            Need help?{" "}
            <Link href="/partner/portal/support" className="text-theme-primary underline underline-offset-4">
              Write to our team
            </Link>
          </p>
        </div>
      </main>
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
