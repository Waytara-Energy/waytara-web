import { Wrench } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedDevice } from "@/lib/selected-device";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewMaintenanceTicketDialog } from "@/components/dashboard/new-maintenance-ticket-dialog";
import { FaultBanner } from "@/components/dashboard/fault-banner";
import { LastSyncIndicator } from "@/components/dashboard/last-sync-indicator";
import { TemperatureGauge } from "@/components/dashboard/temperature-gauge";
import { getLastSyncInfo } from "@/lib/device-sync";
import { TEMPERATURE_FIELDS } from "@/lib/telemetry-catalog";

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
// Telemetry-driven redesign (Phase 12, final phase of this arc): a "Device
// Health" section now sits above the ticket list — the current fault
// status (FaultBanner, reused from Overview), temperature trends against
// the manual's safe-operating ceilings, and a last-sync indicator so a
// customer can tell "the inverter is fine, the connection dropped" from
// "the inverter has a fault" at a glance, per the user's own spec.
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

  let activeFaultCode: number | null = null;
  let currentTemps = new Map<string, number | null>();
  let previousTemps = new Map<string, number | null>();
  let lastSync = null as Awaited<ReturnType<typeof getLastSyncInfo>> | null;

  if (device) {
    const tempKeys = TEMPERATURE_FIELDS.map((f) => f.key);

    const { data: latestRows } = await supabase
      .from("device_readings")
      .select("instrument_key, value, ts")
      .eq("device_id", device.id)
      .in("instrument_key", ["active_fault_code", ...tempKeys])
      .order("ts", { ascending: false })
      .limit((tempKeys.length + 1) * 5);
    for (const r of latestRows ?? []) {
      if (r.instrument_key === "active_fault_code" && activeFaultCode === null) activeFaultCode = r.value;
      else if (tempKeys.includes(r.instrument_key) && !currentTemps.has(r.instrument_key)) {
        currentTemps.set(r.instrument_key, r.value);
      }
    }

    // A reading from roughly a day ago (±2h window) for each temperature
    // field, so the gauge can show whether it's trending up or easing off
    // rather than just where it sits right now.
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const windowStart = new Date(dayAgo.getTime() - 2 * 3600 * 1000).toISOString();
    const windowEnd = new Date(dayAgo.getTime() + 2 * 3600 * 1000).toISOString();
    const { data: pastRows } = await supabase
      .from("device_readings")
      .select("instrument_key, value, ts")
      .eq("device_id", device.id)
      .in("instrument_key", tempKeys)
      .gte("ts", windowStart)
      .lte("ts", windowEnd)
      .order("ts", { ascending: true })
      .limit(50);
    for (const r of pastRows ?? []) {
      if (!previousTemps.has(r.instrument_key)) previousTemps.set(r.instrument_key, r.value);
    }

    lastSync = await getLastSyncInfo(device.id);
  }

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
        <>
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-theme-primary">Device Health</h2>
            <FaultBanner faultCode={activeFaultCode} />
            {lastSync && <LastSyncIndicator sync={lastSync} />}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Temperature Trends</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {TEMPERATURE_FIELDS.map((field) => (
                  <TemperatureGauge
                    key={field.key}
                    label={field.label}
                    valueC={currentTemps.get(field.key) ?? null}
                    warnAboveC={field.warnAboveC}
                    previousValueC={previousTemps.get(field.key) ?? null}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

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
