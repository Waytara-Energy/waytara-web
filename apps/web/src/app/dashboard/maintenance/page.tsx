import { Wrench } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, resolveDeviceInSite, deviceDisplayId } from "@/lib/selected-site";
import { DevicePicker } from "@/components/dashboard/device-picker";
import { DeviceDetailsCard } from "@/components/dashboard/device-details-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewMaintenanceTicketDialog } from "@/components/dashboard/new-maintenance-ticket-dialog";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { DeviceHealthContent } from "@/components/dashboard/device-health-content";
import { getServiceStatus, type ServiceStatus } from "@/lib/service-status";

const STATUS_BADGE_VARIANT: Record<string, "alert" | "default" | "secondary"> = {
  open: "alert",
  in_progress: "default",
  resolved: "secondary",
  closed: "secondary",
};

// Device-centric redesign: tickets attach to (and this list filters by)
// the selected device's device_id rather than every ticket across every
// site the customer owns.
//
// Phase 5 of the multi-device-type dashboard roadmap: "Device Health" is
// now category-aware via DeviceHealthContent — solar_inverter keeps the
// fault banner/history, temperature trends, and SD-card status (Phase 12's
// original build); ev_charger gets its own connector-status/error-code
// health view. The ticket list and service-contract section below are
// already device-agnostic (maintenance_tickets/service_contracts aren't
// tied to any one category), so they're untouched.
export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; device?: string }>;
}) {
  const [{ error, device: deviceIdParam }, site] = await Promise.all([searchParams, getSelectedSite()]);
  const device = resolveDeviceInSite(site, deviceIdParam);
  const supabase = await createClient();

  let tickets: { id: string; description: string | null; status: string; type: string; created_at: string }[] | null = null;
  let serviceStatus: ServiceStatus | null = null;

  if (device) {
    const [{ data: ticketRows }] = await Promise.all([
      supabase
        .from("maintenance_tickets")
        .select("id, description, status, type, created_at")
        .eq("device_id", device.id)
        .order("created_at", { ascending: false }),
    ]);

    if (device.serviceId) serviceStatus = await getServiceStatus(device.serviceId);

    tickets = ticketRows;
  }

  return (
    <div className="max-w-2xl space-y-6">
      {device && (
        <>
          {/* Fault status, temperature trends, and last-sync are all
              derived server-side (fault-episode collapsing, trend deltas)
              from device_readings — not safe to hand-patch from a raw
              INSERT payload, so a new reading debounce-refreshes the whole
              page instead (see RealtimeRefresh's own reasoning). */}
          <RealtimeRefresh table="device_readings" event="INSERT" filter={`device_id=eq.${device.id}`} />
          <RealtimeRefresh table="maintenance_tickets" event="UPDATE" filter={`device_id=eq.${device.id}`} />
        </>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Maintenance</h1>
          <p className="mt-1 text-sm text-theme-muted">
            {device
              ? `Report an issue or request a scheduled visit for ${deviceDisplayId(device)}.`
              : "Report an issue or request a scheduled visit."}
          </p>
        </div>
        {device && site && (
          <NewMaintenanceTicketDialog
            deviceId={device.id}
            deviceLabel={deviceDisplayId(device)}
            siteId={site.id}
            siteName={site.name}
            error={error}
          />
        )}
      </div>

      {site && device && (
        <>
          <DevicePicker devices={site.devices} selectedId={device.id} />
          <DeviceDetailsCard device={device} />
        </>
      )}

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
        <>
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-theme-primary">Device Health</h2>
            <DeviceHealthContent supabase={supabase} device={device} />
          </div>

          {serviceStatus && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-theme-primary">Service</h2>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{serviceStatus.planName ?? "Service plan"}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <ServiceStat
                    label="Next service"
                    value={serviceStatus.nextServiceDate ? formatServiceDate(serviceStatus.nextServiceDate) : "Not scheduled"}
                  />
                  <ServiceStat
                    label="Services used"
                    value={
                      serviceStatus.totalIncluded !== null
                        ? `${serviceStatus.completedCount} of ${serviceStatus.totalIncluded}`
                        : String(serviceStatus.completedCount)
                    }
                  />
                  <ServiceStat
                    label="Remaining"
                    value={serviceStatus.remainingCount !== null ? String(serviceStatus.remainingCount) : "—"}
                  />
                  <ServiceStat
                    label="Last completed"
                    value={serviceStatus.lastCompletedAt ? formatServiceDate(serviceStatus.lastCompletedAt) : "None yet"}
                  />
                  <ServiceStat
                    label="Free / paid included"
                    value={
                      serviceStatus.freeIncluded !== null && serviceStatus.totalIncluded !== null
                        ? `${serviceStatus.freeIncluded} free · ${serviceStatus.totalIncluded - serviceStatus.freeIncluded} paid`
                        : "—"
                    }
                  />
                  <ServiceStat label="Plan ends" value={formatServiceDate(serviceStatus.contractEndDate)} />
                </CardContent>
              </Card>
            </div>
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
        </>
      )}
    </div>
  );
}

function formatServiceDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ServiceStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="mt-0.5 font-medium text-theme-primary">{value}</p>
    </div>
  );
}
