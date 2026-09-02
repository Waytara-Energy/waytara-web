import Link from "next/link";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { cn } from "@waytara/ui/cn";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-destructive/10 text-destructive",
  in_progress: "bg-primary/10 text-primary",
  resolved: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
};

// No manual customer/employee filter here — same "RLS scopes it, not the
// query" pattern as everywhere else in this app. An admin's
// support_tickets_admin_all policy returns every ticket; an employee's
// support_tickets_employee_assigned_select policy already restricts this
// same query to only the customers assigned to them via
// customer_onboarding.employee_id.
export default async function SupportPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, subject, status, updated_at, customer_id")
    .order("updated_at", { ascending: false });

  // Not a `customers -> profiles` join: profiles_self_or_admin RLS only
  // lets admin read an arbitrary customer's profile row — an employee
  // can't, same documented gap as the Leads/Customers/Onboarding detail
  // pages. customer_onboarding -> leads carries the same name/email and
  // *is* RLS-visible to the employee assigned to it, so use that instead
  // of adding another policy just to duplicate a value already on hand.
  const customerIds = Array.from(new Set((tickets ?? []).map((t) => t.customer_id)));
  const nameByCustomer = new Map<string, string>();
  if (customerIds.length > 0) {
    const { data: onboardingRows } = await supabase
      .from("customer_onboarding")
      .select("customer_id, lead_id")
      .in("customer_id", customerIds);
    const leadIdByCustomer = new Map(
      (onboardingRows ?? []).filter((o) => o.customer_id).map((o) => [o.customer_id as string, o.lead_id])
    );
    const leadIds = Array.from(new Set(leadIdByCustomer.values()));
    if (leadIds.length > 0) {
      const { data: leads } = await supabase.from("leads").select("id, full_name, email").in("id", leadIds);
      const leadById = new Map((leads ?? []).map((l) => [l.id, l]));
      for (const [customerId, leadId] of leadIdByCustomer) {
        const lead = leadById.get(leadId);
        if (lead) nameByCustomer.set(customerId, lead.full_name || lead.email);
      }
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile?.role === "admin"
            ? "Every support ticket across all customers."
            : "Tickets from customers assigned to you."}
        </p>
      </div>

      {!tickets || tickets.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          No support tickets right now.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/support/${t.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 text-sm transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{t.subject}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {nameByCustomer.get(t.customer_id) ?? "Customer"} · Updated{" "}
                  {new Date(t.updated_at).toLocaleDateString("en-IN")}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                  STATUS_STYLES[t.status] ?? "bg-muted text-muted-foreground"
                )}
              >
                {t.status.replace(/_/g, " ")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
