import { Zap } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite } from "@/lib/selected-site";
import { getRequestProfile } from "@/lib/request-profile";
import { fetchSiteOverview, fetchTodayChargingSessions, fetchRecentChargingStats } from "@/lib/device-overview";
import { getCustomerPlan } from "@/lib/customer-plan";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { WeatherHeader } from "@/components/dashboard/weather-header";
import { LiveChannelKeeper, LiveEnergyFlow, LiveFaultBanner, LiveStatusPill } from "@/components/dashboard/overview-live";
import { SITE_OVERVIEW_KEYS } from "@/lib/overview-keys";
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
    // enum_ref stays "inverter_state" (equipment_enum wasn't reseeded under
    // the new key name) even though the equipment_templates/equipment_metrics
    // key itself is now "inverter_run_state" — the enum library and the
    // field key are two separate names by design (an enum_ref is meant to
    // be reusable across differently-named fields).
    inverterId ? fetchEnumOptions(supabase, ["inverter_state"]).then((m) => m.get("inverter_state") ?? []) : Promise.resolve([]),
  ]);
  const tariffRate = customerPlan?.tariffRatePerKwh ?? 8;
  const inverterIds = site.devices.filter((d) => d.deviceType?.category === "solar_inverter").map((d) => d.id);
  // What the server saw; the live components take it from here (no page refresh).
  const overviewInitial: Record<string, number | null> = overview ? Object.fromEntries(SITE_OVERVIEW_KEYS.map((k) => [k, overview.get(k)])) : {};

  return (
    <div className="space-y-6">
      {/* Live numbers (status pill, fault banner, energy flow, status cards, charts) update in place from the
          device's live channel - there is no page refresh on new readings. The channel is only open while this
          tab is visible. */}
      <LiveChannelKeeper deviceIds={[...inverterIds, ...chargerIds]} />
      {/* ev_sessions isn't reflected in equipment_telemetry at all (it's
          a derived table, not a raw reading) — a session opening is an
          INSERT, closing is an UPDATE on that same row, so both need their
          own subscription for "Energy Delivered Today" and the EV cards to
          catch up the moment a session starts or ends, not just whenever
          the next equipment_telemetry tick happens to land. */}
      {chargerIds.length > 0 && (
        <>
          <RealtimeRefresh table="ev_sessions" event="INSERT" filter={`equipment_id=in.(${chargerIds.join(",")})`} />
          <RealtimeRefresh table="ev_sessions" event="UPDATE" filter={`equipment_id=in.(${chargerIds.join(",")})`} />
        </>
      )}
      {/* Weather comes from an external API, not a table this app owns —
          nothing to subscribe to, so it's kept current on a plain timer
          instead (see WEATHER_REFRESH_MS / getCurrentWeather's own cache
          window in @/lib/weather). */}
      <IntervalRefresh intervalMs={WEATHER_REFRESH_MS} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeatherHeader address={site.address} siteName={site.name} latitude={site.latitude} longitude={site.longitude} />
        {overview && <LiveStatusPill inverterIds={inverterIds} initial={overviewInitial} inverterStateOptions={inverterStateOptions} />}
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
          <LiveFaultBanner inverterIds={inverterIds} initial={overviewInitial} />

          <LiveEnergyFlow
            inverterIds={inverterIds}
            chargerIds={chargerIds}
            initial={overviewInitial}
            initialEvW={overview.evW}
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
