import Link from "next/link";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { Button } from "@waytara/ui/button";
import { assignLead, startOnboarding } from "./actions";

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: actionError } = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("*, assignee:profiles!leads_assigned_to_fkey(id, full_name)")
    .eq("id", id)
    .single();

  if (error || !lead) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Couldn&apos;t load this lead{profile?.role !== "admin" ? " — it may not be assigned to you" : ""}.
        {error ? ` (${error.message})` : ""}
      </div>
    );
  }

  const isAdmin = profile?.role === "admin";
  const isAssignedEmployee = lead.assigned_to === profile?.id;

  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .select("id, current_stage, employee_id")
    .eq("lead_id", id)
    .maybeSingle();

  // Assignment history — reuses the existing audit_log trigger on `leads`
  // rather than a dedicated history table. RLS restricts audit_log to
  // admins only (audit_admin_only policy), so this section is skipped
  // entirely for employees rather than erroring.
  let auditEntries: { created_at: string; changes: unknown }[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("audit_log")
      .select("created_at, changes")
      .eq("entity", "leads")
      .eq("entity_id", id)
      .order("created_at", { ascending: false });
    auditEntries = data ?? [];
  }

  let employees: { id: string; full_name: string | null; email: string }[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "employee")
      .order("full_name");
    employees = data ?? [];
  }

  const canStartOnboarding = (isAdmin || isAssignedEmployee) && !onboarding;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/leads" className="text-xs text-muted-foreground hover:underline">
          ← Back to Leads
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{lead.full_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground capitalize">
          {lead.status} · via {lead.source}
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Submission</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd>{lead.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd>{lead.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Address</dt>
            <dd>
              {lead.address && typeof lead.address === "object"
                ? Object.values(lead.address as Record<string, unknown>).filter(Boolean).join(", ")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Received</dt>
            <dd>{new Date(lead.created_at).toLocaleString("en-IN")}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Message</dt>
            <dd className="whitespace-pre-wrap">{lead.message ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Assignment</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Currently assigned to: {lead.assignee?.full_name ?? "Unassigned"}
        </p>

        {isAdmin && (
          <form action={assignLead.bind(null, lead.id)} className="mt-3 flex items-center gap-2">
            <select
              name="employeeId"
              defaultValue={lead.assigned_to ?? ""}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              required
            >
              <option value="" disabled>
                Select an employee…
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name ?? e.email}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              Assign
            </Button>
          </form>
        )}

        {isAdmin && auditEntries.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              History
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {auditEntries.map((entry, i) => {
                const changes = entry.changes as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
                const before = changes?.before?.assigned_to;
                const after = changes?.after?.assigned_to;
                if (before === after) return null;
                return (
                  <li key={i}>
                    {new Date(entry.created_at).toLocaleString("en-IN")} — assigned_to changed
                    {after ? " to a new employee" : " (cleared)"}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Onboarding</h2>
        {onboarding ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Onboarding started — currently at stage{" "}
            <span className="font-medium capitalize">
              {onboarding.current_stage.replace(/_/g, " ")}
            </span>
            .{" "}
            <Link href={`/onboarding/${onboarding.id}`} className="text-primary hover:underline">
              Open pipeline →
            </Link>
          </p>
        ) : canStartOnboarding ? (
          <form action={startOnboarding.bind(null, lead.id)} className="mt-2">
            <Button type="submit" size="sm">
              Start Onboarding
            </Button>
          </form>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin || isAssignedEmployee
              ? "Not started."
              : "Only the assigned employee or an admin can start onboarding."}
          </p>
        )}
      </div>
    </div>
  );
}
