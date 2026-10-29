import { History } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadError, PageHeader } from "@/components/page-kit";
import { QueryFilters } from "@/components/query-filters";

const SOURCES = ["setup_page", "bluetooth", "dashboard", "admin", "hub", "board", "system"] as const;

// Who did what to a monitoring unit and its site (task T9 of docs/GATEWAY_V3_TASKS.md). Admins see every device; an employee sees the sites they
// are assigned to (the row level security of the view decides, this page adds no rule of its own).
export default async function DeviceActivityPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const { source } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("device_activity_log")
    .select("id, at, equipment_id, actor_name, actor_role, source, action, summary, details, ip")
    .order("at", { ascending: false })
    .limit(200);
  if (source && (SOURCES as readonly string[]).includes(source)) query = query.eq("source", source);
  const { data: rows, error } = await query;

  // the device names, for the rows that have a device
  const ids = Array.from(new Set((rows ?? []).map((r) => r.equipment_id).filter((v): v is string => !!v)));
  const { data: devices } = ids.length > 0 ? await supabase.from("equipment").select("id, label, site:sites(name)").in("id", ids) : { data: [] };
  const names = new Map((devices ?? []).map((d) => [d.id, `${d.label?.trim() || "Device"} · ${(d.site as { name?: string | null } | null)?.name ?? "site"}`]));

  return (
    <div className="space-y-6">
      <PageHeader title="Device activity" description="Key changes, Wi-Fi edits, restarts, setting changes, Bluetooth access, and going offline or online. The last 200 entries, most recent first." />

      <QueryFilters filters={[{ key: "source", all: "All sources", options: SOURCES.map((s) => ({ value: s, label: s.replace("_", " ") })) }]} />

      {error ? (
        <LoadError message={`Couldn't load the activity: ${error.message}`} />
      ) : !rows || rows.length === 0 ? (
        <Card className="py-0">
          <EmptyState icon={History} title={source ? "Nothing recorded for this source" : "Nothing recorded yet"} />
        </Card>
      ) : (
        <Card className="gap-0 divide-y overflow-hidden py-0">
          {rows.map((row) => (
            <details key={row.id} className="px-5 py-3.5 open:bg-muted/30">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm marker:hidden">
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">{row.source?.replace("_", " ")}</span>
                <span className="font-medium">{row.summary}</span>
                <span className="text-muted-foreground">{row.equipment_id ? (names.get(row.equipment_id) ?? "Device") : ""}</span>
                <span className="text-muted-foreground">{row.actor_name ? `by ${row.actor_name}${row.actor_role ? ` (${row.actor_role.replace("_", " ")})` : ""}` : ""}</span>
                <span className="ml-auto text-xs text-muted-foreground">{row.at && new Date(row.at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto rounded-md border bg-background p-3 text-xs">{JSON.stringify({ action: row.action, details: row.details, ip: row.ip }, null, 2)}</pre>
            </details>
          ))}
        </Card>
      )}
    </div>
  );
}
