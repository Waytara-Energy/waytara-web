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
import { MaintenanceService, serviceDate } from "@/components/dashboard/maintenance-service";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** The server's clock for the warranty countdown (a function, so a render never reads the time itself). */
const serverNow = () => Date.now();

// Two tabs like Performance and Reports, each with its own headline. Health follows the device's live channel (connection, faults,
// temperatures and the plain-language checks); the raw registers are kept in a collapsed panel for support. Service shows the plan,
// warranty and visits, only for what exists. A problem is reported in Support (the fault and check buttons link there). A device that is not a solar inverter keeps its
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
  const [{ data: supportRows }, sync, solar] = await Promise.all([
    supabase.from("support_tickets").select("subject").eq("equipment_id", device.id).neq("status", "closed"),
    getLastSyncInfo(device.id),
    isSolar ? fetchSolarHealthData(supabase, device) : Promise.resolve(null),
  ]);
  const serviceStatus: ServiceStatus | null = device.serviceId ? await getServiceStatus(device.serviceId) : null;

  const serviceHeadline: HeadlineData = {
    label: "Next service",
    value: serviceDate(serviceStatus?.nextServiceDate) ?? "Not scheduled",
    figures: [
      { label: "Visits left", value: serviceStatus?.remainingCount != null ? String(serviceStatus.remainingCount) : "—" },
      { label: "Warranty until", value: serviceDate(device.warrantyEndDate) ?? "—" },
    ],
  };
  return (
    <>
      <RealtimeRefresh table="support_tickets" event="UPDATE" filter={`equipment_id=eq.${device.id}`} />
      <RealtimeRefresh table="support_tickets" event="INSERT" filter={`equipment_id=eq.${device.id}`} />
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
        serviceHeadline={serviceHeadline}
        report={site ? { deviceId: device.id, deviceLabel: deviceDisplayId(device), siteId: site.id, siteName: site.name } : null}
        openIssues={(supportRows ?? []).map((t) => t.subject)}
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
