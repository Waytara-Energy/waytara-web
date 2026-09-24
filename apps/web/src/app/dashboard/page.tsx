import { Zap } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite } from "@/lib/selected-site";
import { getRequestProfile } from "@/lib/request-profile";
import { fetchSiteOverview, fetchTodayChargingSessions, fetchRecentChargingStats } from "@/lib/device-overview";
import { getCustomerPlan } from "@/lib/customer-plan";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DeviceStatusPill } from "@/components/dashboard/device-status-pill";
import { WeatherHeader } from "@/components/dashboard/weather-header";
import { FaultBanner } from "@/components/dashboard/fault-banner";
import { EnergyFlowDiagram } from "@/components/dashboard/energy-flow-diagram";
import { SolarLiveStatusCards } from "@/components/dashboard/solar-live-status-cards";
import { EvLiveStatusCards } from "@/components/dashboard/ev-live-status-cards";
import { PowerGenerationChart } from "@/components/dashboard/lazy-charts";
import { ChargingSessionsCarousel } from "@/components/dashboard/charging-sessions-carousel";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { IntervalRefresh } from "@/components/dashboard/interval-refresh";
import { fetchEnumOptions } from "@/lib/instrument-catalog-data";

const WEATHER_REFRESH_MS = 30 * 60 * 1000;

// Site-centric redesign: Overview is now the selected *site*'s overview —
// a customer can have several sites, and each site can have several
// devices (a real install is rarely just one instrument). There's no
// per-device filter here anymore (that's what the Devices module is for,
// see /dashboard/devices) — Overview always shows the site's *combined*
// picture: the site's weather up top (its own location, so it belongs here
// rather than per device), then every inverter's flow/energy numbers and
// every charger's power summed into one energy-flow diagram
// (fetchSiteOverview), and recent alerts pooled across every device at
// the site.
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

  const deviceIds = site.devices.map((d) => d.id);
  const chargerIds = site.devices.filter((d) => d.deviceType?.category === "ev_charger").map((d) => d.id);
  const inverterId = site.devices.find((d) => d.deviceType?.category === "solar_inverter")?.id;
  const [overview, chargingSummary, recentChargingStats, customerPlan, connectorStatusOptions, inverterStateOptions] = await Promise.all([
    deviceIds.length > 0 ? fetchSiteOverview(supabase, site) : Promise.resolve(null),
    chargerIds.length > 0 ? fetchTodayChargingSessions(supabase, chargerIds[0]) : Promise.resolve(null),
    chargerIds.length > 0 ? fetchRecentChargingStats(supabase, chargerIds[0]) : Promise.resolve(null),
    getCustomerPlan(),
    chargerIds.length > 0
      ? fetchEnumOptions(supabase, ["connector_status"]).then((m) => m.get("connector_status") ?? [])
      : Promise.resolve([]),
    inverterId ? fetchEnumOptions(supabase, ["inverter_state"]).then((m) => m.get("inverter_state") ?? []) : Promise.resolve([]),
  ]);
  const tariffRate = customerPlan?.tariffRatePerKwh ?? 8;

  return (
    <div className="space-y-6">
      {/* device_readings isn't safe to hand-patch here — the energy flow
          diagram and the status pill are both derived (latest-per-key,
          summed/averaged across devices) from a raw insert payload, so a
          new reading debounce-refreshes the whole page instead. */}
      {deviceIds.length > 0 && (
        <RealtimeRefresh table="device_readings" event="INSERT" filter={`device_id=in.(${deviceIds.join(",")})`} />
      )}
      {/* charging_sessions isn't reflected in device_readings at all (it's
          a derived table, not a raw reading) — a session opening is an
          INSERT, closing is an UPDATE on that same row, so both need their
          own subscription for "Energy Delivered Today" and the EV cards to
          catch up the moment a session starts or ends, not just whenever
          the next device_readings tick happens to land. */}
      {chargerIds.length > 0 && (
        <>
          <RealtimeRefresh table="charging_sessions" event="INSERT" filter={`device_id=in.(${chargerIds.join(",")})`} />
          <RealtimeRefresh table="charging_sessions" event="UPDATE" filter={`device_id=in.(${chargerIds.join(",")})`} />
        </>
      )}
      {/* Weather comes from an external API, not a table this app owns —
          nothing to subscribe to, so it's kept current on a plain timer
          instead (see WEATHER_REFRESH_MS / getCurrentWeather's own cache
          window in @/lib/weather). */}
      <IntervalRefresh intervalMs={WEATHER_REFRESH_MS} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeatherHeader address={site.address} siteName={site.name} latitude={site.latitude} longitude={site.longitude} />
        {overview && (
          <DeviceStatusPill
            inverterState={overview.get("inverter_state")}
            activeFaultCode={overview.get("active_fault_code")}
            inverterStateOptions={inverterStateOptions}
          />
        )}
      </div>

      {!overview ? (
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

          <SolarLiveStatusCards supabase={supabase} site={site} />

          <EvLiveStatusCards supabase={supabase} site={site} />

          {inverterId && <PowerGenerationChart deviceId={inverterId} />}

          {chargerIds.length > 0 && (
            <ChargingSessionsCarousel
              deviceId={chargerIds[0]}
              sessions={chargingSummary?.sessions ?? []}
              ratedPowerW={chargingSummary?.ratedPowerW ?? null}
              currentPowerW={chargingSummary?.currentPowerW ?? null}
              currentA={chargingSummary?.currentA ?? null}
              voltageV={chargingSummary?.voltageV ?? null}
              temperatureC={chargingSummary?.temperatureC ?? null}
              connectorStatus={chargingSummary?.connectorStatus ?? null}
              connectorStatusOptions={connectorStatusOptions}
              tariffRate={tariffRate}
              showCost={site.propertyType !== "residential_independent_villas"}
              recentStats={recentChargingStats}
            />
          )}
        </>
      )}
    </div>
  );
}
