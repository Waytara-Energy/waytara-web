import Link from "next/link";
import { ArrowRight, Bell, CheckCircle2, IndianRupee, Inbox, LifeBuoy, Users, Wifi } from "lucide-react";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatCard, StatGrid, ToneBadge } from "@/components/page-kit";
import { loadAdminAlerts } from "@/lib/admin-alerts";
import { summarizeUnits, stockLevel, type StockRow } from "../devices/stock-types";
import { LEAD_STATUSES, STAGES } from "@/lib/pipeline";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** The first day of this month in India (YYYY-MM-01), where the month's collections start. */
function monthStartIst(): string {
  return `${new Date(Date.now() + 19_800_000).toISOString().slice(0, 7)}-01`;
}

/** How long ago, in a few words. */
function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

function Bars({ rows, empty }: { rows: { label: string; n: number; tone?: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (rows.every((r) => r.n === 0)) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="grid gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground">{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <span className={`block h-full rounded-full ${r.tone ?? "bg-primary"}`} style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-mr-2 text-muted-foreground">
      <Link href={href}>
        {children}
        <ArrowRight />
      </Link>
    </Button>
  );
}

// The staff dashboard's front page: what needs attention now, and how the business is doing, from the same data the other pages show. Everything is
// read as the signed-in person is allowed to see it (row-level security): an employee's figures are their own leads, onboardings and sites. The
// sections about money, customers and stock are for admins.
export default async function OverviewPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = profile?.role === "admin";
  const monthStart = monthStartIst();

  const [alerts, leadRows, onboardingRows, ticketRows, deviceRows, activeAlerts, customers, activeSubs, payments, modelRows, unitRows, audit, activity] = await Promise.all([
    loadAdminAlerts(supabase, profile?.role),
    supabase.from("leads").select("status"),
    supabase.from("customer_onboarding").select("current_stage"),
    supabase.from("support_tickets").select("status, assigned_to, unread_staff").neq("status", "closed").limit(1000),
    supabase.from("equipment_status").select("status").limit(3000),
    supabase.from("alerts").select("severity", { count: "exact" }).is("resolved_at", null).is("acknowledged_at", null),
    isAdmin ? supabase.from("customers").select("id", { count: "exact", head: true }) : null,
    isAdmin ? supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "trialing"]) : null,
    isAdmin ? supabase.from("payments").select("amount").eq("status", "paid").gte("paid_at", monthStart).limit(2000) : null,
    isAdmin ? supabase.from("equipment_inventory").select("id, name, reorder_level") : null,
    isAdmin ? supabase.from("stock_units").select("model_id, status, quantity, remaining") : null,
    isAdmin ? supabase.from("audit_log").select("id, action, entity, created_at, actor:profiles!audit_log_actor_id_fkey(full_name, email)").order("created_at", { ascending: false }).limit(7) : null,
    !isAdmin ? supabase.from("device_activity_log").select("id, at, summary, actor_name").order("at", { ascending: false }).limit(7) : null,
  ]);

  const leads = leadRows.data ?? [];
  const leadCount = (s: string) => leads.filter((l) => l.status === s).length;
  const stageCount = (s: string) => (onboardingRows.data ?? []).filter((o) => o.current_stage === s).length;
  const inPipeline = (onboardingRows.data ?? []).length - stageCount("install_completed");

  const tickets = ticketRows.data ?? [];
  const unassigned = tickets.filter((t) => !t.assigned_to && t.status !== "resolved").length;
  const mine = tickets.filter((t) => t.assigned_to === profile?.id).length;
  const unread = tickets.filter((t) => t.unread_staff > 0).length;

  const devices = deviceRows.data ?? [];
  const devCount = (s: string) => devices.filter((d) => d.status === s).length;
  const online = devCount("online");
  const offline = devices.length - online - devCount("device_unreachable");

  const activeAlertCount = activeAlerts.count ?? 0;
  const criticalAlerts = (activeAlerts.data ?? []).filter((a) => a.severity === "critical").length;
  const revenue = (payments?.data ?? []).reduce((n, p) => n + Number(p.amount), 0);

  // stock (admins): what is on the shelf and which models need ordering
  const unitsByModel = new Map<string, { status: string; quantity: number; remaining: number }[]>();
  for (const u of unitRows?.data ?? []) unitsByModel.set(u.model_id, [...(unitsByModel.get(u.model_id) ?? []), u]);
  const stock = (modelRows?.data ?? []).map((m) => {
    const sum = summarizeUnits(unitsByModel.get(m.id) ?? []);
    return { name: m.name, sum, level: stockLevel(m as Pick<StockRow, "reorder_level">, sum.available) };
  });
  const reorder = stock.filter((s) => s.level !== "ok");
  const available = stock.reduce((n, s) => n + s.sum.available, 0);

  const name = profile?.full_name?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${name}`} description={`${today}. Here is what needs you, and how things stand.`} />

      <StatGrid className="xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard icon={Inbox} title="New leads" value={leadCount("new")} detail={`${leads.length} leads in all`} tone={leadCount("new") > 0 ? "warn" : undefined} />
        <StatCard icon={Users} title="In onboarding" value={inPipeline} detail={`${stageCount("install_completed")} completed`} />
        <StatCard icon={LifeBuoy} title="Open tickets" value={tickets.length} detail={`${unassigned} unassigned · ${unread} with new messages`} tone={unassigned > 0 ? "warn" : undefined} />
        <StatCard icon={Bell} title="Active alerts" value={activeAlertCount} detail={criticalAlerts > 0 ? `${criticalAlerts} critical` : "None critical"} tone={criticalAlerts > 0 ? "bad" : activeAlertCount > 0 ? "warn" : "good"} />
        <StatCard icon={Wifi} title="Devices online" value={`${online} / ${devices.length}`} detail={offline > 0 ? `${offline} offline` : "All reporting"} tone={offline > 0 ? "warn" : "good"} />
        {isAdmin ? <StatCard icon={IndianRupee} title="Collected this month" value={inr(revenue)} detail={`${customers?.count ?? 0} customers · ${activeSubs?.count ?? 0} subscriptions running`} /> : <StatCard icon={CheckCircle2} title="Your tickets" value={mine} detail="Assigned to you, still open" />}
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="gap-4">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Needs your attention</CardTitle>
              <CardDescription>New leads, tickets with unread messages and device alerts.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {alerts.items.length === 0 ? (
              <div className="grid place-items-center gap-1 py-8 text-center">
                <CheckCircle2 className="size-6 text-emerald-500" />
                <p className="text-sm font-medium">All clear</p>
                <p className="text-xs text-muted-foreground">Nothing is waiting for you.</p>
              </div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {alerts.items.slice(0, 7).map((n) => (
                  <li key={n.id}>
                    <Link href={n.href} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent">
                      <ToneBadge tone={n.tone === "critical" ? "bad" : n.tone === "warning" ? "warn" : "info"} className="w-20 justify-center capitalize">
                        {n.kind === "alert" ? "Alert" : n.kind === "lead" ? "Lead" : "Ticket"}
                      </ToneBadge>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{n.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{n.detail}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{ago(n.at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="gap-4">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Support</CardTitle>
              <CardDescription>The tickets still open.</CardDescription>
            </div>
            <CardLink href="/support">Open support</CardLink>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Unassigned", n: unassigned, tone: unassigned > 0 ? "text-amber-600" : "" },
                { label: "Yours", n: mine, tone: "" },
                { label: "New messages", n: unread, tone: unread > 0 ? "text-primary" : "" },
              ].map((x) => (
                <div key={x.label} className="rounded-lg border p-3">
                  <div className={`text-2xl font-semibold tabular-nums ${x.tone}`}>{x.n}</div>
                  <div className="text-xs text-muted-foreground">{x.label}</div>
                </div>
              ))}
            </div>
            <Bars
              empty="No open tickets."
              rows={[
                { label: "Open", n: tickets.filter((t) => t.status === "open").length, tone: "bg-sky-500" },
                { label: "In progress", n: tickets.filter((t) => t.status === "in_progress").length, tone: "bg-amber-500" },
                { label: "Resolved, awaiting close", n: tickets.filter((t) => t.status === "resolved").length, tone: "bg-emerald-500" },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="gap-4">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Leads</CardTitle>
              <CardDescription>Where each lead is in the sales process.</CardDescription>
            </div>
            <CardLink href="/leads">All leads</CardLink>
          </CardHeader>
          <CardContent>
            <Bars empty="No leads yet." rows={LEAD_STATUSES.map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), n: leadCount(s), tone: s === "converted" ? "bg-emerald-500" : s === "lost" ? "bg-zinc-400" : "bg-primary" }))} />
          </CardContent>
        </Card>

        <Card className="gap-4">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Onboarding pipeline</CardTitle>
              <CardDescription>Customers at each stage, from quotation to install.</CardDescription>
            </div>
            <CardLink href="/onboarding">Open onboarding</CardLink>
          </CardHeader>
          <CardContent>
            <Bars empty="Nobody is in the pipeline." rows={STAGES.map((s) => ({ label: s.label, n: stageCount(s.value), tone: s.value === "install_completed" ? "bg-emerald-500" : "bg-primary" }))} />
          </CardContent>
        </Card>

        <Card className="gap-4">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Devices</CardTitle>
              <CardDescription>The status of every device the monitoring knows.</CardDescription>
            </div>
            <CardLink href="/alerts">Alerts</CardLink>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {devices.length > 0 ? (
                <>
                  <span className="h-full bg-emerald-500" style={{ width: `${(online / devices.length) * 100}%` }} title={`Online: ${online}`} />
                  <span className="h-full bg-amber-500" style={{ width: `${(devCount("device_unreachable") / devices.length) * 100}%` }} title={`Unreachable: ${devCount("device_unreachable")}`} />
                  <span className="h-full bg-red-500" style={{ width: `${(Math.max(0, offline) / devices.length) * 100}%` }} title={`Offline: ${offline}`} />
                </>
              ) : null}
            </div>
            <ul className="grid gap-2 text-sm sm:grid-cols-3">
              <li className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Online</span>
                <span className="ml-auto tabular-nums">{online}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">Unreachable</span>
                <span className="ml-auto tabular-nums">{devCount("device_unreachable")}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Offline</span>
                <span className="ml-auto tabular-nums">{Math.max(0, offline)}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card className="gap-4">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Stock</CardTitle>
                <CardDescription>
                  {available} available across {stock.length} models.
                </CardDescription>
              </div>
              <CardLink href="/devices">Open stock</CardLink>
            </CardHeader>
            <CardContent>
              {reorder.length === 0 ? (
                <p className="text-sm text-muted-foreground">Every model is well stocked.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {reorder.slice(0, 6).map((s) => (
                    <li key={s.name} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <span className="truncate">{s.name}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums text-muted-foreground">{s.sum.available} left</span>
                        <ToneBadge tone={s.level === "out" ? "bad" : "warn"}>{s.level === "out" ? "Out" : "Low"}</ToneBadge>
                      </span>
                    </li>
                  ))}
                  {reorder.length > 6 ? <li className="px-4 py-2 text-xs text-muted-foreground">and {reorder.length - 6} more</li> : null}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card className="gap-4 xl:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <CardDescription>{isAdmin ? "The latest changes across the system." : "The latest changes to devices on your sites."}</CardDescription>
            </div>
            <CardLink href={isAdmin ? "/audit" : "/activity"}>{isAdmin ? "Audit log" : "Device activity"}</CardLink>
          </CardHeader>
          <CardContent>
            {(isAdmin ? (audit?.data ?? []).length : (activity?.data ?? []).length) === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {isAdmin
                  ? (audit?.data ?? []).map((a) => (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <ToneBadge tone={a.action === "delete" ? "bad" : a.action === "insert" ? "good" : "info"} className="w-16 justify-center capitalize">
                          {a.action}
                        </ToneBadge>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium capitalize">{a.entity.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground"> by {a.actor?.full_name ?? a.actor?.email ?? "system"}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{ago(a.created_at)}</span>
                      </li>
                    ))
                  : (activity?.data ?? []).map((a) => (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{a.summary}</span>
                          {a.actor_name ? <span className="text-muted-foreground"> by {a.actor_name}</span> : null}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{a.at ? ago(a.at) : ""}</span>
                      </li>
                    ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
