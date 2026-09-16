import { Zap } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, deviceDisplayId } from "@/lib/selected-site";
import { getRequestProfile } from "@/lib/request-profile";
import { fetchDeviceOverview } from "@/lib/device-overview";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DeviceStatusPill } from "@/components/dashboard/device-status-pill";
import { DeviceDetailsCard } from "@/components/dashboard/device-details-card";
import { WeatherHeader } from "@/components/dashboard/weather-header";
import { FaultBanner } from "@/components/dashboard/fault-banner";
import { EnergyFlowDiagram } from "@/components/dashboard/energy-flow-diagram";
import { TodaySoFar } from "@/components/dashboard/today-so-far";
import { RecentAlerts } from "@/components/dashboard/recent-alerts";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";

// Site-centric redesign: Overview is now the selected *site*'s overview —
// a customer can have several sites, and each site can have several
// devices (a real install is rarely just one instrument). The site's
// weather sits at the top (its own location, so it belongs here rather
// than per device), then the *primary* device's full detail — the energy
// flow diagram, status, fault banner, today's totals, recent alerts —
// rendered directly on this page. "Primary" prefers a solar inverter
// (what the diagram's wiring represents) and falls back to the site's
// first device otherwise.
//
// Every device at the site — primary included — also gets a plain status
// card below: there's no per-device detail page anymore (removed once the
// diagram above started covering the whole site's picture on its own,
// EV charger included), so these are read-only, not links to anywhere.
export default async function DashboardOverviewPage() {
  const supabase = await createClient();
  // Independent of each other — getRequestProfile is cache()-deduped
  // against the layout's own call anyway (and free in the common case, see
  // @/lib/request-profile), but running it alongside the site lookup
  // rather than after it still saves a round trip's worth of latency on
  // whichever one is slower.
  const [profile, site] = await Promise.all([getRequestProfile(), getSelectedSite()]);

  if (!site) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{profile?.email}</p>
        </div>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Zap />
            </EmptyMedia>
            <EmptyTitle>No sites yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const primaryDevice = site.devices.find((d) => d.deviceType?.category === "solar_inverter") ?? site.devices[0] ?? null;
  const deviceIds = site.devices.map((d) => d.id);

  // Independent of `overview` below — one status snapshot (inverter_state,
  // active_fault_code) across every device at the site, latest-per-
  // (device,key), for the cards; the primary device's own status pill up
  // top comes from `overview` instead (already reading the same two keys
  // for the fault banner), so it isn't refetched here.
  const [overview, statusReadings] = await Promise.all([
    primaryDevice ? fetchDeviceOverview(supabase, site, primaryDevice) : null,
    deviceIds.length > 0
      ? supabase
          .from("device_readings")
          .select("device_id, instrument_key, value, ts")
          .in("device_id", deviceIds)
          .in("instrument_key", ["inverter_state", "active_fault_code"])
          .order("ts", { ascending: false })
          .limit(deviceIds.length * 10)
          .then((r) => r.data)
      : Promise.resolve([]),
  ]);

  const latestStatus = new Map<string, number | null>(); // `${deviceId}:${instrumentKey}` -> value
  for (const r of statusReadings ?? []) {
    const key = `${r.device_id}:${r.instrument_key}`;
    if (!latestStatus.has(key)) latestStatus.set(key, r.value);
  }

  return (
    <div className="space-y-6">
      {/* device_readings isn't safe to hand-patch here — the energy flow
          diagram, "today so far" tiles, and every card's status pill are
          all derived (latest-per-key, formatted) from a raw insert
          payload, so a new reading debounce-refreshes the whole page
          instead. */}
      {deviceIds.length > 0 && (
        <RealtimeRefresh table="device_readings" event="INSERT" filter={`device_id=in.(${deviceIds.join(",")})`} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeatherHeader address={site.address} siteName={site.name} />
        {primaryDevice && overview && (
          <DeviceStatusPill inverterState={overview.get("inverter_state")} activeFaultCode={overview.get("active_fault_code")} />
        )}
      </div>

      {!primaryDevice || !overview ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Zap />
            </EmptyMedia>
            <EmptyTitle>No devices yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <DeviceDetailsCard device={primaryDevice} />

          <FaultBanner faultCode={overview.get("active_fault_code")} />

          <EnergyFlowDiagram
            solarW={overview.get("inverter_power_w")}
            batteryW={overview.get("battery_power_w")}
            gridW={overview.get("grid_power_w")}
            loadW={overview.get("load_power_w")}
            batterySocPct={overview.get("battery_soc_pct")}
            evW={overview.evW}
            powerPackage={site.powerPackage}
            powerSourceCategory={site.powerSourceCategory}
          />

          <TodaySoFar get={overview.get} />

          <Separator />

          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Recent Alerts</h2>
            <RecentAlerts deviceId={primaryDevice.id} initialAlerts={overview.recentAlerts} />
          </div>
        </>
      )}

      {site.devices.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Devices at {site.name}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {site.devices.map((d) => (
                <Card key={d.id}>
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
                      <DeviceStatusPill
                        inverterState={latestStatus.get(`${d.id}:inverter_state`) ?? null}
                        activeFaultCode={latestStatus.get(`${d.id}:active_fault_code`) ?? null}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
