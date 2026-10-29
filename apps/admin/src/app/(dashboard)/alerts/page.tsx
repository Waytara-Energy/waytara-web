import Link from "next/link";
import { AlertTriangle, BellOff, CheckCircle2, ShieldAlert } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, FilterBar, LoadError, PageHeader, StatCard, StatGrid } from "@/components/page-kit";

const SHOWS = ["active", "acknowledged", "resolved"] as const;
type Show = (typeof SHOWS)[number];

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

/** Every alert the monitoring raised on a device, across customers: what is active now (the sidebar badge counts these), what someone has seen, and what has cleared. */
export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show: rawShow } = await searchParams;
  const show: Show = (SHOWS as readonly string[]).includes(rawShow ?? "") ? (rawShow as Show) : "active";
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("alerts")
    .select("id, message, severity, ts, resolved_at, acknowledged_at, offline_since, device:equipment(id, label, serial_number, site:sites(name))")
    .order("ts", { ascending: false })
    .limit(300);

  const all = rows ?? [];
  const active = all.filter((a) => !a.resolved_at && !a.acknowledged_at);
  const acknowledged = all.filter((a) => !a.resolved_at && a.acknowledged_at);
  const resolved = all.filter((a) => a.resolved_at);
  const shown = show === "active" ? active : show === "acknowledged" ? acknowledged : resolved;
  const critical = active.filter((a) => a.severity === "critical").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Alerts" description="What the monitoring has raised on customers' devices: a device going offline, a fault, a reading out of range. The newest 300." />

      <StatGrid>
        <StatCard icon={ShieldAlert} title="Active" value={active.length} detail="Not seen by anyone yet" tone={active.length > 0 ? "bad" : "good"} />
        <StatCard icon={AlertTriangle} title="Critical" value={critical} detail="Of the active ones" tone={critical > 0 ? "bad" : undefined} />
        <StatCard icon={BellOff} title="Acknowledged" value={acknowledged.length} detail="Seen, still open" />
        <StatCard icon={CheckCircle2} title="Resolved" value={resolved.length} detail="Cleared on their own or by the team" />
      </StatGrid>

      <FilterBar
        label="Show"
        items={[
          { label: "Active", href: "/alerts", active: show === "active", count: active.length },
          { label: "Acknowledged", href: "/alerts?show=acknowledged", active: show === "acknowledged", count: acknowledged.length },
          { label: "Resolved", href: "/alerts?show=resolved", active: show === "resolved", count: resolved.length },
        ]}
      />

      {error ? (
        <LoadError message={`Couldn't load the alerts: ${error.message}`} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {shown.length === 0 ? (
            <EmptyState icon={CheckCircle2} title={show === "active" ? "No active alerts" : "Nothing here"} description={show === "active" ? "Every device is reporting normally." : undefined} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Alert</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead>{show === "resolved" ? "Cleared" : "Seen"}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Badge variant="outline" className={a.severity === "critical" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"}>
                        {a.severity === "critical" ? "Critical" : "Warning"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{a.device?.label ?? a.device?.serial_number ?? "Device"}</div>
                      <div className="text-xs text-muted-foreground">{a.device?.site?.name ?? "No site"}</div>
                    </TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">{a.message}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{when(a.ts)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{show === "resolved" ? when(a.resolved_at) : when(a.acknowledged_at)}</TableCell>
                    <TableCell>
                      {a.device?.id ? (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/devices/${a.device.id}/registers`}>Open</Link>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
