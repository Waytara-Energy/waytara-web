import { createClient } from "@waytara/supabase/server";
import { type CustomerDevice } from "@/lib/selected-site";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import { fetchEnumOptions } from "@/lib/instrument-catalog-data";
import { fetchTodayChargingSessions, FAULT_BITMASK_KEYS } from "@/lib/device-overview";
import { getLastSyncInfo } from "@/lib/device-sync";
import { getConnectorStatusLabel, getErrorCodeLabel } from "@/lib/ev-charger-catalog";
import { energyOfSessions, openSession, openTransactionId, sessionStartKwh, todayChartPoints, type TabSession } from "@/lib/ev-tab";
import { sourceShares, sessionEnergyKwh, type EvSampleRow } from "@/lib/ev-sessions";
import {
  fetchDashboardFields,
  fetchFieldValues,
  resolveComputedValues,
  type FieldValue,
  type FieldGroup,
  type CategorySection,
} from "@/lib/template-fields";
import { TEMPERATURE_MAX_C } from "@/lib/temperature-thresholds";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TriangleAlert, Plug, Zap } from "lucide-react";
import { ChargerTrendGroup } from "./lazy-charts";
import { SolarMonitoringView } from "./solar-monitoring-view";
import { FLOW } from "./flow-colors";
import { EvHubCards, EvHubGroups } from "./ev-hub-live";
import { temperatureRowsFor } from "@/lib/temperature-rows";
import { valuesFor, enumToObject } from "@/lib/field-values";
import { SessionReceiptCard, type ReceiptSection } from "./session-receipt-card";
import { getUnitPrefs } from "@/lib/unit-prefs-server";
import { DeviceParameterCards } from "./device-parameter-cards";
import { MonitoringTabs } from "./monitoring-tabs";
import { EvChargeControl } from "./ev-charge-control";
import { EvLiveTiles } from "./ev-live-tiles";
import { EvTodayChart } from "./ev-today-chart";
import { EvTabSessions } from "./ev-tab-sessions";
import { StatusPill } from "./status-pill";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Cross-page reads — real keys, but their own equipment_templates row is
// tagged dashboard_section: "Overview" (state-of-the-system totals like
// SOC/site power flow), not "Monitoring". Reused here the same way
// EnergyFlowDiagram/TodaySoFar already reuse them on Overview — a field's
// dashboard_section says which screen renders its own full detail, it
// doesn't forbid a different screen's headline tile from reading the same
// real value.
const OVERVIEW_CROSSREF_KEYS = [
  "battery_power_w",
  "battery_soc_pct",
  "grid_total_power_w",
  "load_total_power_w",
  "inverter_run_state",
  "day_pv_energy_kwh",
  "day_grid_import_energy_kwh",
  "day_grid_export_energy_kwh",
  "day_load_energy_kwh",
  ...FAULT_BITMASK_KEYS,
];

/** Picks the right category-specific live Monitoring body — mirrors
 *  DeviceOverviewContent's dispatch pattern (Phase 1), applied to
 *  Monitoring's live-polling charts instead of the static Overview
 *  snapshot. A category without one yet falls back to the same generic
 *  parameter cards every other unhandled category gets elsewhere. */
export async function MonitoringContent({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const category = device.deviceType?.category;

  if (category === "solar_inverter") {
    return <SolarInverterMonitoring supabase={supabase} device={device} />;
  }
  if (category === "ev_charger") {
    return <EvChargerMonitoring supabase={supabase} device={device} />;
  }

  const parameters = await fetchDeviceParameterReadings(supabase, device);
  return <DeviceParameterCards parameters={parameters} />;
}

// EV's own top-level categories (each one group_name: null group) in
// display priority — safety-relevant state leads, capability/config info
// (Vehicle DC's ratings) trails, same "most urgent first" reasoning as
// GROUP_PRIORITY above, just one level up since these sit side by side as
// whole categories rather than named groups within one.
const EV_HUB_CATEGORY_PRIORITY = ["Connector & Safety", "DC Output", "Energy Meter", "Vehicle (EV) — DC", "Temperature & Cooling"];

function sortSectionsByCategory(sections: CategorySection[], order: string[]): { category: string; group: FieldGroup }[] {
  const flat = sections.flatMap((s) => s.groups.map((group) => ({ category: s.category, group })));
  return flat.sort((a, b) => {
    const ai = order.indexOf(a.category);
    const bi = order.indexOf(b.category);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

async function SolarInverterMonitoring({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  // sections is this device's own real, DB-driven Monitoring field list - every group here is something this
  // specific installation's own equipment_metrics rows confirm exist.
  const sections = await fetchDashboardFields(supabase, device, "Monitoring");
  const byCategory = new Map(sections.map((s) => [s.category, s.groups]));

  // The "Temperature" group's own fields are shown exclusively via the Temperature Today heatmap (a time-series
  // view suits a sensor reading far better than one more flat current-value row).
  const inverterGroups = (byCategory.get("Inverter") ?? []).filter((g) => g.groupName !== "Temperature");
  const inverterTemperatureRows = temperatureRowsFor((byCategory.get("Inverter") ?? []).find((g) => g.groupName === "Temperature")?.fields ?? []);
  const batteryGroups = byCategory.get("Battery") ?? [];

  const dynamicFields = sections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const monitoringKeys = dynamicFields.map((f) => f.key);
  const enumRefs = Array.from(new Set(dynamicFields.map((f) => f.enumRef).filter((r): r is string => r !== null)));

  const [rawValues, lastSync, enumOptions] = await Promise.all([
    fetchFieldValues(supabase, device.id, [...monitoringKeys, ...OVERVIEW_CROSSREF_KEYS]),
    getLastSyncInfo(device.id),
    fetchEnumOptions(supabase, [...enumRefs, "inverter_state"]),
  ]);
  const values = resolveComputedValues(dynamicFields, rawValues, device);

  // Everything below is handed to the client view as plain data: the server renders the first numbers, the view
  // keeps them live (see SolarMonitoringView).
  const initialValues: Record<string, FieldValue> = {};
  for (const k of [...monitoringKeys, ...OVERVIEW_CROSSREF_KEYS, ...MONITORING_EXTRA_KEYS]) initialValues[k] = values.get(k) ?? rawValues.get(k) ?? null;
  const computedKeys = new Set(dynamicFields.filter((f) => f.source === "computed").map((f) => f.key));
  const liveKeys = Object.keys(initialValues).filter((k) => !computedKeys.has(k));

  return (
    <SolarMonitoringView
      deviceId={device.id}
      initialValues={initialValues}
      liveKeys={liveKeys}
      categories={Object.fromEntries(byCategory)}
      inverterGroups={inverterGroups}
      batteryGroups={batteryGroups}
      inverterTemperatureRows={inverterTemperatureRows}
      enumOptions={Object.fromEntries(enumOptions)}
      sync={lastSync}
    />
  );
}

// Keys the solar view reads directly (headline cards) that are not necessarily Monitoring-section fields.
const MONITORING_EXTRA_KEYS = [
  "grid_relay_status",
  "day_active_energy_kwh",
  "day_reactive_energy_kvarh",
  "inverter_l1_voltage_v",
  "inverter_l1_current_a",
  "inverter_output_frequency_hz",
  "inverter_output_power_w",
  "total_pv_energy_kwh",
  "day_battery_charge_energy_kwh",
  "day_battery_discharge_energy_kwh",
  "load_l1_power_w",
  "load_l2_power_w",
  "load_frequency_hz",
  "grid_l1_voltage_v",
  "grid_l1_current_a",
  "grid_frequency_hz",
  "generator_power_w",
  "generator_voltage_v",
  "generator_frequency_hz",
];

async function EvChargerMonitoring({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const rawSections = await fetchDashboardFields(supabase, device, "Monitoring");
  const dynamicFields = rawSections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const monitoringKeys = dynamicFields.map((f) => f.key);
  const enumRefs = Array.from(new Set(dynamicFields.map((f) => f.enumRef).filter((r): r is string => r !== null)));

  // connector_temperature_c and current_import_l1_a are each shown
  // exclusively via a purpose-built chart below (the Temperature Today
  // heatmap, ChargerTrendGroup's own Current series — same reasoning as the
  // solar branch's Inverter > Temperature group) — dropped from their
  // category's generic field list so neither also renders a second time as
  // a plain stat row.
  const connectorTemperatureRows = temperatureRowsFor(dynamicFields);
  const chartedElsewhereKeys = new Set(["current_import_l1_a"]);
  const sections = rawSections.map((s) => ({
    ...s,
    groups: s.groups
      .map((g) => ({ ...g, fields: g.fields.filter((f) => !(f.key in TEMPERATURE_MAX_C) && !chartedElsewhereKeys.has(f.key)) }))
      .filter((g) => g.fields.length > 0),
  }));
  const currentL1Field = dynamicFields.find((f) => f.key === "current_import_l1_a");

  // "Live Session" is its own dashboard_section (Authorization/Billing/
  // Session/Vehicle (EV) — DC, 26 fields) — brand new, no existing screen
  // rendered it before. Its natural home is this same tab's own
  // "Charging Session" panel, right alongside ChargingSessionsCarousel,
  // rather than a whole new nav destination for one EV-only section.
  const liveSessionSections = await fetchDashboardFields(supabase, device, "Live Session");
  const liveSessionFields = liveSessionSections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const liveSessionKeys = liveSessionFields.map((f) => f.key);

  // What's happening right now (Session) leads; who/how it was authorized
  // and what it's costing trail — same "most urgent/actionable first"
  // ordering as the Hub tab's own category priority, just for the receipt
  // card's own sections instead of a row of group cards.
  const liveSessionByCategory = new Map(liveSessionSections.map((s) => [s.category, s.groups.flatMap((g) => g.fields)]));
  const LIVE_SESSION_CATEGORY_PRIORITY = ["Session", "Vehicle (EV) — DC", "Authorization", "Billing"];
  const receiptSections: ReceiptSection[] = LIVE_SESSION_CATEGORY_PRIORITY.map((category) => ({
    title: category,
    fields: liveSessionByCategory.get(category) ?? [],
  })).filter((s) => s.fields.length > 0);
  for (const s of liveSessionSections) {
    if (!LIVE_SESSION_CATEGORY_PRIORITY.includes(s.category)) {
      receiptSections.push({ title: s.category, fields: s.groups.flatMap((g) => g.fields) });
    }
  }

  // connector_status/error_code are Overview-owned fields, reused here for
  // the same charger-hub status pill/fault banner the Overview page shows —
  // same cross-page reuse convention as the solar branch's
  // OVERVIEW_CROSSREF_KEYS above.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const [{ data: snapshotReadings }, chargingSummary, enumOptions, { data: tabRows }, sync] = await Promise.all([
    supabase
      .from("equipment_latest")
      .select("key_name, value, ts")
      .eq("equipment_id", device.id)
      .in("key_name", [...monitoringKeys, ...liveSessionKeys, "connector_status", "error_code", "energy_active_import_register_kwh"]),
    fetchTodayChargingSessions(supabase, device.id),
    fetchEnumOptions(supabase, [...enumRefs, "connector_status", "error_code"]),
    // the EV tab: today's sessions with their figures, and any session that is still open (it may have begun before midnight)
    supabase
      .from("ev_sessions")
      .select("id, started_at, ended_at, status, ocpp_transaction_id, peak_power_kw, solar_share_pct, charging_seconds, meter_start_wh, meter_stop_wh, start_energy_kwh, end_energy_kwh, target_kwh, energy_from_solar_kwh, energy_from_battery_kwh, energy_from_grid_kwh, energy_unattributed_kwh")
      .eq("equipment_id", device.id)
      .or(`started_at.gte.${todayStart.toISOString()},ended_at.is.null`)
      .order("started_at", { ascending: false })
      .limit(100),
    getLastSyncInfo(device.id),
  ]);
  const tabSessions = (tabRows ?? []) as TabSession[];
  // today's samples, session by session, for the day's power chart
  const { data: sampleRows } = tabSessions.length
    ? await supabase
        .from("ev_session_samples")
        .select("session_id, ts, energy_kwh, power_kw, current_a_l1, voltage_v_l1, soc_pct, ev_from_solar_w, ev_from_battery_w, ev_from_grid_w")
        .in("session_id", tabSessions.map((x) => x.id))
        .order("ts", { ascending: true })
        .limit(6000)
    : { data: [] as (EvSampleRow & { session_id: string })[] };
  const samplesBySession = new Map<string, EvSampleRow[]>();
  for (const r of (sampleRows ?? []) as (EvSampleRow & { session_id: string })[]) {
    const list = samplesBySession.get(r.session_id) ?? [];
    list.push(r);
    samplesBySession.set(r.session_id, list);
  }
  const todayPoints = todayChartPoints([...samplesBySession.values()]);
  const todayKwh = energyOfSessions(tabSessions);
  const todayPeakKw = tabSessions.reduce<number | null>((m, x) => (x.peak_power_kw !== null && (m === null || x.peak_power_kw > m) ? x.peak_power_kw : m), null);
  const todaySummary =
    tabSessions.length === 0
      ? "No charge today yet. The curve appears once a charge has started."
      : `${todayKwh.toFixed(1)} kWh · ${tabSessions.length} ${tabSessions.length === 1 ? "charge" : "charges"}${todayPeakKw !== null ? ` · peak ${todayPeakKw.toFixed(1)} kW` : ""}`;
  const finished = tabSessions.find((x) => x.ended_at !== null);
  const lastCharge = finished
    ? `Last charge ${(sessionEnergyKwh(finished) ?? 0).toFixed(1)} kWh, ${new Date(finished.started_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}`
    : null;
  const running = openSession(tabSessions);
  const transactionId = openTransactionId(tabSessions);
  const connected = sync.deviceOnline;

  const latest = new Map<string, number | null>();
  for (const r of snapshotReadings ?? []) {
    if (!latest.has(r.key_name)) latest.set(r.key_name, r.value);
  }
  const getValue = (key: string): FieldValue => latest.get(key) ?? null;
  const errorLabel = getErrorCodeLabel(getValue("error_code") as number | null, enumOptions.get("error_code") ?? []);

  const powerKw = getValue("power_active_import_kw") as number | null;
  const offeredKw = getValue("power_offered_kw") as number | null;

  const connectorStatus = connected === false ? { label: "Offline", tone: "bad" as const } : getConnectorStatusLabel(getValue("connector_status") as number | null, enumOptions.get("connector_status") ?? []);
  const ratedKw = chargingSummary.ratedPowerW !== null ? chargingSummary.ratedPowerW / 1000 : offeredKw;
  const sessionsToday = chargingSummary.sessions.length;
  const energyTodayKwh = chargingSummary.sessions.reduce((sum, s) => sum + (s.energyKwh ?? 0), 0);

  return (
    <>
      {/* Two panels rather than one long scroll: the charger's own live
          detail (power/current/temperature/OCPP fields) versus its
          session history — different questions ("is it healthy right
          now?" vs. "what did it actually deliver?"), so they get their
          own tabs instead of being stacked on one page. */}
      <MonitoringTabs key={device.id} defaultValue="ev" headlines={{}} validValues={["ev", "hub"]} aliases={{ sessions: "ev" }}>
        <TabsList variant="line">
          <TabsTrigger value="ev" variant="line">
            {/* written out here: this file is a server component and an icon cannot be passed to the client TabButtonContent */}
            <Zap className="size-4 shrink-0 group-data-[state=active]:hidden" />
            <span className="text-sm font-medium">EV</span>
          </TabsTrigger>
          <TabsTrigger value="hub" variant="line">
            <Plug className="size-4 shrink-0 group-data-[state=active]:hidden" />
            <span className="text-sm font-medium">Charger data</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hub" className="space-y-4">
          {errorLabel ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Charger fault</AlertTitle>
              <AlertDescription>{errorLabel}</AlertDescription>
            </Alert>
          ) : null}

          <EvHubCards
            deviceId={device.id}
            initial={{ power_active_import_kw: powerKw, power_offered_kw: offeredKw }}
            sessionsToday={sessionsToday}
            energyTodayKwh={energyTodayKwh}
          />

          <ChargerTrendGroup
            deviceId={device.id}
            powerSeries={[
              {
                key: "power_active_import_kw",
                label: "Power",
                color: FLOW.consuming,
                scale: 1,
                unit: "kW",
                footerMode: "sum",
                footerUnit: "kWh",
              },
              {
                key: "current_import_l1_a",
                label: currentL1Field?.label ?? "Current",
                color: "var(--chart-2)",
                scale: 1,
                unit: "A",
                footerMode: "average",
              },
            ]}
            sessionMarkers={chargingSummary.sessions.map((sess) => ({
              startedAt: sess.startedAt,
              endedAt: sess.endedAt,
              energyKwh: sess.energyKwh,
            }))}
            temperatureRows={connectorTemperatureRows}
          />

          <EvHubGroups
            deviceId={device.id}
            groups={sortSectionsByCategory(sections, EV_HUB_CATEGORY_PRIORITY)}
            initial={valuesFor(sections.flatMap((x) => x.groups.flatMap((g) => g.fields)), getValue)}
            enumOptions={enumToObject(enumOptions) ?? {}}
          />
        </TabsContent>

        <TabsContent value="ev" className="space-y-4">
          {errorLabel ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Charger fault</AlertTitle>
              <AlertDescription>{errorLabel}</AlertDescription>
            </Alert>
          ) : null}

          {/* The charger now: its name and state, how it is connected, and Start / Stop (a real charge, through the hub). */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Zap className="size-5" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{device.label ?? device.deviceType?.name ?? "EV charger"}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusPill label={connectorStatus.label} tone={connectorStatus.tone} />
                  <span className="text-xs text-muted-foreground">
                    {connected === false ? "Not connected right now" : connected === true ? "Connected through the monitoring unit" : "Connection not known yet"}
                    {running ? ` · charging since ${new Date(running.started_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}` : ""}
                  </span>
                </div>
              </div>
            </div>
            <EvChargeControl chargerId={device.id} sessionOpen={!!running} transactionId={transactionId} connected={connected} compact={!!running} />
          </div>

          <EvLiveTiles
            deviceId={device.id}
            initial={{ kw: powerKw, a: getValue("current_import_l1_a") as number | null, v: getValue("voltage_l1_n_v") as number | null, registerKwh: getValue("energy_active_import_register_kwh") as number | null }}
            ratedKw={ratedKw}
            charging={!!running}
            session={
              running
                ? {
                    startedAt: running.started_at,
                    startKwh: sessionStartKwh(running),
                    targetKwh: running.target_kwh ?? null,
                    shares: sourceShares({
                      energy_from_solar_kwh: running.energy_from_solar_kwh ?? null,
                      energy_from_battery_kwh: running.energy_from_battery_kwh ?? null,
                      energy_from_grid_kwh: running.energy_from_grid_kwh ?? null,
                      energy_unattributed_kwh: running.energy_unattributed_kwh ?? null,
                    }),
                    solarPct: running.solar_share_pct,
                  }
                : null
            }
            lastCharge={lastCharge}
          />

          <EvTodayChart points={todayPoints} summary={todaySummary} />

          <EvTabSessions sessions={tabSessions} deviceId={device.id} />

          <SessionReceiptCard title="Live session details" sections={receiptSections} getValue={getValue} enumOptionsByRef={enumOptions} units={await getUnitPrefs()} />
        </TabsContent>
      </MonitoringTabs>
    </>
  );
}
