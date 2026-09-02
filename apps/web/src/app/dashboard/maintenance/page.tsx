import { Wrench } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewMaintenanceTicketDialog } from "@/components/dashboard/new-maintenance-ticket-dialog";

const STATUS_BADGE_VARIANT: Record<string, "alert" | "default" | "secondary"> = {
  open: "alert",
  in_progress: "default",
  resolved: "secondary",
  closed: "secondary",
};

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Maintenance</h1>
          <p className="mt-1 text-sm text-theme-muted">Report an issue or request a scheduled visit.</p>
        </div>
        {sites && sites.length > 0 && <NewMaintenanceTicketDialog sites={sites} error={error} />}
      </div>

      {(!sites || sites.length === 0) && (
        <p className="rounded-xl border border-theme-border bg-theme-surface p-5 text-sm text-theme-muted">
          No sites set up yet — maintenance requests need a site to attach to.
        </p>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-theme-primary">Your requests</h2>
        {!tickets || tickets.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Wrench />
              </EmptyMedia>
              <EmptyTitle>No maintenance requests yet</EmptyTitle>
              <EmptyDescription>Anything you report shows up here, with its status.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-theme-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-foreground">{t.description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={STATUS_BADGE_VARIANT[t.status] ?? "secondary"} className="capitalize">
                        {t.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
