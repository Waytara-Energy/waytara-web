import { ScrollText } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadError, PageHeader } from "@/components/page-kit";
import { QueryFilters } from "@/components/query-filters";
import { cn } from "@/lib/utils";

const ACTIONS = ["insert", "update", "delete"] as const;

const ACTION_STYLES: Record<string, string> = {
  insert: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  update: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  delete: "bg-red-500/15 text-red-700 dark:text-red-300",
};

// Admin-only route (enforced in proxy.ts). audit_admin_only already gave admin SELECT on audit_log: this is its reader.
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ entity?: string; action?: string }> }) {
  const { entity, action } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("id, action, entity, entity_id, actor_role, changes, created_at, actor:profiles!audit_log_actor_id_fkey(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (entity) query = query.eq("entity", entity);
  if (action && (ACTIONS as readonly string[]).includes(action)) query = query.eq("action", action as (typeof ACTIONS)[number]);

  // independent of each other: fetched together
  const [{ data: entityRows }, { data: rows, error }] = await Promise.all([supabase.from("audit_log").select("entity").limit(1000), query]);
  const entities = Array.from(new Set((entityRows ?? []).map((r) => r.entity))).sort();

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Every insert, update and delete on an audited table, most recent first. The last 200 entries." />

      <QueryFilters
        filters={[
          { key: "entity", all: "All entities", options: entities.map((e) => ({ value: e, label: e.replace(/_/g, " ") })) },
          { key: "action", all: "All actions", width: "w-40", options: ACTIONS.map((a) => ({ value: a, label: a })) },
        ]}
      />

      {error ? (
        <LoadError message={`Couldn't load the audit log: ${error.message}`} />
      ) : !rows || rows.length === 0 ? (
        <Card className="py-0">
          <EmptyState icon={ScrollText} title={entity || action ? "No entries match this filter" : "No entries yet"} />
        </Card>
      ) : (
        <Card className="gap-0 divide-y overflow-hidden py-0">
          {rows.map((row) => (
            <details key={row.id} className="group px-5 py-3.5 open:bg-muted/30">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm marker:hidden">
                <span className={cn("w-16 rounded-md px-2 py-0.5 text-center text-xs font-medium capitalize", ACTION_STYLES[row.action] ?? "bg-muted")}>{row.action}</span>
                <span className="font-medium capitalize">{row.entity.replace(/_/g, " ")}</span>
                <span className="font-mono text-xs text-muted-foreground">{row.entity_id?.slice(0, 8)}</span>
                <span className="text-muted-foreground">
                  by {row.actor?.full_name ?? row.actor?.email ?? "system"}
                  {row.actor_role ? ` (${row.actor_role.replace("_", " ")})` : ""}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto rounded-md border bg-background p-3 text-xs">{JSON.stringify(row.changes, null, 2)}</pre>
            </details>
          ))}
        </Card>
      )}
    </div>
  );
}
