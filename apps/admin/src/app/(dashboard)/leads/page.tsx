import Link from "next/link";
import { createClient } from "@waytara/supabase/server";
import { cn } from "@waytara/ui/cn";

const STATUSES = ["new", "assigned", "quoted", "converted", "lost"] as const;

const STATUS_STYLES: Record<string, string> = {
  new: "bg-accent text-accent-foreground",
  assigned: "bg-primary/15 text-primary",
  quoted: "bg-primary/15 text-primary",
  converted: "bg-primary text-primary-foreground",
  lost: "bg-destructive/15 text-destructive",
};

// Deliberately one query, no role branching: RLS already scopes this to
// "all leads" for admin and "assigned_to = self" for employee (see
// leads_admin_all / leads_employee_assigned policies). Adding a client-side
// filter here would just duplicate — and could drift from — what RLS
// actually enforces.
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select("id, full_name, email, phone, status, source, created_at, assigned_to, accepted_at, assignee:profiles!leads_assigned_to_fkey(full_name)")
    .order("created_at", { ascending: false });

  if (status && (STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status as (typeof STATUSES)[number]);
  }

  const { data: leads, error } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quote requests from the landing page. What you see here is scoped
          by your role — admins see every lead, employees see only leads
          assigned to them.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/leads"
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !status
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-accent"
          )}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/leads?status=${s}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
              status === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            {s}
          </Link>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Couldn&apos;t load leads: {error.message}
        </div>
      ) : !leads || leads.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No leads {status ? `with status "${status}"` : "yet"}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assigned to</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{lead.email}</div>
                    <div className="text-xs">{lead.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        STATUS_STYLES[lead.status] ?? "bg-accent text-accent-foreground"
                      )}
                    >
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.assignee?.full_name ?? "—"}
                    {lead.assigned_to && (
                      <span
                        className={cn(
                          "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          lead.accepted_at ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground"
                        )}
                      >
                        {lead.accepted_at ? "in progress" : "action needed"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.source}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString("en-IN", {
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
