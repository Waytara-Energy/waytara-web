import { createClient } from "@waytara/supabase/server";
import { Button } from "@/components/ui/button";
import { createMaintenanceTicket } from "./actions";

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: sites } = await supabase.from("sites").select("id, name").order("name");
  const { data: tickets } = await supabase
    .from("maintenance_tickets")
    .select("id, description, status, type, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Maintenance</h1>
        <p className="mt-1 text-sm text-theme-muted">Report an issue or request a scheduled visit.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-theme-border bg-theme-alert-subtle px-4 py-3 text-sm text-theme-alert">
          {error}
        </div>
      )}

      {sites && sites.length > 0 ? (
        <form action={createMaintenanceTicket} className="space-y-3 rounded-xl border border-theme-border bg-theme-surface p-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-theme-primary">Site</label>
            <select
              name="siteId"
              required
              className="h-10 w-full rounded-lg border border-theme-border bg-theme-bg px-3 text-sm text-theme-primary"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-theme-primary">Describe the issue</label>
            <textarea
              name="description"
              rows={3}
              required
              className="w-full rounded-lg border border-theme-border bg-theme-bg px-3 py-2 text-sm text-theme-primary"
              placeholder="e.g. Inverter display shows an error code."
            />
          </div>
          <Button type="submit" size="sm">
            Submit Request
          </Button>
        </form>
      ) : (
        <div className="rounded-xl border border-theme-border bg-theme-surface p-5 text-sm text-theme-muted">
          No sites set up yet — maintenance requests need a site to attach to.
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-theme-primary">Your requests</h2>
        {!tickets || tickets.length === 0 ? (
          <p className="text-sm text-theme-muted">No maintenance requests yet.</p>
        ) : (
          tickets.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-theme-border bg-theme-surface px-4 py-3 text-sm"
            >
              <span className="text-theme-primary">{t.description}</span>
              <span className="rounded-full bg-theme-highlight-subtle px-2 py-0.5 text-xs font-medium capitalize text-theme-highlight">
                {t.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
