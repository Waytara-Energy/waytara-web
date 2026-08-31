import { createClient } from "@waytara/supabase/server";
import { cn } from "@waytara/ui/cn";

const ACTIONS = ["insert", "update", "delete"] as const;

const ACTION_STYLES: Record<string, string> = {
  insert: "bg-primary/15 text-primary",
  update: "bg-accent text-accent-foreground",
  delete: "bg-destructive/15 text-destructive",
};

// Admin-only route (enforced in proxy.ts). audit_admin_only already gave
// admin SELECT on audit_log — this is the reader Task 12.2 needed, RLS was
// already there.
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string }>;
}) {
  const { entity, action } = await searchParams;
  const supabase = await createClient();

  const { data: entityRows } = await supabase.from("audit_log").select("entity").limit(1000);
  const entities = Array.from(new Set((entityRows ?? []).map((r) => r.entity))).sort();

  let query = supabase
    .from("audit_log")
    .select("id, action, entity, entity_id, actor_role, changes, created_at, actor:profiles!audit_log_actor_id_fkey(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (entity) query = query.eq("entity", entity);
  if (action && (ACTIONS as readonly string[]).includes(action)) {
    query = query.eq("action", action as (typeof ACTIONS)[number]);
  }

  const { data: rows, error } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every insert, update, and delete on an audited table, most recent first. Last 200 entries.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-2">
          <FilterLink label="All entities" active={!entity} href="/audit" />
          {entities.map((e) => (
            <FilterLink key={e} label={e} active={entity === e} href={`/audit?entity=${e}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-l border-border pl-4">
          <FilterLink label="All actions" active={!action} href={entity ? `/audit?entity=${entity}` : "/audit"} />
          {ACTIONS.map((a) => (
            <FilterLink
              key={a}
              label={a}
              active={action === a}
              href={`/audit?action=${a}${entity ? `&entity=${entity}` : ""}`}
            />
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Couldn&apos;t load the audit log: {error.message}
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No audit entries {entity || action ? "match this filter" : "yet"}.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <details key={row.id} className="rounded-lg border border-border bg-card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                <span
                  className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", ACTION_STYLES[row.action] ?? "bg-accent")}
                >
                  {row.action}
                </span>
                <span className="font-medium">{row.entity}</span>
                <span className="text-xs text-muted-foreground">{row.entity_id?.slice(0, 8)}</span>
                <span className="text-muted-foreground">
                  by {row.actor?.full_name ?? row.actor?.email ?? "system"}
                  {row.actor_role ? ` (${row.actor_role})` : ""}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-accent/50 p-3 text-xs">
                {JSON.stringify(row.changes, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterLink({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <a
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-accent"
      )}
    >
      {label}
    </a>
  );
}
