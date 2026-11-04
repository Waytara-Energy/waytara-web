import * as React from "react";
import { Wrench } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, resolvePageDevices, deviceDisplayId, type CustomerDevice, type CustomerSite } from "@/lib/selected-site";
import { todayIst } from "@/lib/report-types";
import { getLastSyncInfo } from "@/lib/device-sync";
import { fetchSolarHealthData, FAULT_HISTORY_DAYS } from "@/lib/maintenance-data";
import { fetchEvMaintenance } from "@/lib/ev-maint-data";
import { getServiceStatus, type ServiceStatus } from "@/lib/service-status";
import { DeviceHealthContent } from "@/components/dashboard/device-health-content";
import { LiveDynamicFieldGroup } from "@/components/dashboard/live-field-group";
import { MaintenanceBoard, type HeadlineData, type MaintenanceDevice } from "@/components/dashboard/maintenance-board";
import { MaintenanceService, serviceDate } from "@/components/dashboard/maintenance-service";
import { EvRealtime } from "@/components/dashboard/ev-realtime";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** The server's clock for the warranty countdown (a function, so a render never reads the time itself). */
const serverNow = () => Date.now();

// One page for the whole site: a tab for the inverter and one for the EV charger (each with its own health, from its live channel: connection,
// faults, temperatures, the plain-language checks; the raw registers are kept in a collapsed panel for support), then Service, which holds every
// device's plan, warranty and visits in one tab. The details header is above the tabs and follows the open one. An EV charger gets checks like
// the inverter's (its unit, connection, connector, last charge) and its recent events. A problem is reported in Support (the fault and check
// buttons link there). A device that is neither keeps its own health view in a Health tab.
export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const [{ device: deviceIdParam }, site] = await Promise.all([searchParams, getSelectedSite()]);
  const { solar, ev, chosen, focus } = await resolvePageDevices(site, deviceIdParam);
  // A device that is neither an inverter nor a charger (a meter...) is shown on its own; otherwise the inverter and the charger are tabs.
  const other = focus === null && chosen ? chosen : null;
  const shown: { kind: MaintenanceDevice["kind"]; device: CustomerDevice }[] = other ? [{ kind: "device", device: other }] : [solar && { kind: "solar" as const, device: solar }, ev && { kind: "ev" as const, device: ev }].filter((d) => !!d);

  if (shown.length === 0) {
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
  const [devices, statuses] = await Promise.all([
    Promise.all(shown.map((s) => loadDevice(supabase, s.kind, s.device, site))),
    Promise.all(shown.map((s) => (s.device.serviceId ? getServiceStatus(s.device.serviceId) : Promise.resolve(null)))),
  ]);

  return (
    <>
      {shown.map(({ device }) => (
        <React.Fragment key={device.id}>
          <RealtimeRefresh table="support_tickets" event="UPDATE" filter={`equipment_id=eq.${device.id}`} />
          <RealtimeRefresh table="support_tickets" event="INSERT" filter={`equipment_id=eq.${device.id}`} />
          {device.deviceType?.category === "ev_charger" && (
            <>
              <RealtimeRefresh table="ev_events" event="INSERT" filter={`equipment_id=eq.${device.id}`} />
              <EvRealtime chargerId={device.id} />
            </>
          )}
        </React.Fragment>
      ))}
      <MaintenanceBoard
        devices={devices}
        defaultKind={focus === "ev" ? "ev" : focus === "solar" ? "solar" : shown[0]!.kind}
        service={{ headline: serviceHeadline(shown.map((s) => s.device), statuses), content: <ServiceOfDevices devices={shown.map((s) => s.device)} statuses={statuses} /> }}
      />
    </>
  );
}

/** One device's health, as the board takes it. */
async function loadDevice(supabase: Awaited<ReturnType<typeof createClient>>, kind: MaintenanceDevice["kind"], device: CustomerDevice, site: CustomerSite | null): Promise<MaintenanceDevice> {
  const isSolar = device.deviceType?.category === "solar_inverter";
  const isEv = device.deviceType?.category === "ev_charger";
  const [{ data: supportRows }, sync, solar, ev] = await Promise.all([
    supabase.from("support_tickets").select("subject").eq("equipment_id", device.id).neq("status", "closed"),
    getLastSyncInfo(device.id),
    isSolar ? fetchSolarHealthData(supabase, device) : Promise.resolve(null),
    isEv ? fetchEvMaintenance(supabase, device) : Promise.resolve(null),
  ]);
  return {
    kind,
    deviceId: device.id,
    sync,
    solar:
      solar && {
        initial: solar.initial,
        faultEvents: solar.faultEvents,
        faultHistoryFailed: solar.faultHistoryFailed,
        gauges: solar.gauges,
        previousTemps: solar.previousTemps,
        faultDays: FAULT_HISTORY_DAYS,
        today: todayIst(),
        firstDay: null,
      },
    health: isSolar ? null : <DeviceHealthContent supabase={supabase} device={device} />,
    ev,
    technical: solar && solar.technical.length > 0 ? <TechnicalGroups deviceId={device.id} groups={solar.technical} /> : null,
    report: site ? { deviceId: device.id, deviceLabel: deviceDisplayId(device), siteId: site.id, siteName: site.name } : null,
    openIssues: (supportRows ?? []).map((t) => t.subject),
  };
}

/** The Service header for every device of the page: the nearest next visit, the visits left across the plans, the nearest end of a warranty. */
function serviceHeadline(devices: CustomerDevice[], statuses: (ServiceStatus | null)[]): HeadlineData {
  const earliest = (dates: (string | null | undefined)[]) => dates.filter((d): d is string => !!d).sort()[0] ?? null;
  // two devices on one plan are one plan: its visits are counted once
  const plans = new Map<string, ServiceStatus>();
  devices.forEach((d, i) => {
    const s = statuses[i];
    if (s) plans.set(d.serviceId ?? d.id, s);
  });
  const left = [...plans.values()].map((s) => s.remainingCount).filter((n): n is number => n !== null && n !== undefined);
  return {
    label: "Next service",
    value: serviceDate(earliest(statuses.map((s) => s?.nextServiceDate))) ?? "Not scheduled",
    figures: [
      { label: "Visits left", value: left.length > 0 ? String(left.reduce((a, b) => a + b, 0)) : "—" },
      { label: "Warranty until", value: serviceDate(earliest(devices.map((d) => d.warrantyEndDate))) ?? "—" },
    ],
  };
}

/** The Service tab: each plan and warranty of the site's devices. Devices that share a plan are one section, named together. */
function ServiceOfDevices({ devices, statuses }: { devices: CustomerDevice[]; statuses: (ServiceStatus | null)[] }) {
  const groups: { key: string; devices: CustomerDevice[]; status: ServiceStatus | null }[] = [];
  devices.forEach((d, i) => {
    const key = d.serviceId ?? d.id;
    const existing = groups.find((g) => g.key === key);
    if (existing) existing.devices.push(d);
    else groups.push({ key, devices: [d], status: statuses[i] ?? null });
  });
  const now = serverNow();
  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const first = g.devices[0]!;
        return (
          <section key={g.key} className="space-y-3">
            {devices.length > 1 && <h2 className="text-sm font-semibold text-foreground">{g.devices.map((d) => deviceDisplayId(d)).join(" · ")}</h2>}
            <MaintenanceService status={g.status} installedAt={first.installedAt} warrantyStart={first.warrantyStartDate} warrantyEnd={first.warrantyEndDate} now={now} />
          </section>
        );
      })}
    </div>
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
