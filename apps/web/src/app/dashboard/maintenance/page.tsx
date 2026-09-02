import { Wrench } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedDevice } from "@/lib/selected-device";
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

// Device-centric redesign: tickets attach to (and this list filters by)
// the selected device's device_id rather than every ticket across every
// site the customer owns.
export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const device = await getSelectedDevice();

  const { data: tickets } = device
    ? await supabase
        .from("maintenance_tickets")
        .select("id, description, status, type, created_at")
        .eq("device_id", device.id)
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Maintenance</h1>
          <p className="mt-1 text-sm text-theme-muted">
            {device
              ? `Report an issue or request a scheduled visit for ${device.label || device.deviceUid}.`
              : "Report an issue or request a scheduled visit."}
          </p>
        </div>
        {device && (
          <NewMaintenanceTicketDialog
            deviceLabel={device.label || device.deviceUid}
            siteName={device.site?.name ?? null}
            error={error}
          />
        )}
      </div>

      {!device ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wrench />
            </EmptyMedia>
            <EmptyTitle>No devices yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-theme-primary">Your requests</h2>
          {!tickets || tickets.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Wrench />
                </EmptyMedia>
                <EmptyTitle>No maintenance requests yet</EmptyTitle>
                <EmptyDescription>Anything you report for this device shows up here, with its status.</EmptyDescription>
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
      )}
    </div>
  );
}
