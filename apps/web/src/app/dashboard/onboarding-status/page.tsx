import { redirect } from "next/navigation";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { Button } from "@/components/ui/button";
import { payAdvanceAmount, payFullAmount } from "./actions";

const STAGE_COPY: Record<string, { title: string; body: string }> = {
  site_setup: {
    title: "Payment received — we're preparing your equipment",
    body: "Your WayTara team is gathering and checking the quoted equipment before scheduling your installation.",
  },
  connection_test: {
    title: "Equipment ready — running final checks",
    body: "Your installer is confirming everything reports correctly before your installation is scheduled.",
  },
  install_scheduled: {
    title: "Installation scheduled",
    body: "Your installer will be in touch with the date and time slot, if they haven't already reached out.",
  },
};

// Onboarding pipeline redesign, Phase 5: the customer's own self-service
// payment step, reached right after they create their account. Phase 6
// made proxy.ts redirect every other /dashboard/* route here until
// current_stage reaches install_completed — this is now the ONLY thing a
// not-yet-onboarded customer can see. Reaching this page already
// onboarded (a stale bookmark, browser back button) sends them on to the
// real dashboard instead of showing a confusing "in progress" message.
export default async function OnboardingStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: onboarding } = profile
    ? await supabase
        .from("customer_onboarding")
        .select("current_stage, quotation_id, balance_payment_status, install_scheduled_at, install_time_slot")
        .eq("customer_id", profile.id)
        .maybeSingle()
    : { data: null };

  if (onboarding?.current_stage === "install_completed") {
    redirect("/dashboard");
  }

  const { data: quotation } = onboarding?.quotation_id
    ? await supabase
        .from("quotations")
        .select("total_amount, payment_option, advance_amount, balance_amount, plan:plans(name)")
        .eq("id", onboarding.quotation_id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Your Onboarding</h1>
        <p className="mt-1 text-sm text-theme-muted">
          Your full dashboard unlocks once installation is complete — here's where things stand.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-theme-border bg-theme-alert-subtle px-4 py-3 text-sm text-theme-alert">
          {error}
        </div>
      )}

      {!onboarding ? (
        <div className="rounded-xl border border-theme-border bg-theme-surface p-5 text-sm text-theme-muted">
          We couldn&apos;t find an onboarding record for your account. Contact your WayTara advisor.
        </div>
      ) : onboarding.current_stage === "payment_pending" ? (
        <div className="rounded-xl border border-theme-border bg-theme-surface p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-theme-primary">Complete your payment</h2>
            <p className="mt-1 text-sm text-theme-muted">
              {quotation?.plan?.name ?? "Your plan"} — ₹
              {Number(quotation?.total_amount ?? 0).toLocaleString("en-IN")} (GST included)
            </p>
          </div>

          {quotation?.payment_option === "full" ? (
            <form action={payFullAmount}>
              <Button type="submit" className="w-full">
                Pay ₹{Number(quotation.total_amount).toLocaleString("en-IN")} now
              </Button>
            </form>
          ) : quotation?.payment_option === "split" ? (
            <form action={payAdvanceAmount} className="space-y-2">
              <Button type="submit" className="w-full">
                Pay advance — ₹{Number(quotation.advance_amount ?? 0).toLocaleString("en-IN")} now
              </Button>
              <p className="text-center text-xs text-theme-muted">
                Balance of ₹{Number(quotation.balance_amount ?? 0).toLocaleString("en-IN")} is due at
                installation.
              </p>
            </form>
          ) : (
            <p className="text-sm text-theme-muted">
              We couldn&apos;t find your chosen payment option. Contact your WayTara advisor.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-theme-border bg-theme-surface p-5">
          <h2 className="text-sm font-semibold text-theme-primary">
            {STAGE_COPY[onboarding.current_stage]?.title ?? "Onboarding in progress"}
          </h2>
          <p className="mt-1 text-sm text-theme-muted">
            {STAGE_COPY[onboarding.current_stage]?.body ??
              "Your WayTara team is working on your onboarding."}
          </p>
          {onboarding.balance_payment_status === "pending" && (
            <p className="mt-3 text-xs text-theme-muted">
              A balance payment is still due — you&apos;ll be able to pay it once your installer arrives
              on site.
            </p>
          )}
          {onboarding.install_scheduled_at && (
            <p className="mt-3 text-sm text-theme-primary">
              Installation scheduled for{" "}
              {new Date(onboarding.install_scheduled_at).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {onboarding.install_time_slot ? `, ${onboarding.install_time_slot}` : ""}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
