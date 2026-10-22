import Link from "next/link";
import { createClient } from "@waytara/supabase/server";
import { cn } from "@waytara/ui/cn";
import { SubscriptionControls } from "./subscription-controls";

/** Today in India (YYYY-MM-DD), the day a new subscription starts by default (a function, so a render never reads the time itself). */
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null);

const SUBSCRIPTION_LABEL: Record<string, string> = { trialing: "Trial", active: "Active", past_due: "Payment due", cancelled: "Cancelled" };

const STATUS_STYLES: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  trialing: "bg-accent text-accent-foreground",
  past_due: "bg-destructive/15 text-destructive",
  cancelled: "bg-destructive/15 text-destructive",
};

// Admin-only route (enforced in proxy.ts) — customers.id is 1:1 with
// profiles.id, and profiles_self_or_admin only lets admin read an
// arbitrary customer's profile row (an employee can't, same gap the
// Leads detail page's own comment already documents), so this page
// avoids that wall entirely rather than working around it per-row.
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
  const today = todayIst();
  const onboardingIdByCustomer = new Map((onboardingRows ?? []).map((o) => [o.customer_id, o.id]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every account with a customer profile.</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Couldn&apos;t load customers: {error.message}
        </div>
      ) : !customers || customers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No customer accounts yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Subscription</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c) => {
                const onboardingId = onboardingIdByCustomer.get(c.id);
                const sub = latestSubscription.get(c.id) ?? null;
                return (
                  <tr key={c.id} className="hover:bg-accent/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.profile?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.profile?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.plan?.name ?? "None"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          STATUS_STYLES[c.status] ?? "bg-accent text-accent-foreground"
                        )}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {sub ? (
                        <>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[sub.status] ?? "bg-accent text-accent-foreground")}>{SUBSCRIPTION_LABEL[sub.status] ?? sub.status}</span>
                          {day(sub.current_period_end) && <div className="mt-1 text-xs text-muted-foreground">until {day(sub.current_period_end)}</div>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-1.5">
                        <SubscriptionControls customerId={c.id} customerName={c.profile?.full_name ?? c.profile?.email ?? "this customer"} plans={plans} today={today} current={sub ? { id: sub.id, status: sub.status, planId: sub.plan_id } : null} />
                        {onboardingId && (
                          <Link href={`/onboarding/${onboardingId}`} className="text-xs text-muted-foreground hover:text-primary hover:underline">
                            View onboarding
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
