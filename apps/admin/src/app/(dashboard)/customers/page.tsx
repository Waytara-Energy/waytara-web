import { AlertCircle, CheckCircle2, Hourglass, UserCircle2 } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { LoadError, PageHeader, StatCard, StatGrid } from "@/components/page-kit";
import { CustomersTable, type CustomerRow } from "./customers-table";

/** Today in India (YYYY-MM-DD), the day a new subscription starts by default (a function, so a render never reads the time itself). */
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// Admin-only route (enforced in proxy.ts). customers.id is 1:1 with profiles.id, and profiles_self_or_admin only lets an admin read an arbitrary
// customer's profile row (an employee can't, the same gap the Leads detail page's own comment documents), so this page is for admins.
export default async function CustomersPage() {
  const supabase = await createClient();

  const [{ data: customers, error }, { data: onboardingRows }, { data: subscriptionRows }, { data: planRows }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, status, plan_started_at, created_at, profile:profiles!customers_id_fkey(full_name, email), plan:plans(name)")
      .order("created_at", { ascending: false }),
    supabase.from("customer_onboarding").select("id, customer_id"),
    supabase.from("subscriptions").select("id, customer_id, plan_id, status, current_period_end, created_at").order("created_at", { ascending: false }),
    supabase.from("plans").select("id, name, price_monthly").eq("is_active", true).order("price_monthly"),
  ]);
  // the latest subscription of each customer (the rows come newest first); the older ones are the history
  const latestSubscription = new Map<string, NonNullable<typeof subscriptionRows>[number]>();
  for (const s of subscriptionRows ?? []) if (!latestSubscription.has(s.customer_id)) latestSubscription.set(s.customer_id, s);
  const plans = (planRows ?? []).map((p) => ({ id: p.id, name: p.name, price: Number(p.price_monthly) }));
  const onboardingIdByCustomer = new Map((onboardingRows ?? []).map((o) => [o.customer_id, o.id]));

  const rows: CustomerRow[] = (customers ?? []).map((c) => {
    const sub = latestSubscription.get(c.id) ?? null;
    return {
      id: c.id,
      name: c.profile?.full_name ?? null,
      email: c.profile?.email ?? null,
      plan: c.plan?.name ?? null,
      status: c.status,
      created_at: c.created_at,
      onboardingId: onboardingIdByCustomer.get(c.id) ?? null,
      subscription: sub ? { id: sub.id, status: sub.status, planId: sub.plan_id, periodEnd: sub.current_period_end } : null,
    };
  });
  const subCount = (s: string) => rows.filter((r) => r.subscription?.status === s).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Every account with a customer profile, with its plan and subscription." />

      {error ? (
        <LoadError message={`Couldn't load customers: ${error.message}`} />
      ) : (
        <>
          <StatGrid>
            <StatCard icon={UserCircle2} title="Customers" value={rows.length} detail={`${rows.filter((r) => r.plan).length} on a plan`} />
            <StatCard icon={CheckCircle2} title="Active" value={subCount("active")} detail="Subscription running" tone="good" />
            <StatCard icon={Hourglass} title="On trial" value={subCount("trialing")} detail="Trial subscription" />
            <StatCard icon={AlertCircle} title="Payment due" value={subCount("past_due")} detail={`${rows.filter((r) => !r.subscription).length} with no subscription`} tone={subCount("past_due") > 0 ? "bad" : undefined} />
          </StatGrid>
          <CustomersTable rows={rows} plans={plans} today={todayIst()} />
        </>
      )}
    </div>
  );
}
