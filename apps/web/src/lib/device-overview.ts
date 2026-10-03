import "server-only";
import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice, CustomerSite } from "./selected-site";
import { fetchReadKeys } from "./instrument-catalog-data";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Today's day-bucketed energy totals — the equipment_templates equivalent
// of the old TODAY_ENERGY_FIELDS import (that file/constant is retired —
// see template-fields.ts). All four genuinely live under the Overview
// dashboard_section in the new inventory (day_active_energy_kwh/
// day_reactive_energy_kvarh, which the old list also carried, are
// Monitoring-section fields now — handled there instead, not duplicated
// onto Overview).
const TODAY_ENERGY_KEYS = ["day_pv_energy_kwh", "day_grid_import_energy_kwh", "day_grid_export_energy_kwh", "day_load_energy_kwh"];

// The raw bitmask/code registers active_fault_code used to be a single
// decoded value for — the new workbook has no single "fault code" register
// anymore, only per-source bitmasks (see fault-code doc comment below).
export const FAULT_BITMASK_KEYS = ["fault_message_1", "fault_message_2", "fault_message_3", "fault_message_4", "alarm_status_1", "alarm_status_2"];

// Instruments a device's full detail view needs — filtered explicitly
// rather than "most recent N readings across every instrument" (the old
// approach), since the catalog now has hundreds of instruments and a flat
// top-N window could miss one that just hasn't reported as often as the
// others. Key names match the real equipment_templates/equipment_metrics
// vocabulary (not the old instrument_catalog one) — solar generation in
// particular moved from a single "inverter_power_w" to
// "inverter_output_power_w" (Monitoring > Inverter > AC output, the
// closest real per-device register to "combined PV output"); grid/load
// pick up their Overview-section totals rather than a per-phase Monitoring
// reading.
export const OVERVIEW_KEYS = [
  "inverter_output_power_w",
  "battery_power_w",
  "grid_total_power_w",
  "load_total_power_w",
  "battery_soc_pct",
  "inverter_run_state",
  ...FAULT_BITMASK_KEYS,
  ...TODAY_ENERGY_KEYS,
];

/** active_fault_code doesn't exist as its own register anymore — the new
 *  workbook only carries raw, undocumented bitmasks (fault_message_1-4,
 *  alarm_status_1-2). deye-fault-codes.ts's getFaultInfo() already handles
 *  an unrecognized code gracefully (a generic "Fault F{code}, contact
 *  support" message, not a wrong specific diagnosis) — so rather than
 *  losing fault detection entirely, the first non-zero bitmask value found
 *  is passed through as that code. Not a real decoded Deye fault code
 *  anymore, just "something's flagged, here's the raw register value for
 *  support to look up" — honest about what it actually is. */
export function deriveFaultCode(getValue: (key: string) => number | null): number | null {
  for (const key of FAULT_BITMASK_KEYS) {
    const v = getValue(key);
    if (v) return v;
  }
  return null;
}

export interface AlertRow {
  id: string;
  device_id: string;
  severity: string;
  message: string;
  ts: string;
  acknowledged_at: string | null;
}

export interface DeviceOverviewData {
  get: (key: string) => number | null;
  /** The site's EV charger reading in W, or null when the site has no
   *  charger at all, or has one that hasn't reported yet (distinct from a
   *  charger actively reporting 0 W). */
  evW: number | null;
  recentAlerts: AlertRow[];
  /** Read-direction instrument keys this device's own stock model +
   *  device_feature_flags actually confirm exist (fetchReadKeys) — lets a
   *  renderer like TodaySoFar drop a field/section instead of showing a
   *  permanently-blank row for a register this install doesn't have. */
  enabledKeys: Set<string>;
}

/** Shared by the site Overview page (for its primary device) and a
 *  device's own detail page — both render the exact same energy-flow
 *  diagram / fault banner / today-so-far / recent-alerts block, just
 *  reached two different ways, so the data-fetching lives in one place
 *  rather than drifting between two copies. */
export async function fetchDeviceOverview(supabase: SupabaseServerClient, site: CustomerSite, device: CustomerDevice): Promise<DeviceOverviewData> {
  // The EV charger, if this site has one — a separate device from
  // `device` (could even be this same device), so its charging power is
  // fetched alongside `device`'s own readings rather than folded into
  // OVERVIEW_KEYS, which is scoped to the inverter's registers. Only the
  // *first* charger is shown if a site somehow had more than one — same
  // "one representative reading" simplification as everything else here.
  const evCharger = site.devices.find((d) => d.deviceType?.category === "ev_charger");

  const readKeys = await fetchReadKeys(supabase, device);
  const overviewKeys = OVERVIEW_KEYS.filter((k) => readKeys.has(k));

  // Latest value per instrument comes straight from equipment_latest (one
  // row per device+key, trigger-maintained) - no windowed guess.
  const [{ data: recentReadings }, { data: recentAlerts }, { data: evReadings }] = await Promise.all([
    supabase
      .from("equipment_latest")
      .select("key_name, value, unit, ts")
      .eq("equipment_id", device.id)
      .in("key_name", overviewKeys),
    supabase
      .from("alerts")
      .select("id, device_id, severity, message, ts, acknowledged_at")
      .eq("device_id", device.id)
      .is("acknowledged_at", null)
      .order("ts", { ascending: false })
      .limit(5),
    evCharger
      ? supabase
          .from("equipment_latest")
          .select("value, ts")
          .eq("equipment_id", evCharger.id)
          .eq("key_name", "power_active_import_kw")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const latest = new Map<string, number | null>();
  for (const r of recentReadings ?? []) {
    if (!latest.has(r.key_name)) latest.set(r.key_name, r.value);
  }
  const rawGet = (key: string) => latest.get(key) ?? null;

  return {
    // "active_fault_code" is a synthetic key now (see deriveFaultCode) —
    // never actually fetched, derived on read from whichever real bitmask
    // registers are non-zero.
    get: (key: string) => (key === "active_fault_code" ? deriveFaultCode(rawGet) : rawGet(key)),
    // power_active_import_kw is in kW (moved from W under the new OCPP
    // key vocabulary — see ev-live-status-cards.tsx's identical note);
    // evW is a Watts figure everywhere it's consumed (EnergyFlowDiagram's
    // fmtW), so ×1000 here. Null when there's no charger at all, or when
    // the charger exists but has never reported a reading — both cases
    // read the same to the diagram (leave the wire off) rather than the
    // second one showing a charger reading a literal, misleading 0 W.
    evW: evCharger && evReadings?.value != null ? Math.round(evReadings.value * 1000) : null,
    recentAlerts: (recentAlerts ?? []) as AlertRow[],
    enabledKeys: readKeys,
  };
}

// Power/energy keys that are meaningful to add together across inverters —
// each is a flow or a same-day running total, so summing multiple units at
// one site gives the site's true combined figure. `battery_soc_pct` is
// deliberately excluded (see below, averaged instead of summed) and
// `inverter_run_state`/`active_fault_code` are handled separately too
// (neither is a number that makes sense to add).
const SITE_SUM_KEYS = ["inverter_output_power_w", "battery_power_w", "grid_total_power_w", "load_total_power_w", ...TODAY_ENERGY_KEYS];

/** The "All" view of Overview's filter — same shape as `fetchDeviceOverview`
 *  (so it drops into DeviceStatusPill/FaultBanner/EnergyFlowDiagram/
 *  TodaySoFar/RecentAlerts unchanged) but combined across every inverter at
 *  the site rather than scoped to one device. Only `solar_inverter` devices
 *  feed the flow/energy numbers — an EV charger has none of those
 *  instruments, it only ever contributes its own charging power, same as
 *  `fetchDeviceOverview`'s single-charger case just summed across every
 *  charger instead of taking the first. */
export async function fetchSiteOverview(supabase: SupabaseServerClient, site: CustomerSite): Promise<DeviceOverviewData> {
  const inverters = site.devices.filter((d) => d.deviceType?.category === "solar_inverter");
  const chargers = site.devices.filter((d) => d.deviceType?.category === "ev_charger");
  const inverterIds = inverters.map((d) => d.id);
  const allIds = site.devices.map((d) => d.id);

  // Union across every inverter at the site (usually just one) rather than
  // a per-device set — a key disabled on one inverter but not another
  // should still surface the site total, since the aggregation below sums
  // whichever inverters actually report it.
  const enabledKeys = new Set<string>();
  for (const readKeys of await Promise.all(inverters.map((d) => fetchReadKeys(supabase, d)))) {
    for (const k of readKeys) enabledKeys.add(k);
  }
  const overviewKeys = OVERVIEW_KEYS.filter((k) => enabledKeys.has(k));

  const [{ data: recentReadings }, { data: recentAlerts }, { data: evReadings }] = await Promise.all([
    inverterIds.length > 0
      ? supabase
          .from("equipment_latest")
          .select("equipment_id, key_name, value, ts")
          .in("equipment_id", inverterIds)
          .in("key_name", overviewKeys)
      : Promise.resolve({ data: null }),
    allIds.length > 0
      ? supabase
          .from("alerts")
          .select("id, device_id, severity, message, ts, acknowledged_at")
          .in("device_id", allIds)
          .is("acknowledged_at", null)
          .order("ts", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null }),
    chargers.length > 0
      ? supabase
          .from("equipment_latest")
          .select("equipment_id, value, ts")
          .in(
            "equipment_id",
            chargers.map((c) => c.id)
          )
          .eq("key_name", "power_active_import_kw")
      : Promise.resolve({ data: null }),
  ]);

  // latest-per-(device, instrument) — same pattern as the single-device
  // case above, just keyed on both ids since multiple inverters are mixed
  // into one query.
  const latestByDeviceKey = new Map<string, number | null>();
  for (const r of recentReadings ?? []) {
    const k = `${r.equipment_id}:${r.key_name}`;
    if (!latestByDeviceKey.has(k)) latestByDeviceKey.set(k, r.value);
  }

  const aggregated = new Map<string, number | null>();
  for (const key of SITE_SUM_KEYS) {
    let sum = 0;
    let any = false;
    for (const id of inverterIds) {
      const v = latestByDeviceKey.get(`${id}:${key}`);
      if (v !== null && v !== undefined) {
        sum += v;
        any = true;
      }
    }
    aggregated.set(key, any ? sum : null);
  }

  // Battery SOC is a percentage, not a flow — averaging across whichever
  // inverters actually report it is the sane combination, not a sum.
  {
    let sum = 0;
    let count = 0;
    for (const id of inverterIds) {
      const v = latestByDeviceKey.get(`${id}:battery_soc_pct`);
      if (v !== null && v !== undefined) {
        sum += v;
        count += 1;
      }
    }
    aggregated.set("battery_soc_pct", count > 0 ? sum / count : null);
  }

  // A fault anywhere at the site should surface at the top — first
  // non-zero bitmask across every real fault/alarm register, at any
  // inverter, wins (same "one representative reading" simplification
  // fetchDeviceOverview already uses for its EV charger lookup above, and
  // the same synthetic-key derivation as deriveFaultCode there).
  let faultCode: number | null = null;
  outer: for (const id of inverterIds) {
    for (const key of FAULT_BITMASK_KEYS) {
      const v = latestByDeviceKey.get(`${id}:${key}`);
      if (v) {
        faultCode = v;
        break outer;
      }
    }
  }
  aggregated.set("active_fault_code", faultCode);

  // Worst state wins for the combined status pill — Fault(2) > Standby(1)
  // > Normal(0) — so one struggling inverter isn't hidden behind the rest
  // reporting Normal.
  let worstState: number | null = null;
  for (const id of inverterIds) {
    const v = latestByDeviceKey.get(`${id}:inverter_run_state`);
    if (v === null || v === undefined) continue;
    if (worstState === null || v > worstState) worstState = v;
  }
  aggregated.set("inverter_run_state", worstState);

  const latestChargerReading = new Map<string, number | null>();
  for (const r of evReadings ?? []) {
    if (!latestChargerReading.has(r.equipment_id)) latestChargerReading.set(r.equipment_id, r.value);
  }
  // power_active_import_kw is in kW — same ×1000 as fetchDeviceOverview's
  // own evW above, since this is a Watts figure everywhere it's consumed.
  // Same "any ? sum : null" convention as the aggregated flow keys above —
  // null (hide the wire) when not one charger at the site has reported
  // yet, rather than defaulting every missing one to 0 and showing a
  // misleadingly precise 0 W total.
  const evW =
    chargers.length > 0 && latestChargerReading.size > 0
      ? Math.round(chargers.reduce((sum, c) => sum + (latestChargerReading.get(c.id) ?? 0), 0) * 1000)
      : null;

  return {
    get: (key: string) => aggregated.get(key) ?? null,
    evW,
    recentAlerts: (recentAlerts ?? []) as AlertRow[],
    enabledKeys,
  };
}

export interface LiveSeriesPoint {
  value: number | null;
  ts: string;
}

/** Last `limit` readings for one instrument key on one device, chronological
 *  (oldest first) — what a sparkline needs. Scoped to a single device
 *  rather than summed across a site's inverters: with (currently) one
 *  inverter per site this is exactly the site total anyway, and a true
 *  multi-inverter sum would need cross-device timestamp alignment a
 *  sparkline doesn't need to get right — same "one representative
 *  reading" simplification already used elsewhere in this file. */
export async function fetchDeviceRecentSeries(
  supabase: SupabaseServerClient,
  deviceId: string,
  key: string,
  limit: number
): Promise<LiveSeriesPoint[]> {
  const { data } = await supabase
    .from("equipment_telemetry")
    .select("value, ts")
    .eq("equipment_id", deviceId)
    .eq("key_name", key)
    .order("ts", { ascending: false })
    .limit(limit);
  return (data ?? []).slice().reverse();
}


/** Today's EV charging energy — summed session deltas (end minus start
 *  energy register), not the lifetime cumulative register itself.
 *  Overview is a today/now snapshot (see EvChargerOverview's own comment),
 *  and energy_active_import_register_kwh is OCPP's lifetime meter, so it
 *  has no place there — this is what turns charging_sessions into the
 *  "today" figure Overview actually wants, the same way
 *  solar_energy_today_kwh already is one for the inverter.
 *
 *  Simplification: only counts sessions that *started* today — a session
 *  still open from before midnight would be undercounted for the sliver
 *  it ran today, the same edge case the existing "resets each day" energy
 *  counters would also have if a device's clock drifted across midnight.
 *  Accepted for the same reason: it's the uncommon case, not the typical
 *  one this figure is read for. */
export async function fetchTodayEvEnergyKwh(supabase: SupabaseServerClient, chargerIds: string[]): Promise<number | null> {
  if (chargerIds.length === 0) return null;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [{ data: sessions }, { data: latestReadings }] = await Promise.all([
    supabase
      .from("ev_sessions")
      .select("equipment_id, start_energy_kwh, end_energy_kwh, ended_at")
      .in("equipment_id", chargerIds)
      .gte("started_at", todayStart.toISOString()),
    supabase
      .from("equipment_latest")
      .select("equipment_id, value, ts")
      .in("equipment_id", chargerIds)
      .eq("key_name", "energy_active_import_register_kwh"),
  ]);

  const latestByDevice = new Map<string, number | null>();
  for (const r of latestReadings ?? []) {
    if (!latestByDevice.has(r.equipment_id)) latestByDevice.set(r.equipment_id, r.value);
  }

  let total = 0;
  let any = false;
  for (const s of sessions ?? []) {
    if (s.start_energy_kwh === null) continue;
    // Still-open session: use its device's latest reading as the running
    // "end" value instead of waiting for the session to actually close.
    const endEnergy = s.ended_at !== null ? s.end_energy_kwh : (latestByDevice.get(s.equipment_id) ?? null);
    if (endEnergy === null) continue;
    total += endEnergy - s.start_energy_kwh;
    any = true;
  }
  return any ? total : null;
}

/** Today's energy delivered, bucketed into `bucketCount` even time-slices
 *  from midnight to now — matching the fixed bar count (and real,
 *  evenly-spaced time meaning) every other card's sparkline in this row
 *  has, unlike a plain per-session staircase whose bar count and spacing
 *  vary with however many sessions happened. A bucket a session didn't
 *  touch stays 0 ("continuing", nothing changed); the bucket containing
 *  when a session actually delivered its energy (its end time, or now for
 *  one still open) gets that session's full delta.
 *
 *  Deliberately NOT built from raw device_readings, even though that's
 *  the obvious way to get a "trend": this charger's connector keeps
 *  getting re-polled/re-reported on a fixed interval independent of
 *  whether anything is actually happening, and those repeat readings
 *  aren't guaranteed to reflect the true value at that moment — they can
 *  legitimately lag behind a session that's already progressed further,
 *  which turns a plain reading-by-reading sparkline into a misleading
 *  zigzag instead of a clean trend. charging_sessions' own start/end
 *  energy values are the trustworthy boundary of "what actually
 *  happened," free of that noise — the same source fetchTodayEvEnergyKwh
 *  already uses for the headline number this sparkline sits under. */
export async function fetchTodayEvSessionSparkline(
  supabase: SupabaseServerClient,
  deviceId: string,
  bucketCount = 20
): Promise<{ value: number; ts: string }[]> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const now = new Date();

  const [{ data: sessions }, { data: latestRows }] = await Promise.all([
    supabase
      .from("ev_sessions")
      .select("started_at, ended_at, start_energy_kwh, end_energy_kwh")
      .eq("equipment_id", deviceId)
      .gte("started_at", todayStart.toISOString())
      .order("started_at", { ascending: true }),
    supabase
      .from("equipment_latest")
      .select("value, ts")
      .eq("equipment_id", deviceId)
      .eq("key_name", "energy_active_import_register_kwh"),
  ]);

  const latestReading = latestRows?.[0]?.value ?? null;
  const buckets = new Array(bucketCount).fill(0);
  const dayMs = Math.max(1, now.getTime() - todayStart.getTime());

  for (const s of sessions ?? []) {
    if (s.start_energy_kwh === null) continue;
    const endEnergy = s.ended_at !== null ? s.end_energy_kwh : latestReading;
    if (endEnergy === null) continue;
    const delta = endEnergy - s.start_energy_kwh;

    const landedAt = s.ended_at !== null ? new Date(s.ended_at) : now;
    const elapsedMs = landedAt.getTime() - todayStart.getTime();
    const bucketIndex = Math.min(bucketCount - 1, Math.max(0, Math.floor((elapsedMs / dayMs) * bucketCount)));
    buckets[bucketIndex] += delta;
  }

  const bucketMs = dayMs / bucketCount;
  return buckets.map((value, i) => ({ value, ts: new Date(todayStart.getTime() + i * bucketMs).toISOString() }));
}

/** Today's energy delivered, bucketed into the 24 literal clock hours
 *  (0 = 12am-1am ... 23 = 11pm-midnight) rather than fetchTodayEvSessionSparkline's
 *  even time-slices-of-elapsed-day — that one deliberately keeps a fixed
 *  bar count as the day progresses (so the live card's sparkline doesn't
 *  visually rescale itself every tick), but a chart meant to read as "how
 *  much energy landed each hour" needs real, stable hour boundaries
 *  instead: bucket 14 always means 2pm, whether it's viewed at 3pm or
 *  11pm, and an hour that hasn't happened yet just stays 0. Same
 *  charging_sessions source and reasoning as that function (see its own
 *  doc comment on why not raw device_readings). */
export interface ChargingSessionDetail {
  id: string;
  startedAt: string;
  endedAt: string | null;
  /** end minus start energy register — for a still-open session this uses
   *  the device's latest reading as the running "end" value, same
   *  fallback fetchTodayEvEnergyKwh and the sparkline functions above use.
   *  Null only when the underlying register reading itself is missing. */
  energyKwh: number | null;
  stopReason: string | null;
  isOpen: boolean;
}

export interface ChargingSessionsSummary {
  sessions: ChargingSessionDetail[];
  /** The charger's own rated/offered power, from its latest power_offered_w
   *  reading (what the simulator/hardware reports it can supply, not a
   *  stock catalog lookup) — static in practice, but reading it live keeps
   *  this in sync with whatever the device itself last reported rather
   *  than a second, potentially stale source of truth. */
  ratedPowerW: number | null;
  /** The charger's latest instantaneous readings — only meaningful
   *  alongside an open session (a closed one isn't drawing anything), used
   *  for the active session slide's live power/current/voltage/temperature
   *  readout. */
  currentPowerW: number | null;
  currentA: number | null;
  voltageV: number | null;
  temperatureC: number | null;
  /** The charger's latest connector_status code (OCPP StatusNotification —
   *  see getConnectorStatusLabel) — read live rather than inferred from
   *  whether a session is open, since Available/Preparing/Suspended/
   *  Faulted are all real states a session-less or mid-session charger can
   *  be in, not just Charging. */
  connectorStatus: number | null;
}

// Key names match the real equipment_templates/equipment_metrics
// vocabulary — power moved from W to kW (power_offered_kw/
// power_active_import_kw, converted back to W below so every downstream
// consumer's existing "...W" naming/contract stays correct) and current/
// voltage/temperature moved to their per-phase/connector-specific names
// (current_import_l1_a/voltage_l1_n_v/connector_temperature_c).
const LATEST_READING_KEYS = [
  "energy_active_import_register_kwh",
  "power_offered_kw",
  "power_active_import_kw",
  "current_import_l1_a",
  "voltage_l1_n_v",
  "connector_temperature_c",
  "connector_status",
] as const;

/** Today's individual charging sessions, newest first, each with its own
 *  energy delivered — the detail behind the summary figures the functions
 *  above compute (fetchTodayEvEnergyKwh's total, the sparklines' buckets).
 *  Used by the "Charging Sessions" carousel, which needs one card per
 *  session rather than an aggregate. */
export async function fetchTodayChargingSessions(
  supabase: SupabaseServerClient,
  deviceId: string
): Promise<ChargingSessionsSummary> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [{ data: sessions }, { data: latestRows }] = await Promise.all([
    supabase
      .from("ev_sessions")
      .select("id, started_at, ended_at, start_energy_kwh, end_energy_kwh, stop_reason")
      .eq("equipment_id", deviceId)
      .gte("started_at", todayStart.toISOString())
      .order("started_at", { ascending: false }),
    // One query for every "latest reading" this needs (one row per key).
    supabase
      .from("equipment_latest")
      .select("key_name, value, ts")
      .eq("equipment_id", deviceId)
      .in("key_name", LATEST_READING_KEYS),
  ]);

  const latestByKey = new Map<string, number | null>();
  for (const row of latestRows ?? []) {
    if (!latestByKey.has(row.key_name)) latestByKey.set(row.key_name, row.value);
  }
  const latestEnergy = latestByKey.get("energy_active_import_register_kwh") ?? null;

  const detailed = (sessions ?? []).map((s) => {
    const isOpen = s.ended_at === null;
    const endEnergy = isOpen ? latestEnergy : s.end_energy_kwh;
    const energyKwh = s.start_energy_kwh !== null && endEnergy !== null ? endEnergy - s.start_energy_kwh : null;
    return { id: s.id, startedAt: s.started_at, endedAt: s.ended_at, energyKwh, stopReason: s.stop_reason, isOpen };
  });

  const offeredKw = latestByKey.get("power_offered_kw") ?? null;
  const activeKw = latestByKey.get("power_active_import_kw") ?? null;

  return {
    sessions: detailed,
    ratedPowerW: offeredKw !== null ? offeredKw * 1000 : null,
    currentPowerW: activeKw !== null ? activeKw * 1000 : null,
    currentA: latestByKey.get("current_import_l1_a") ?? null,
    voltageV: latestByKey.get("voltage_l1_n_v") ?? null,
    temperatureC: latestByKey.get("connector_temperature_c") ?? null,
    connectorStatus: latestByKey.get("connector_status") ?? null,
  };
}

export interface RecentChargingStats {
  yesterdaySessions: number;
  yesterdayEnergyKwh: number;
  /** Trailing 7 days up to (not including) today — same "today has its
   *  own separate figure elsewhere" reasoning as yesterday. */
  weekSessions: number;
  weekEnergyKwh: number;
}

/** Yesterday's and the trailing week's charging history — for the idle
 *  slide's "ready to charge" view, which otherwise has nothing to show
 *  once today's own session count is zero. Only counts sessions that are
 *  actually closed (both energy endpoints present) — an ancient
 *  still-open session would be a data anomaly, not something to surface
 *  as a historical figure. */
export async function fetchRecentChargingStats(supabase: SupabaseServerClient, deviceId: string): Promise<RecentChargingStats> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  const { data } = await supabase
    .from("ev_sessions")
    .select("started_at, start_energy_kwh, end_energy_kwh")
    .eq("equipment_id", deviceId)
    .gte("started_at", weekStart.toISOString())
    .lt("started_at", todayStart.toISOString());

  const yesterdayStartIso = yesterdayStart.toISOString();
  const todayStartIso = todayStart.toISOString();

  let yesterdaySessions = 0;
  let yesterdayEnergyKwh = 0;
  let weekSessions = 0;
  let weekEnergyKwh = 0;

  for (const s of data ?? []) {
    if (s.start_energy_kwh === null || s.end_energy_kwh === null) continue;
    const delta = s.end_energy_kwh - s.start_energy_kwh;
    weekSessions += 1;
    weekEnergyKwh += delta;
    if (s.started_at >= yesterdayStartIso && s.started_at < todayStartIso) {
      yesterdaySessions += 1;
      yesterdayEnergyKwh += delta;
    }
  }

  return { yesterdaySessions, yesterdayEnergyKwh, weekSessions, weekEnergyKwh };
}

/** Every device across every one of the customer's sites, not just the
 *  currently-selected one — for the header's notification bell, which is
 *  mounted in the dashboard layout (outside any single site's page) and
 *  should surface an alert regardless of which site the customer happens
 *  to be looking at right now. Includes already-acknowledged alerts too
 *  (unlike the Overview "Recent Alerts" card, which only ever showed
 *  unacknowledged ones) so the bell can offer an "All" view alongside
 *  "Unread" rather than only ever showing a shrinking list. */
export async function fetchCustomerAlerts(supabase: SupabaseServerClient, deviceIds: string[], limit = 30): Promise<AlertRow[]> {
  if (deviceIds.length === 0) return [];
  const { data } = await supabase
    .from("alerts")
    .select("id, device_id, severity, message, ts, acknowledged_at")
    .in("device_id", deviceIds)
    .order("ts", { ascending: false })
    .limit(limit);
  return (data ?? []) as AlertRow[];
}
