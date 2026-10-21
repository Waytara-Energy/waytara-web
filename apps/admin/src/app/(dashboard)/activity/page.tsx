import { createClient } from "@waytara/supabase/server";
import { cn } from "@waytara/ui/cn";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Device activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Key changes, Wi-Fi edits, restarts, setting changes, Bluetooth access and going offline or online, most recent first. Last 200 entries.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterLink label="All sources" active={!source} href="/activity" />
        {SOURCES.map((s) => (
          <FilterLink key={s} label={s.replace("_", " ")} active={source === s} href={`/activity?source=${s}`} />
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">Couldn&apos;t load the activity: {error.message}</div>
      ) : !rows || rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">Nothing recorded {source ? "for this source" : "yet"}.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <details key={row.id} className="rounded-lg border border-border bg-card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium capitalize text-accent-foreground">{row.source?.replace("_", " ")}</span>
                <span className="font-medium">{row.summary}</span>
                <span className="text-muted-foreground">{row.equipment_id ? names.get(row.equipment_id) ?? "Device" : ""}</span>
                <span className="text-muted-foreground">
                  {row.actor_name ? `by ${row.actor_name}${row.actor_role ? ` (${row.actor_role.replace("_", " ")})` : ""}` : ""}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {row.at && new Date(row.at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-accent/50 p-3 text-xs">{JSON.stringify({ action: row.action, details: row.details, ip: row.ip }, null, 2)}</pre>
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
        active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {label}
    </a>
  );
}
