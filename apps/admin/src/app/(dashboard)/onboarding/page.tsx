import Link from "next/link";
import { createClient } from "@waytara/supabase/server";
import { cn } from "@waytara/ui/cn";
import { RealtimeRefresh } from "@/components/realtime-refresh";

const STAGE_STYLES: Record<string, string> = {
  quotation_sent: "bg-accent text-accent-foreground",
  quotation_accepted: "bg-primary/15 text-primary",
  payment_pending: "bg-accent text-accent-foreground",
  account_created: "bg-primary/15 text-primary",
  site_setup: "bg-primary/15 text-primary",
  connection_test: "bg-primary/15 text-primary",
  install_scheduled: "bg-primary/15 text-primary",
  install_completed: "bg-primary text-primary-foreground",
};

// Deliberately one query, no role branching — RLS already scopes this to
// "everyone" for admin and "employee_id = self" for employee
// (onboarding_admin_all / onboarding_employee_own), same shape as
// apps/admin's Leads page. This page didn't exist before: the sidebar's
// "Onboarding" link pointed at this exact path and 404'd — the only way
// in was through a lead's own detail page linking to /onboarding/[id]
// directly.
export default async function OnboardingListPage() {
  const supabase = await createClient();

  const { data: records, error } = await supabase
    .from("customer_onboarding")
    .select("id, current_stage, updated_at, lead:leads(full_name, email)")
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      {/* Unfiltered — same reasoning as leads/page.tsx: "every record a
          role can see" has no single filter column, RLS already governs
          which UPDATE events this connection receives. */}
      <RealtimeRefresh table="customer_onboarding" event="UPDATE" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every customer moving through the pipeline. Admins see all of them, employees see the
          ones assigned to them.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Couldn&apos;t load onboarding records: {error.message}
        </div>
      ) : !records || records.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No onboarding records yet — they're created from a lead once a quotation goes out.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Last updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <Link href={`/onboarding/${record.id}`} className="font-medium hover:underline">
                      {record.lead?.full_name ?? "Unknown lead"}
                    </Link>
                    <div className="text-xs text-muted-foreground">{record.lead?.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        STAGE_STYLES[record.current_stage] ?? "bg-accent text-accent-foreground"
                      )}
                    >
                      {record.current_stage.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(record.updated_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
