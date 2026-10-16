import { createClient } from "@waytara/supabase/server";
import { Input } from "@waytara/ui/input";
import { Button } from "@waytara/ui/button";
import { cn } from "@waytara/ui/cn";
import { ActionForm } from "@waytara/ui/action-form";
import { assignStaff, removeStaff } from "./actions";

// Admin-only route (enforced in proxy.ts). Who may work on which site: any number of employees and site engineers per site, each with an
// optional end date. An admin sees every site anyway; a customer sees their own. What a person added here can do is decided by the database
// (the can_access_site rule), the same one the dashboard and the readings service use.

const ROLE_LABEL: Record<string, string> = { employee: "Employee", site_engineer: "Site engineer" };
const SITE_LIMIT = 300;

const dayText = (ts: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(new Date(ts));
/** Has this time passed? (a helper, so the page itself stays free of clock reads) */
const isPast = (ts: string) => new Date(ts).getTime() <= Date.now();
const todayIst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export default async function SiteAccessPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const search = (q ?? "").trim().slice(0, 60);
  const supabase = await createClient();

  let siteQuery = supabase.from("sites").select("id, name, customer_id, created_at").order("name", { ascending: true }).limit(SITE_LIMIT);
  if (search) siteQuery = siteQuery.ilike("name", `%${search.replace(/[%_]/g, " ")}%`);

  const [{ data: sites, error: sitesError }, { data: staff }, { data: assignments, error: assignError }] = await Promise.all([
    siteQuery,
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["employee", "site_engineer"])
      .is("deactivated_at", null)
      .is("deleted_at", null)
      .order("full_name", { ascending: true }),
    supabase.from("site_staff").select("id, site_id, staff_id, expires_at, note, granted_at").is("removed_at", null).order("granted_at", { ascending: true }),
  ]);

  const customerIds = [...new Set((sites ?? []).map((s) => s.customer_id))];
  const { data: customers } = customerIds.length > 0 ? await supabase.from("profiles").select("id, full_name, email").in("id", customerIds) : { data: [] };
  const customerName = new Map((customers ?? []).map((c) => [c.id, c.full_name?.trim() || c.email || "Customer"]));
  const staffById = new Map((staff ?? []).map((p) => [p.id, p]));
  const assignedBySite = new Map<string, NonNullable<typeof assignments>>();
  for (const a of assignments ?? []) {
    const list = assignedBySite.get(a.site_id) ?? [];
    list.push(a);
    assignedBySite.set(a.site_id, list);
  }

  const today = todayIst();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Site access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Which employees and site engineers may work on which site. Add as many as you need to a site, optionally until a date. They see that site&apos;s
          devices, readings and settings, can set up its monitoring unit and make its device keys, and nothing of any other site. Admins see every site
          already, and a customer sees their own.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="q">
            Find a site
          </label>
          <Input id="q" name="q" defaultValue={search} placeholder="Site name" className="h-9 w-64" />
        </div>
        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
      </form>

      {sitesError || assignError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Couldn&apos;t load the sites: {(sitesError ?? assignError)?.message}
        </div>
      ) : !sites || sites.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">{search ? "No site has that name." : "There are no sites yet."}</div>
      ) : (
        <div className="space-y-4">
          {sites.length === SITE_LIMIT && <p className="text-xs text-muted-foreground">Showing the first {SITE_LIMIT} sites. Use the search to find another.</p>}
          {sites.map((site) => {
            const here = assignedBySite.get(site.id) ?? [];
            const assignedIds = new Set(here.map((a) => a.staff_id));
            const candidates = (staff ?? []).filter((p) => !assignedIds.has(p.id));
            return (
              <section key={site.id} className="rounded-lg border border-border bg-card">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">{site.name}</h2>
                  <p className="text-xs text-muted-foreground">{customerName.get(site.customer_id) ?? "Customer"}</p>
                </div>

                <div className="space-y-3 px-4 py-3">
                  {here.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No employee or site engineer is assigned to this site.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {here.map((a) => {
                        const person = staffById.get(a.staff_id);
                        const expired = a.expires_at !== null && isPast(a.expires_at);
                        return (
                          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {person?.full_name?.trim() || person?.email || "A person who is no longer active"}
                                {person && <span className="ml-2 text-xs font-normal text-muted-foreground">{ROLE_LABEL[person.role] ?? person.role}</span>}
                              </p>
                              <p className={cn("text-xs", expired ? "text-destructive" : "text-muted-foreground")}>
                                {a.expires_at ? (expired ? `Ended ${dayText(a.expires_at)}` : `Until ${dayText(a.expires_at)}`) : "No end date"}
                                {a.note ? ` · ${a.note}` : ""}
                              </p>
                            </div>
                            <ActionForm action={removeStaff.bind(null, a.id)} loading="Removing…" success="Removed.">
                              <Button type="submit" size="sm" variant="ghost">
                                Remove
                              </Button>
                            </ActionForm>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {candidates.length > 0 ? (
                    <ActionForm action={assignStaff} loading="Adding…" success="Added." className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                      <input type="hidden" name="site_id" value={site.id} />
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Add a person</label>
                        <select name="staff_id" required defaultValue="" className="h-9 w-64 rounded-md border border-border bg-background px-2 text-sm">
                          <option value="" disabled>
                            Choose…
                          </option>
                          {candidates.map((p) => (
                            <option key={p.id} value={p.id}>
                              {(p.full_name?.trim() || p.email) + " · " + (ROLE_LABEL[p.role] ?? p.role)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Until (optional)</label>
                        <Input type="date" name="until" min={today} className="h-9 w-40" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
                        <Input name="note" maxLength={200} placeholder="For example: installation week" className="h-9 w-56" />
                      </div>
                      <Button type="submit" size="sm">
                        Add
                      </Button>
                    </ActionForm>
                  ) : (
                    (staff ?? []).length === 0 && <p className="border-t border-border pt-3 text-xs text-muted-foreground">There are no active employees or site engineers to add yet (invite them on the Employees page).</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
