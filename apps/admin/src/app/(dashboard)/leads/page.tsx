import { CheckCircle2, FileText, Hourglass, Inbox } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { LoadError, PageHeader, StatCard, StatGrid } from "@/components/page-kit";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { LeadsTable, type LeadRow } from "./leads-table";

// Deliberately one query, no role branching: RLS already scopes this to "all leads" for admin and "assigned_to = self" for employee (see
// leads_admin_all / leads_employee_assigned policies). Adding a client-side filter here would just duplicate (and could drift from) what RLS
// actually enforces.
export default async function LeadsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name, email, phone, status, source, created_at, assigned_to, accepted_at, assignee:profiles!leads_assigned_to_fkey(full_name)")
    .order("created_at", { ascending: false });

  const leads: LeadRow[] = (data ?? []).map((l) => ({
    id: l.id,
    full_name: l.full_name,
    email: l.email,
    phone: l.phone,
    status: l.status,
    source: l.source,
    created_at: l.created_at,
    assigned_to: l.assigned_to,
    accepted_at: l.accepted_at,
    assignee_name: l.assignee?.full_name ?? null,
  }));
  const count = (s: string) => leads.filter((l) => l.status === s).length;
  const waiting = leads.filter((l) => l.assigned_to && !l.accepted_at).length;

  return (
    <div className="space-y-6">
      {/* Unfiltered on purpose: "every lead a role can see" has no single column to filter a realtime channel by (admin sees all, employee sees
          only assigned), and RLS already governs which INSERT events this connection is even allowed to receive. */}
      <RealtimeRefresh table="leads" event="INSERT" />
      <PageHeader title="Leads" description="Quote requests from the landing page. Admins see every lead; employees see only the leads assigned to them." />

      {error ? (
        <LoadError message={`Couldn't load leads: ${error.message}`} />
      ) : (
        <>
          <StatGrid>
            <StatCard icon={Inbox} title="New" value={count("new")} detail="Not assigned yet" tone={count("new") > 0 ? "warn" : undefined} />
            <StatCard icon={Hourglass} title="Waiting for action" value={waiting} detail="Assigned, not yet picked up" tone={waiting > 0 ? "warn" : undefined} />
            <StatCard icon={FileText} title="Quoted" value={count("quoted")} detail="A quotation is out" />
            <StatCard icon={CheckCircle2} title="Converted" value={count("converted")} detail={`${leads.length} leads in all`} tone="good" />
          </StatGrid>
          <LeadsTable leads={leads} />
        </>
      )}
    </div>
  );
}
