import Link from "next/link";
import { createClient } from "@waytara/supabase/server";
import { Button } from "@waytara/ui/button";
import { QuotationForm } from "./quotation-form";
import { recordQuotationAccepted, recordQuotationRejected } from "./actions";

export default async function OnboardingPipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: actionError } = await searchParams;
  const supabase = await createClient();

  const { data: onboarding, error } = await supabase
    .from("customer_onboarding")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !onboarding) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Couldn&apos;t load this onboarding record. {error ? `(${error.message})` : ""}
      </div>
    );
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id, full_name, email, phone")
    .eq("id", onboarding.lead_id)
    .single();

  const { data: quotations } = await supabase
    .from("quotations")
    .select("*, plan:plans(name)")
    .eq("lead_id", onboarding.lead_id)
    .order("created_at", { ascending: false });

  const activeQuotation = quotations?.find((q) => q.status === "draft" || q.status === "sent");
  const pastQuotations = quotations?.filter((q) => q !== activeQuotation) ?? [];

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, price_monthly")
    .eq("is_active", true)
    .order("price_monthly");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/leads/${onboarding.lead_id}`} className="text-xs text-muted-foreground hover:underline">
          ← Back to Lead
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Onboarding — {lead?.full_name ?? "Unknown lead"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground capitalize">
          Stage: {onboarding.current_stage.replace(/_/g, " ")}
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {onboarding.current_stage !== "quotation_sent" ? (
        <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          This onboarding has moved past the quotation stage (now at{" "}
          <span className="font-medium capitalize">
            {onboarding.current_stage.replace(/_/g, " ")}
          </span>
          ). The rest of the pipeline UI for later stages isn&apos;t built yet.
        </div>
      ) : activeQuotation ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Quotation — {activeQuotation.plan?.name ?? "Plan"}
              </h2>
              <p className="text-sm text-muted-foreground">
                ₹{Number(activeQuotation.total_amount).toLocaleString("en-IN")} · sent{" "}
                {activeQuotation.sent_at
                  ? new Date(activeQuotation.sent_at).toLocaleDateString("en-IN")
                  : "—"}
              </p>
            </div>
            {activeQuotation.pdf_url && (
              <a
                href={activeQuotation.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View PDF
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <form
              action={recordQuotationAccepted.bind(null, activeQuotation.id, onboarding.id)}
            >
              <Button type="submit" size="sm">
                Customer Accepted
              </Button>
            </form>
            <form
              action={recordQuotationRejected.bind(null, activeQuotation.id, onboarding.id)}
            >
              <input type="hidden" name="action" value="re-quote" />
              <Button type="submit" variant="outline" size="sm">
                Rejected — Re-quote
              </Button>
            </form>
            <form
              action={recordQuotationRejected.bind(null, activeQuotation.id, onboarding.id)}
            >
              <input type="hidden" name="action" value="close" />
              <Button type="submit" variant="destructive" size="sm">
                Rejected — Close Lead
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">
            {pastQuotations.length > 0 ? "Send a new quotation" : "Create a quotation"}
          </h2>
          {plans && plans.length > 0 ? (
            <QuotationForm onboardingId={onboarding.id} plans={plans} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No active plans found — add one in the plan catalog first.
            </p>
          )}
        </div>
      )}

      {pastQuotations.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Previous quotations</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {pastQuotations.map((q) => (
              <li key={q.id} className="flex items-center justify-between">
                <span>
                  {q.plan?.name ?? "Plan"} — ₹{Number(q.total_amount).toLocaleString("en-IN")}
                </span>
                <span className="capitalize">{q.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lead && (
        <div className="rounded-lg border border-border bg-card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Customer</h2>
          <p className="text-muted-foreground">{lead.email}</p>
          <p className="text-muted-foreground">{lead.phone}</p>
        </div>
      )}
    </div>
  );
}
