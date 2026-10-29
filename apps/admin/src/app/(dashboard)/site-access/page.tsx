import { Building2, Search, UserCheck, Users } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, LoadError, PageHeader, StatCard, StatGrid, ToneBadge } from "@/components/page-kit";
import { cn } from "@/lib/utils";
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
  const withStaff = (sites ?? []).filter((s) => (assignedBySite.get(s.id) ?? []).length > 0).length;
  const loadError = sitesError ?? assignError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site access"
        description="Which employees and site engineers may work on which site, optionally until a date. They see that site's devices, readings and settings, can set up its monitoring unit and make its device keys, and nothing of any other site. Admins see every site already, and a customer sees their own."
      />

      <StatGrid>
        <StatCard icon={Building2} title="Sites" value={sites?.length ?? 0} detail={search ? "Matching your search" : "All sites"} />
        <StatCard icon={UserCheck} title="With staff assigned" value={withStaff} detail={`${(sites?.length ?? 0) - withStaff} with nobody yet`} />
        <StatCard icon={Users} title="Assignments" value={assignments?.length ?? 0} detail="Active, across all sites" />
        <StatCard icon={Users} title="Staff to assign" value={staff?.length ?? 0} detail="Active employees and site engineers" />
      </StatGrid>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={search} placeholder="Find a site by name" aria-label="Find a site" className="w-72 pl-8" />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
        {search ? (
          <Button asChild variant="ghost">
            <a href="/site-access">Clear</a>
          </Button>
        ) : null}
      </form>

      {loadError ? (
        <LoadError message={`Couldn't load the sites: ${loadError.message}`} />
      ) : !sites || sites.length === 0 ? (
        <Card className="py-0">
          <EmptyState icon={Building2} title={search ? "No site has that name" : "There are no sites yet"} />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {sites.length === SITE_LIMIT ? <p className="text-xs text-muted-foreground xl:col-span-2">Showing the first {SITE_LIMIT} sites. Use the search to find another.</p> : null}
          {sites.map((site) => {
            const here = assignedBySite.get(site.id) ?? [];
            const assignedIds = new Set(here.map((a) => a.staff_id));
            const candidates = (staff ?? []).filter((p) => !assignedIds.has(p.id));
            return (
              <Card key={site.id} className="gap-4">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{site.name}</CardTitle>
                    <p className="truncate text-xs text-muted-foreground">{customerName.get(site.customer_id) ?? "Customer"}</p>
                  </div>
                  <ToneBadge tone={here.length > 0 ? "good" : "neutral"}>{here.length === 0 ? "Nobody assigned" : `${here.length} assigned`}</ToneBadge>
                </CardHeader>

                <CardContent className="grid gap-4">
                  {here.length > 0 ? (
                    <ul className="divide-y rounded-lg border">
                      {here.map((a) => {
                        const person = staffById.get(a.staff_id);
                        const expired = a.expires_at !== null && isPast(a.expires_at);
                        return (
                          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {person?.full_name?.trim() || person?.email || "A person who is no longer active"}
                                {person ? <span className="ml-2 text-xs font-normal text-muted-foreground">{ROLE_LABEL[person.role] ?? person.role}</span> : null}
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
                  ) : null}

                  {candidates.length > 0 ? (
                    <ActionForm action={assignStaff} loading="Adding…" success="Added." className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
                      <input type="hidden" name="site_id" value={site.id} />
                      <div className="grid gap-2">
                        <Label>Add a person</Label>
                        <Select name="staff_id" required>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose…" />
                          </SelectTrigger>
                          <SelectContent>
                            {candidates.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {`${p.full_name?.trim() || p.email} · ${ROLE_LABEL[p.role] ?? p.role}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`until-${site.id}`}>Until (optional)</Label>
                        <Input id={`until-${site.id}`} type="date" name="until" min={today} />
                      </div>
                      <div className="grid gap-2 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <div className="grid gap-2">
                          <Label htmlFor={`note-${site.id}`}>Note (optional)</Label>
                          <Input id={`note-${site.id}`} name="note" maxLength={200} placeholder="For example: installation week" />
                        </div>
                        <FormSubmit pendingText="Adding…">Add</FormSubmit>
                      </div>
                    </ActionForm>
                  ) : (staff ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">There are no active employees or site engineers to add yet. Invite them on the Employees page.</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
