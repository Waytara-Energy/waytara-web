import Link from "next/link";
import { Cpu } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, deviceDisplayId } from "@/lib/selected-site";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DeviceStatusPill } from "@/components/dashboard/device-status-pill";
import { STATUS_BADGE_VARIANT } from "@/components/dashboard/device-details-card";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";

// Overview shows the site's combined picture only now (see
// /dashboard/page.tsx) — this is where per-device browsing lives instead:
// one status card per device at the selected site, each linking through to
// its own full detail page (energy flow, today so far, recent alerts —
// everything Overview used to show for a single "primary" device before
// the site-wide redesign).
export default async function DevicesPage() {
  const supabase = await createClient();
  const site = await getSelectedSite();

  if (!site || site.devices.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">Devices</h1>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Cpu />
            </EmptyMedia>
            <EmptyTitle>No devices yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const deviceIds = site.devices.map((d) => d.id);
  // inverter_state/active_fault_code only mean anything for a solar
  // inverter — an EV charger (or any future non-inverter category) never
  // writes those keys, so querying for them site-wide and showing the
  // resulting "Unknown" pill on every other device's card was the same
  // inverter-shaped-view-on-the-wrong-device bug as the old detail page.
  // Non-inverter cards show their plain device_status (active/test/etc.)
  // instead — real data about that device, not a blank inverter pill.
  const inverterIds = site.devices.filter((d) => d.deviceType?.category === "solar_inverter").map((d) => d.id);

  // One status snapshot (inverter_state, active_fault_code) across every
  // inverter at the site, latest-per-(device,key) — same query Overview
  // used to run for its own "Devices at {site}" grid before that moved
  // here.
  const { data: statusReadings } =
    inverterIds.length > 0
      ? await supabase
          .from("device_readings")
          .select("device_id, instrument_key, value, ts")
          .in("device_id", inverterIds)
          .in("instrument_key", ["inverter_state", "active_fault_code"])
          .order("ts", { ascending: false })
          .limit(inverterIds.length * 10)
      : { data: null };

  const latestStatus = new Map<string, number | null>(); // `${deviceId}:${instrumentKey}` -> value
  for (const r of statusReadings ?? []) {
    const key = `${r.device_id}:${r.instrument_key}`;
    if (!latestStatus.has(key)) latestStatus.set(key, r.value);
  }

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="device_readings" event="INSERT" filter={`device_id=in.(${deviceIds.join(",")})`} />

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Devices</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every device at {site.name}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {site.devices.map((d) => (
          <Link key={d.id} href={`/dashboard/devices/${d.id}`}>
            <Card className="transition-colors hover:bg-accent">
              <CardContent className="p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{deviceDisplayId(d)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {d.deviceType?.name ?? "Device"}
                    {d.deviceType?.manufacturer ? ` · ${d.deviceType.manufacturer}` : ""}
                  </p>
                  {d.deviceType?.serialNumber && (
                    <p className="mt-0.5 text-xs text-muted-foreground">Serial {d.deviceType.serialNumber}</p>
                  )}
                </div>
                <div className="mt-3">
                  {d.deviceType?.category === "solar_inverter" ? (
                    <DeviceStatusPill
                      inverterState={latestStatus.get(`${d.id}:inverter_state`) ?? null}
                      activeFaultCode={latestStatus.get(`${d.id}:active_fault_code`) ?? null}
                    />
                  ) : (
                    <Badge variant={STATUS_BADGE_VARIANT[d.deviceStatus] ?? "secondary"} className="capitalize">
                      {d.deviceStatus}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
