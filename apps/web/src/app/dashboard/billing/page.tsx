import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";

export default async function BillingPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: customer } = profile
    ? await supabase
        .from("customers")
        .select("status, plan_started_at, plan:plans(name, price_monthly, price_yearly)")
        .eq("id", profile.id)
        .maybeSingle()
    : { data: null };

  const { data: subscription } = profile
    ? await supabase
        .from("subscriptions")
        .select("status, current_period_start, current_period_end")
        .eq("customer_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: payments } = await supabase
    .from("payments")
    .select("id, payment_type, amount, status, paid_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Billing &amp; Plan</h1>
      </div>

      <div className="rounded-xl border border-theme-border bg-theme-surface p-5">
        <h2 className="text-sm font-semibold text-theme-primary">Current Plan</h2>
        {customer?.plan ? (
          <div className="mt-2 text-sm">
            <p className="text-theme-primary">
              {customer.plan.name} — ₹{customer.plan.price_monthly}/mo
            </p>
            <p className="text-theme-muted">
              Active since{" "}
              {customer.plan_started_at
                ? new Date(customer.plan_started_at).toLocaleDateString("en-IN")
                : "—"}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-theme-muted">No plan assigned yet.</p>
        )}
      </div>

      <div className="rounded-xl border border-theme-border bg-theme-surface p-5">
        <h2 className="text-sm font-semibold text-theme-primary">Subscription</h2>
        <p className="mt-2 text-sm text-theme-muted">
          {subscription ? (
            <span className="capitalize">{subscription.status}</span>
          ) : (
            "No subscription record yet."
          )}
        </p>
      </div>

      <div className="rounded-xl border border-theme-border bg-theme-surface p-5">
        <h2 className="text-sm font-semibold text-theme-primary">Payment History</h2>
        {!payments || payments.length === 0 ? (
          <p className="mt-2 text-sm text-theme-muted">No payments yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="capitalize text-theme-primary">
                  {p.payment_type} — ₹{Number(p.amount).toLocaleString("en-IN")}
                </span>
                <span className="rounded-full bg-theme-highlight-subtle px-2 py-0.5 text-xs font-medium capitalize text-theme-highlight">
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
