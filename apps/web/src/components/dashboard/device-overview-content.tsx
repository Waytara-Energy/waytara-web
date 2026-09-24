import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice, CustomerSite } from "@/lib/selected-site";
import { fetchDeviceOverview } from "@/lib/device-overview";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import { fetchEnumOptions } from "@/lib/instrument-catalog-data";
import { DeviceStatusPill } from "./device-status-pill";
import { FaultBanner } from "./fault-banner";
import { EnergyFlowDiagram } from "./energy-flow-diagram";
import { TodaySoFar } from "./today-so-far";
import { RecentAlerts } from "./recent-alerts";
import { EvChargerOverview } from "./ev-charger-overview";
import { DeviceParameterCards } from "./device-parameter-cards";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Picks the right curated telemetry Overview for a device's own category
 *  — one place used by both the main Overview page's per-device tabs and
 *  the Devices module's detail page, so the two never drift into showing
 *  different things for the same device. Settings-editing is a separate
 *  section on the Devices detail page (see instrument-settings-catalog.ts
 *  / getSettingCategories) — this component is telemetry/status only.
 *
 *  Both curated views are a today/now snapshot, not a lifetime one —
 *  cumulative figures (lifetime PV generation, the EV charger's OCPP
 *  lifetime energy register) belong on Performance/Analytics instead:
 *    - solar_inverter: status pill, fault banner, energy-flow diagram,
 *      today-so-far totals (fetchDeviceOverview) — the inverter's own
 *      fixed key list genuinely matches what this category reports.
 *    - ev_charger: status pill, fault banner, live charging stats, and
 *      today's energy/cost computed from charging_sessions
 *      (EvChargerOverview) — built from OCPP MeterValues telemetry, not
 *      the inverter's key list.
 *
 *  A category without a curated view yet (a new device type/vendor added
 *  later) falls back to the generic, fully data-driven parameter cards
 *  (@/lib/device-catalog-data) rather than showing nothing. The extension
 *  point for a new category is adding another branch here plus its own
 *  Overview component — this is the single place that changes, not
 *  either caller. */
export async function DeviceOverviewContent({
  supabase,
  site,
  device,
  showAlerts = true,
  showEnergyFlowDiagram = true,
}: {
  supabase: SupabaseServerClient;
  site: CustomerSite;
  device: CustomerDevice;
  showAlerts?: boolean;
  /** Overview's "All" tab already shows one site-wide energy-flow diagram
   *  above these per-device tabs — a device tab rendering its own copy
   *  underneath was showing the same diagram twice on one page. Pass
   *  false there; the Devices module's detail page (where nothing else on
   *  the page shows a diagram) leaves this at its default. */
  showEnergyFlowDiagram?: boolean;
}) {
  const category = device.deviceType?.category;

  if (category === "solar_inverter") {
    const [overview, inverterStateOptions] = await Promise.all([
      fetchDeviceOverview(supabase, site, device),
      fetchEnumOptions(supabase, ["inverter_state"]).then((m) => m.get("inverter_state") ?? []),
    ]);
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <DeviceStatusPill
            inverterState={overview.get("inverter_state")}
            activeFaultCode={overview.get("active_fault_code")}
            inverterStateOptions={inverterStateOptions}
          />
        </div>

        <FaultBanner faultCode={overview.get("active_fault_code")} />

        {showEnergyFlowDiagram && (
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
        )}

        <TodaySoFar get={overview.get} />

        {showAlerts && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Recent Alerts</h3>
            <RecentAlerts deviceIds={[device.id]} initialAlerts={overview.recentAlerts} />
          </div>
        )}
      </div>
    );
  }

  if (category === "ev_charger") {
    return <EvChargerOverview supabase={supabase} device={device} showAlerts={showAlerts} />;
  }

  const parameters = await fetchDeviceParameterReadings(supabase, device);
  return <DeviceParameterCards parameters={parameters} />;
}
