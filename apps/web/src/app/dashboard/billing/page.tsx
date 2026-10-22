import { createClient } from "@waytara/supabase/server";
import { getRequestProfile } from "@/lib/request-profile";
import { periodProgress, summarisePayments, type PaymentRow } from "@/lib/billing-summary";
import { BillingBoard, type BillingPlan, type BillingSubscription } from "@/components/dashboard/billing-board";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";

/** The server's clock for how far into the subscription period it is (a function, so a render never reads the time itself). */
const serverNow = () => Date.now();

// Billing & Plan, in the same shape as Performance and Maintenance (a headline, then tabs): Plan and Payments. The page reads three
// things that do not depend on each other, together; `payments` relies on RLS to scope to this customer, with a limit so a very
// long-lived account cannot turn this into an unbounded fetch.
export default async function BillingPage() {
  const profile = await getRequestProfile();
  const supabase = await createClient();

  const [{ data: customer }, { data: subscription }, { data: paymentRows }] = await Promise.all([
    profile
      ? supabase
          .from("customers")
          .select("status, plan_started_at, plan:plans(name, price_monthly, price_yearly)")
          .eq("id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    profile
      ? supabase
          .from("subscriptions")
          .select("status, current_period_start, current_period_end")
          .eq("customer_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("payments")
      .select("id, payment_type, amount, status, method, paid_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const payments: PaymentRow[] = paymentRows ?? [];
  const plan: BillingPlan | null = customer?.plan ? { name: customer.plan.name, price: Number(customer.plan.price_monthly), since: customer.plan_started_at, accountStatus: customer.status } : null;
  const sub: BillingSubscription | null = subscription
    ? { status: subscription.status, start: subscription.current_period_start, end: subscription.current_period_end, progress: periodProgress(subscription.current_period_start, subscription.current_period_end, serverNow()) }
    : null;

  return (
    <>
      {profile && <RealtimeRefresh table="payments" event="UPDATE" filter={`customer_id=eq.${profile.id}`} />}
      <BillingBoard plan={plan} subscription={sub} payments={payments} summary={summarisePayments(payments)} />
    </>
  );
}
