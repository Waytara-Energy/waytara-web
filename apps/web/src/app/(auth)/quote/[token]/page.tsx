import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { QuoteResponseForm } from "./quote-response-form";

interface PricingLineItem {
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
}

const RESPONDED_COPY: Record<string, { title: string; body: string }> = {
  accepted: {
    title: "You've already accepted this quote",
    body: "Check your email for the next steps — setting up your account and completing payment.",
  },
  rejected: {
    title: "You've already declined this quote",
    body: "Your WayTara advisor has been notified. Reach out if you'd like to revisit it.",
  },
  revision_requested: {
    title: "You've already requested changes to this quote",
    body: "Your WayTara advisor has been notified and will send an updated quotation.",
  },
};

// Onboarding pipeline redesign, Phase 4: mirrors the invite/[token] page's
// anon-access pattern exactly (service-role lookup, .maybeSingle(), no
// session required) — a customer clicking this link from their email has
// no account and no session.
export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const service = createServiceRoleClient();
  const { data: quotation } = await service
    .from("quotations")
    .select(
      "id, status, pricing_breakdown, subtotal_amount, gst_rate, gst_amount, total_amount, valid_until, plan:plans(name, price_monthly), lead:leads(full_name, email)"
    )
    .eq("access_token", token)
    .maybeSingle();

  const expired = !!quotation?.valid_until && new Date(quotation.valid_until).getTime() < Date.now();
  const invalid = !quotation || expired;
  const alreadyResponded = quotation && quotation.status !== "sent" && !expired;

  if (invalid) {
    return (
      <div className="fluid-container flex min-h-screen items-center justify-center py-16">
        <div className="max-w-sm space-y-2 text-center">
          <h1 className="text-xl font-semibold text-theme-primary">This quote link is invalid</h1>
          <p className="text-sm text-theme-muted">
            {expired
              ? "This quotation has expired. Contact your WayTara advisor for a new one."
              : "It may be incorrect. Contact your WayTara advisor for the right link."}
          </p>
        </div>
      </div>
    );
  }

  if (alreadyResponded) {
    const copy = RESPONDED_COPY[quotation.status] ?? {
      title: "This quote isn't open for a response",
      body: "Contact your WayTara advisor if you have questions.",
    };
    return (
      <div className="fluid-container flex min-h-screen items-center justify-center py-16">
        <div className="max-w-sm space-y-2 text-center">
          <h1 className="text-xl font-semibold text-theme-primary">{copy.title}</h1>
          <p className="text-sm text-theme-muted">{copy.body}</p>
        </div>
      </div>
    );
  }

  const lines = (quotation.pricing_breakdown as unknown as PricingLineItem[] | null) ?? [];

  return (
    <div className="fluid-container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-theme-primary">Your WayTara Quotation</h1>
          <p className="mt-1 text-sm text-theme-muted">
            Prepared for {quotation.lead?.full_name ?? "you"} · {quotation.lead?.email}
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-theme-border bg-theme-alert-subtle px-4 py-3 text-sm text-theme-alert">
            {error}
          </div>
        ) : null}

        <div className="rounded-xl border border-theme-border bg-theme-surface p-5">
          <h2 className="text-sm font-semibold text-theme-primary">Hardware &amp; installation</h2>
          <div className="mt-3 space-y-2 text-sm">
            {lines.map((line, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-theme-secondary">
                  {line.description} {line.qty > 1 ? `× ${line.qty}` : ""}
                </span>
                <span className="text-theme-primary">₹{Number(line.amount).toLocaleString("en-IN")}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-theme-border pt-2">
              <span className="text-theme-secondary">Software plan ({quotation.plan?.name ?? "—"}, one-time)</span>
              <span className="text-theme-primary">
                ₹{Number(quotation.plan?.price_monthly ?? 0).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 border-t border-theme-border pt-4 text-sm">
            <div className="flex items-center justify-between text-theme-secondary">
              <span>Subtotal</span>
              <span>₹{Number(quotation.subtotal_amount ?? 0).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex items-center justify-between text-theme-secondary">
              <span>GST ({quotation.gst_rate}%)</span>
              <span>₹{Number(quotation.gst_amount ?? 0).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex items-center justify-between border-t border-theme-border pt-2 text-base font-semibold text-theme-primary">
              <span>Grand total</span>
              <span>₹{Number(quotation.total_amount).toLocaleString("en-IN")}</span>
            </div>
          </div>

          {quotation.valid_until && (
            <p className="mt-3 text-xs text-theme-muted">
              Valid until {new Date(quotation.valid_until).toLocaleDateString("en-IN")}
            </p>
          )}
        </div>

        <QuoteResponseForm token={token} totalAmount={Number(quotation.total_amount)} />
      </div>
    </div>
  );
}
