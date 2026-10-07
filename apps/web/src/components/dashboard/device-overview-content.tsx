import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice, CustomerSite } from "@/lib/selected-site";
import { fetchDeviceOverview } from "@/lib/device-overview";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import { fetchEnumOptions } from "@/lib/instrument-catalog-data";
import { fetchDashboardFields, fetchFieldValues, resolveComputedValues } from "@/lib/template-fields";
import { LiveDynamicFieldGroup } from "./live-field-group";
import { valuesFor } from "@/lib/field-values";
import { getLastSyncInfo } from "@/lib/device-sync";
import { DeviceOfflineNotice, LiveChannelKeeper, LiveEnergyFlow, LiveFaultBanner, LiveTodaySoFar } from "./overview-live";
import { OverviewStatus } from "./overview-go-live";
import { SITE_OVERVIEW_KEYS } from "@/lib/overview-keys";
import { RecentAlerts } from "./recent-alerts";
import { EvChargerOverview } from "./ev-charger-overview";
import { DeviceParameterCards } from "./device-parameter-cards";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// solar's Overview dashboard_section is one flat "Overview" category split
// into 11 group_names — most of them (Battery, Grid import/export, Home
// load, Inverter status, Live solar production, Today consumption/
// production) are already shown via the bespoke DeviceStatusPill/
// EnergyFlowDiagram/TodaySoFar cards below. Only these groups have no
// bespoke home yet, so they're the ones rendered dynamically.
const SOLAR_OVERVIEW_LEFTOVER_GROUPS = new Set(["CO₂ saved today", "Self use", "Weather", "Work mode"]);

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
    // enum_ref stays "inverter_state" even though the field's own key is
    // now "inverter_run_state" — see dashboard/page.tsx's identical note.
    const [overview, inverterStateOptions, leftoverSections, lastSync] = await Promise.all([
      fetchDeviceOverview(supabase, site, device),
      fetchEnumOptions(supabase, ["inverter_state"]).then((m) => m.get("inverter_state") ?? []),
      fetchDashboardFields(supabase, device, "Overview"),
      getLastSyncInfo(device.id),
    ]);
    const allOverviewFields = leftoverSections.flatMap((s) => s.groups.flatMap((g) => g.fields));
    const leftoverGroups = leftoverSections.flatMap((s) => s.groups).filter((g) => SOLAR_OVERVIEW_LEFTOVER_GROUPS.has(g.groupName ?? ""));
    const leftoverFields = leftoverGroups.flatMap((g) => g.fields);
    const leftoverRawValues = await fetchFieldValues(
      supabase,
      device.id,
      leftoverFields.map((f) => f.key)
    );
    const leftoverValues = resolveComputedValues(leftoverFields, leftoverRawValues, device);
    const getLeftoverValue = (key: string) => leftoverValues.get(key) ?? null;
    // What the server saw; the live components take it from here (no page refresh).
    const initial: Record<string, number | null> = Object.fromEntries(SITE_OVERVIEW_KEYS.map((k) => [k, overview.get(k)]));
    const inverterIds = [device.id];
    return (
      <div className="space-y-4">
        <LiveChannelKeeper deviceIds={inverterIds} />
        <div className="flex justify-end">
          <OverviewStatus inverterIds={inverterIds} initial={initial} inverterStateOptions={inverterStateOptions} sync={lastSync} />
        </div>

        <DeviceOfflineNotice deviceId={device.id} sync={lastSync} />

        <LiveFaultBanner inverterIds={inverterIds} initial={initial} />

        {showEnergyFlowDiagram && (
          <LiveEnergyFlow
            inverterIds={inverterIds}
            initial={initial}
            initialEvW={overview.evW}
            powerPackage={site.powerPackage}
            powerSourceCategory={site.powerSourceCategory}
            sync={lastSync}
          />
        )}

        <LiveTodaySoFar inverterIds={inverterIds} initial={initial} fields={allOverviewFields} enabledKeys={[...overview.enabledKeys]} />

        {leftoverGroups.length > 0 && (
          // Columns, not a grid — see the Devices page's identical note on
          // why (uneven card heights + grid's row-major placement leaves
          // gaps a masonry-style column flow doesn't).
          <div className="columns-1 gap-4 sm:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {leftoverGroups.map((group) => (
              <LiveDynamicFieldGroup key={group.groupName ?? ""} deviceId={device.id} title={group.groupName ?? "Overview"} fields={group.fields} initial={valuesFor(group.fields, getLeftoverValue)} />
            ))}
          </div>
        )}

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
