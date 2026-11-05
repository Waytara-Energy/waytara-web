import { CheckCircle2, Inbox, Search, XCircle } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { LoadError, PageHeader, StatCard, StatGrid } from "@/components/page-kit";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { PartnersTable, type PartnerRow } from "./partners-table";

// Admin only (the proxy and the row-level rules both enforce it): one query, newest first.
export default async function PartnersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_applications")
    .select("id, company_name, contact_name, phone, email, states, services, status, created_at")
    .order("created_at", { ascending: false });

  const rows: PartnerRow[] = (data ?? []).map((p) => ({
    id: p.id,
    company_name: p.company_name,
    contact_name: p.contact_name,
    phone: p.phone,
    email: p.email,
    states: p.states,
    services: p.services,
    status: p.status,
    created_at: p.created_at,
  }));
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="partner_applications" event="INSERT" />
      <PageHeader title="Partners" description="Installers who applied from the Partner page. Review each one, add notes, and set its status." />

      {error ? (
        <LoadError message={`Couldn't load applications: ${error.message}`} />
      ) : (
        <>
          <StatGrid>
            <StatCard icon={Inbox} title="New" value={count("new")} detail="Not looked at yet" tone={count("new") > 0 ? "warn" : undefined} />
            <StatCard icon={Search} title="In review" value={count("in_review")} detail="Being looked at" />
            <StatCard icon={CheckCircle2} title="Approved" value={count("approved")} detail={`${rows.length} applications in all`} tone="good" />
            <StatCard icon={XCircle} title="Rejected" value={count("rejected")} detail="Not going ahead" />
          </StatGrid>
          <PartnersTable partners={rows} />
        </>
      )}
    </div>
  );
}
