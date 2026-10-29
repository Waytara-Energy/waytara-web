import { CalendarClock, CheckCircle2, CreditCard, Workflow } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { LoadError, PageHeader, StatCard, StatGrid } from "@/components/page-kit";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { OnboardingTable, type OnboardingRow } from "./onboarding-table";

// Deliberately one query, no role branching: RLS already scopes this to "everyone" for admin and "employee_id = self" for employee
// (onboarding_admin_all / onboarding_employee_own), the same shape as the Leads page.
export default async function OnboardingListPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("customer_onboarding").select("id, current_stage, updated_at, lead:leads(full_name, email)").order("updated_at", { ascending: false });

  const rows: OnboardingRow[] = (data ?? []).map((r) => ({ id: r.id, stage: r.current_stage, updated_at: r.updated_at, name: r.lead?.full_name ?? null, email: r.lead?.email ?? null }));
  const count = (...stages: string[]) => rows.filter((r) => stages.includes(r.stage)).length;
  const inProgress = rows.length - count("install_completed");

  return (
    <div className="space-y-6">
      {/* Unfiltered: same reasoning as the Leads page: "every record a role can see" has no single filter column, RLS already governs which UPDATE
          events this connection receives. */}
      <RealtimeRefresh table="customer_onboarding" event="UPDATE" />
      <PageHeader title="Onboarding" description="Every customer moving through the pipeline, from quotation to a finished install. Admins see all of them; employees see the ones assigned to them." />

      {error ? (
        <LoadError message={`Couldn't load onboarding records: ${error.message}`} />
      ) : (
        <>
          <StatGrid>
            <StatCard icon={Workflow} title="In the pipeline" value={inProgress} detail={`${rows.length} customers in all`} />
            <StatCard icon={CreditCard} title="Waiting for payment" value={count("quotation_accepted", "payment_pending")} detail="Accepted, not paid yet" tone={count("quotation_accepted", "payment_pending") > 0 ? "warn" : undefined} />
            <StatCard icon={CalendarClock} title="Being installed" value={count("site_setup", "connection_test", "install_scheduled")} detail="Site setup, testing or scheduled" />
            <StatCard icon={CheckCircle2} title="Completed" value={count("install_completed")} detail="Installed and handed over" tone="good" />
          </StatGrid>
          <OnboardingTable rows={rows} />
        </>
      )}
    </div>
  );
}
