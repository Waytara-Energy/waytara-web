import { Wrench } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, resolveDeviceInSite, deviceDisplayId } from "@/lib/selected-site";
import { todayIst } from "@/lib/report-types";
import { getLastSyncInfo } from "@/lib/device-sync";
import { fetchSolarHealthData, FAULT_HISTORY_DAYS } from "@/lib/maintenance-data";
import { getServiceStatus, type ServiceStatus } from "@/lib/service-status";
import { DeviceHealthContent } from "@/components/dashboard/device-health-content";
import { LiveDynamicFieldGroup } from "@/components/dashboard/live-field-group";
import { MaintenanceBoard, type HeadlineData } from "@/components/dashboard/maintenance-board";
import { MaintenanceRequests, isOpen, type TicketRow } from "@/components/dashboard/maintenance-requests";
import { MaintenanceService, serviceDate } from "@/components/dashboard/maintenance-service";
import { NewMaintenanceTicketDialog } from "@/components/dashboard/new-maintenance-ticket-dialog";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** The server's clock for the warranty countdown (a function, so a render never reads the time itself). */
const serverNow = () => Date.now();

// Three tabs like Performance and Reports, each with its own headline. Health follows the device's live channel (connection, faults,
// temperatures and the plain-language checks); the raw registers are kept in a collapsed panel for support. Service shows the plan,
// warranty and visits, only for what exists; Requests lists what the customer reported. A device that is not a solar inverter keeps its
// own health view in the Health tab.
export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const [{ device: deviceIdParam }, site] = await Promise.all([searchParams, getSelectedSite()]);
  const device = await resolveDeviceInSite(site, deviceIdParam);

  if (!device) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Wrench />
          </EmptyMedia>
          <EmptyTitle>No devices yet</EmptyTitle>
          <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const supabase = await createClient();
  const isSolar = device.deviceType?.category === "solar_inverter";
  const [{ data: ticketRows }, sync, solar] = await Promise.all([
    supabase
      .from("maintenance_tickets")
      .select("id, description, status, type, created_at, scheduled_date, completed_at")
      .eq("device_id", device.id)
      .order("created_at", { ascending: false }),
    getLastSyncInfo(device.id),
    isSolar ? fetchSolarHealthData(supabase, device) : Promise.resolve(null),
  ]);
  const tickets: TicketRow[] = ticketRows ?? [];
  const serviceStatus: ServiceStatus | null = device.serviceId ? await getServiceStatus(device.serviceId) : null;

  const open = tickets.filter((t) => isOpen(t.status)).length;
  const lastUpdate = tickets.map((t) => t.completed_at ?? t.created_at).sort().at(-1) ?? null;
  const serviceHeadline: HeadlineData = {
    label: "Next service",
    value: serviceDate(serviceStatus?.nextServiceDate) ?? "Not scheduled",
    figures: [
      { label: "Visits left", value: serviceStatus?.remainingCount != null ? String(serviceStatus.remainingCount) : "—" },
      { label: "Warranty until", value: serviceDate(device.warrantyEndDate) ?? "—" },
    ],
  };
  const requestsHeadline: HeadlineData = {
    label: "Open requests",
    value: String(open),
    figures: [
      { label: "Resolved", value: String(tickets.filter((t) => t.status === "resolved" || t.status === "closed").length) },
      { label: "Last update", value: serviceDate(lastUpdate) ?? "—" },
    ],
  };

  return (
    <>
      <RealtimeRefresh table="maintenance_tickets" event="UPDATE" filter={`device_id=eq.${device.id}`} />
      <RealtimeRefresh table="maintenance_tickets" event="INSERT" filter={`device_id=eq.${device.id}`} />
      <MaintenanceBoard
        deviceId={device.id}
        sync={sync}
        solar={
          solar && {
            initial: solar.initial,
            faultEvents: solar.faultEvents,
            faultHistoryFailed: solar.faultHistoryFailed,
            gauges: solar.gauges,
            previousTemps: solar.previousTemps,
            faultDays: FAULT_HISTORY_DAYS,
            today: todayIst(),
            firstDay: null,
          }
        }
        health={isSolar ? null : <DeviceHealthContent supabase={supabase} device={device} />}
        technical={solar && solar.technical.length > 0 ? <TechnicalGroups deviceId={device.id} groups={solar.technical} /> : null}
        service={<MaintenanceService status={serviceStatus} installedAt={device.installedAt} warrantyStart={device.warrantyStartDate} warrantyEnd={device.warrantyEndDate} now={serverNow()} />}
        requests={<MaintenanceRequests tickets={tickets} />}
        serviceHeadline={serviceHeadline}
        requestsHeadline={requestsHeadline}
        report={site ? { deviceId: device.id, deviceLabel: deviceDisplayId(device), siteId: site.id, siteName: site.name } : null}
        openIssues={tickets.filter((t) => isOpen(t.status)).map((t) => t.description ?? "")}
        action={site ? <NewMaintenanceTicketDialog deviceId={device.id} deviceLabel={deviceDisplayId(device)} siteId={site.id} siteName={site.name} /> : null}
      />
    </>
  );
}

/** The device's raw Maintenance readings, grouped as the template names them, for the collapsed technical panel. */
function TechnicalGroups({ deviceId, groups }: { deviceId: string; groups: NonNullable<Awaited<ReturnType<typeof fetchSolarHealthData>>>["technical"] }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <LiveDynamicFieldGroup key={`${g.category}-${g.groupName ?? ""}`} deviceId={deviceId} title={g.groupName ? `${g.category} — ${g.groupName}` : g.category} fields={g.fields} initial={g.values} />
      ))}
    </div>
  );
}
