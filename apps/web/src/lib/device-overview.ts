import "server-only";
import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice, CustomerSite } from "./selected-site";
import { TODAY_ENERGY_FIELDS } from "./telemetry-catalog";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Instruments a device's full detail view needs — filtered explicitly
// rather than "most recent N readings across every instrument" (the old
// approach), since the catalog now has 29 instruments and a flat top-50
// window could miss one that just hasn't reported as often as the others.
export const OVERVIEW_KEYS = [
  "inverter_power_w",
  "battery_power_w",
  "grid_power_w",
  "load_power_w",
  "battery_soc_pct",
  "inverter_state",
  "active_fault_code",
  ...TODAY_ENERGY_FIELDS.map((f) => f.key),
];

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
   *  charger at all (distinct from a charger reporting 0 W). */
  evW: number | null;
  recentAlerts: AlertRow[];
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

  // Simplification: takes the most recent readings within a bounded window
  // (per the fixed key list above, not every instrument) rather than a
  // true "latest value per instrument" query (needs a DISTINCT ON not
  // easily expressed through the query builder). Fine for an overview
  // snapshot.
  const [{ data: recentReadings }, { data: recentAlerts }, { data: evReadings }] = await Promise.all([
    supabase
      .from("device_readings")
      .select("instrument_key, value, unit, ts")
      .eq("device_id", device.id)
      .in("instrument_key", OVERVIEW_KEYS)
      .order("ts", { ascending: false })
      .limit(OVERVIEW_KEYS.length * 5),
    supabase
      .from("alerts")
      .select("id, device_id, severity, message, ts, acknowledged_at")
      .eq("device_id", device.id)
      .is("acknowledged_at", null)
      .order("ts", { ascending: false })
      .limit(5),
    evCharger
      ? supabase
          .from("device_readings")
          .select("value, ts")
          .eq("device_id", evCharger.id)
          .eq("instrument_key", "power_active_import_w")
          .order("ts", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const latest = new Map<string, number | null>();
  for (const r of recentReadings ?? []) {
    if (!latest.has(r.instrument_key)) latest.set(r.instrument_key, r.value);
  }

  return {
    get: (key: string) => latest.get(key) ?? null,
    // Already in W (OCPP's Power.Active.Import measurand) — no unit
    // conversion needed, unlike the old charging_power_kw key. Null (not
    // 0) when there's no charger at all, so the diagram knows to leave it
    // off entirely rather than show a charger reading 0 W.
    evW: evCharger ? Math.round(evReadings?.value ?? 0) : null,
    recentAlerts: (recentAlerts ?? []) as AlertRow[],
  };
}

// Power/energy keys that are meaningful to add together across inverters —
// each is a flow or a same-day running total, so summing multiple units at
// one site gives the site's true combined figure. `battery_soc_pct` is
// deliberately excluded (see below, averaged instead of summed) and
// `inverter_state`/`active_fault_code` are handled separately too (neither
// is a number that makes sense to add).
const SITE_SUM_KEYS = ["inverter_power_w", "battery_power_w", "grid_power_w", "load_power_w", ...TODAY_ENERGY_FIELDS.map((f) => f.key)];

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

  const [{ data: recentReadings }, { data: recentAlerts }, { data: evReadings }] = await Promise.all([
    inverterIds.length > 0
      ? supabase
          .from("device_readings")
          .select("device_id, instrument_key, value, ts")
          .in("device_id", inverterIds)
          .in("instrument_key", OVERVIEW_KEYS)
          .order("ts", { ascending: false })
          .limit(OVERVIEW_KEYS.length * inverterIds.length * 5)
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
          .from("device_readings")
          .select("device_id, value, ts")
          .in(
            "device_id",
            chargers.map((c) => c.id)
          )
          .eq("instrument_key", "power_active_import_w")
          .order("ts", { ascending: false })
          .limit(chargers.length * 5)
      : Promise.resolve({ data: null }),
  ]);

  // latest-per-(device, instrument) — same pattern as the single-device
  // case above, just keyed on both ids since multiple inverters are mixed
  // into one query.
  const latestByDeviceKey = new Map<string, number | null>();
  for (const r of recentReadings ?? []) {
    const k = `${r.device_id}:${r.instrument_key}`;
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
  // non-zero code wins (same "one representative reading" simplification
  // fetchDeviceOverview already uses for its EV charger lookup above).
  let faultCode: number | null = null;
  for (const id of inverterIds) {
    const v = latestByDeviceKey.get(`${id}:active_fault_code`);
    if (v) {
      faultCode = v;
      break;
    }
  }
  aggregated.set("active_fault_code", faultCode);

  // Worst state wins for the combined status pill — Fault(2) > Standby(1)
  // > Normal(0) — so one struggling inverter isn't hidden behind the rest
  // reporting Normal.
  let worstState: number | null = null;
  for (const id of inverterIds) {
    const v = latestByDeviceKey.get(`${id}:inverter_state`);
    if (v === null || v === undefined) continue;
    if (worstState === null || v > worstState) worstState = v;
  }
  aggregated.set("inverter_state", worstState);

  const latestChargerReading = new Map<string, number | null>();
  for (const r of evReadings ?? []) {
    if (!latestChargerReading.has(r.device_id)) latestChargerReading.set(r.device_id, r.value);
  }
  // Already in W (OCPP's Power.Active.Import measurand) — no unit
  // conversion needed, unlike the old charging_power_kw key.
  const evW =
    chargers.length > 0
      ? Math.round(chargers.reduce((sum, c) => sum + (latestChargerReading.get(c.id) ?? 0), 0))
      : null;

  return {
    get: (key: string) => aggregated.get(key) ?? null,
    evW,
    recentAlerts: (recentAlerts ?? []) as AlertRow[],
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
    .from("device_readings")
    .select("value, ts")
    .eq("device_id", deviceId)
    .eq("instrument_key", key)
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
      .from("charging_sessions")
      .select("device_id, start_energy_kwh, end_energy_kwh, ended_at")
      .in("device_id", chargerIds)
      .gte("started_at", todayStart.toISOString()),
    supabase
      .from("device_readings")
      .select("device_id, value, ts")
      .in("device_id", chargerIds)
      .eq("instrument_key", "energy_active_import_register_kwh")
      .order("ts", { ascending: false })
      .limit(chargerIds.length * 5),
  ]);

  const latestByDevice = new Map<string, number | null>();
  for (const r of latestReadings ?? []) {
    if (!latestByDevice.has(r.device_id)) latestByDevice.set(r.device_id, r.value);
  }

  let total = 0;
  let any = false;
  for (const s of sessions ?? []) {
    if (s.start_energy_kwh === null) continue;
    // Still-open session: use its device's latest reading as the running
    // "end" value instead of waiting for the session to actually close.
    const endEnergy = s.ended_at !== null ? s.end_energy_kwh : (latestByDevice.get(s.device_id) ?? null);
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
      .from("charging_sessions")
      .select("started_at, ended_at, start_energy_kwh, end_energy_kwh")
      .eq("device_id", deviceId)
      .gte("started_at", todayStart.toISOString())
      .order("started_at", { ascending: true }),
    supabase
      .from("device_readings")
      .select("value, ts")
      .eq("device_id", deviceId)
      .eq("instrument_key", "energy_active_import_register_kwh")
      .order("ts", { ascending: false })
      .limit(1),
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

const LATEST_READING_KEYS = [
  "energy_active_import_register_kwh",
  "power_offered_w",
  "power_active_import_w",
  "current_import_a",
  "voltage_v",
  "temperature_c",
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
      .from("charging_sessions")
      .select("id, started_at, ended_at, start_energy_kwh, end_energy_kwh, stop_reason")
      .eq("device_id", deviceId)
      .gte("started_at", todayStart.toISOString())
      .order("started_at", { ascending: false }),
    // One query for every "latest reading" this needs, reduced to
    // latest-per-key client-side (same pattern the detect-charging-sessions
    // cron uses) — cheaper than a separate round trip per instrument_key.
    supabase
      .from("device_readings")
      .select("instrument_key, value, ts")
      .eq("device_id", deviceId)
      .in("instrument_key", LATEST_READING_KEYS)
      .order("ts", { ascending: false })
      .limit(LATEST_READING_KEYS.length * 5),
  ]);

  const latestByKey = new Map<string, number | null>();
  for (const row of latestRows ?? []) {
    if (!latestByKey.has(row.instrument_key)) latestByKey.set(row.instrument_key, row.value);
  }
  const latestEnergy = latestByKey.get("energy_active_import_register_kwh") ?? null;

  const detailed = (sessions ?? []).map((s) => {
    const isOpen = s.ended_at === null;
    const endEnergy = isOpen ? latestEnergy : s.end_energy_kwh;
    const energyKwh = s.start_energy_kwh !== null && endEnergy !== null ? endEnergy - s.start_energy_kwh : null;
    return { id: s.id, startedAt: s.started_at, endedAt: s.ended_at, energyKwh, stopReason: s.stop_reason, isOpen };
  });

  return {
    sessions: detailed,
    ratedPowerW: latestByKey.get("power_offered_w") ?? null,
    currentPowerW: latestByKey.get("power_active_import_w") ?? null,
    currentA: latestByKey.get("current_import_a") ?? null,
    voltageV: latestByKey.get("voltage_v") ?? null,
    temperatureC: latestByKey.get("temperature_c") ?? null,
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
    .from("charging_sessions")
    .select("started_at, start_energy_kwh, end_energy_kwh")
    .eq("device_id", deviceId)
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
