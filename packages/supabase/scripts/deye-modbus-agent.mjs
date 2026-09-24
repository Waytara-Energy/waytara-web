#!/usr/bin/env node
// Deye SUN-8K-SG05LP1-EU Modbus agent — the real hardware read/write bridge
// this project has been building toward all session. Two independent jobs
// in one process:
//
//  1. READ LOOP, every 5 minutes: populate device_readings. Two modes:
//     --mode=simulate (default) generates plausible values with the same
//     physical model as the earlier .seed-manoj-live-monitoring.mjs, now
//     covering the full register-mapped catalog and inserting under the
//     *new* (post-migration) instrument_key names. --mode=modbus reads the
//     real inverter over Modbus TCP via the Waveshare RS485 gateway — built
//     against the read-registers doc's own guidance, but not yet run
//     against real hardware.
//  2. WRITE LISTENER, always on: subscribes to device_settings INSERT via
//     Supabase Realtime. For now this only *prints* what it would write —
//     no actual register write, no confirmation-back-to-Supabase yet, both
//     deliberately deferred (see the TODO at applyModbusWrite below) until
//     the read side has been verified against real hardware.
//
// Register data is NOT hardcoded here — both loops read `modbus_register`
// straight from the DB (device_parameters for the read catalog,
// each device_settings row for the write listener), so this script and the
// database can never silently drift apart on what maps to what.
//
// Usage:
//   node scripts/deye-modbus-agent.mjs                       # simulate + write-listener, default device
//   node scripts/deye-modbus-agent.mjs --mode=modbus --host=192.168.1.50
//   node scripts/deye-modbus-agent.mjs --device-id=<uuid>
//   node scripts/deye-modbus-agent.mjs --read-only            # skip the write listener
//   node scripts/deye-modbus-agent.mjs --once                 # one read tick, then exit (no loop)
//   node scripts/deye-modbus-agent.mjs --no-read               # write listener only, no read tick/loop at all
//   node scripts/deye-modbus-agent.mjs --backfill-days=1       # regenerate today's readings (midnight -> now),
//                                                               then keep running the live loop — use this after
//                                                               deleting a day's worth of device_readings so the
//                                                               gap doesn't sit empty until the live loop refills it
//                                                               one tick at a time. --backfill-days=7 for a week.
//
// Test modes — each runs once, reports, and exits (no live loop):
//   node scripts/deye-modbus-agent.mjs --mode=codec-test [--device-id=<uuid>]
//       Round-trips register-codec.mjs's decode()/encode() against every
//       real decode spec in device_parameter_map for this device's stock:
//       generates a plausible raw register value, decodes it, and for
//       write-direction rows encodes the decoded value back and asserts it
//       reproduces the same raw register value(s).
//   node scripts/deye-modbus-agent.mjs --mode=preset-test --preset=<key> [--device-id=<uuid>]
//       Applies a real setting_presets row exactly the way the customer
//       dashboard does (inserts into device_settings with
//       applied_preset_key set), then confirms every one of its keys
//       resolves through this device's writeCatalog to a real register via
//       encode() — the same exercise the customer flow's own tests already
//       covered at the DB layer, proven here through the agent's own
//       lookup path instead.
//   node scripts/deye-modbus-agent.mjs --mode=feature-flag-test --category=<name> [--device-id=<uuid>]
//       Disables `category` via device_feature_flags on this device,
//       confirms the read catalog excludes every instrument in it and a
//       write attempt against one is rejected before reaching the
//       register-write step, then re-enables it (deletes the flag row).
//   node scripts/deye-modbus-agent.mjs --mode=protocol-test --device-id=<ev-charger-device-id>
//       Confirms loadDevice's generic stock_id/protocol-keyed lookup works
//       unmodified against a non-Modbus protocol (ocpp_1_6) — proves the
//       catalog/lookup layer is protocol-agnostic. Not a live OCPP
//       connection — there's no real charger or simulator to connect to.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { decode, encode } from "./register-codec.mjs";

function loadEnv() {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/web/.env.local");
  const text = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return env;
}

function parseArgs(argv) {
  const args = {
    mode: "simulate",
    deviceId: "8e307e23-6540-406b-adb9-9c8d209c8ba1",
    host: null,
    readOnly: false,
    once: false,
    noRead: false,
    backfillDays: 0,
    preset: null,
    category: null,
  };
  for (const arg of argv) {
    if (arg === "--read-only") args.readOnly = true;
    else if (arg === "--no-read") args.noRead = true;
    else if (arg === "--once") args.once = true;
    else if (arg.startsWith("--mode=")) args.mode = arg.slice("--mode=".length);
    else if (arg.startsWith("--device-id=")) args.deviceId = arg.slice("--device-id=".length);
    else if (arg.startsWith("--host=")) args.host = arg.slice("--host=".length);
    else if (arg.startsWith("--backfill-days=")) args.backfillDays = Number(arg.slice("--backfill-days=".length));
    else if (arg.startsWith("--preset=")) args.preset = arg.slice("--preset=".length);
    else if (arg.startsWith("--category=")) args.category = arg.slice("--category=".length);
  }
  return args;
}

const env = loadEnv();
const args = parseArgs(process.argv.slice(2));
const INTERVAL_MS = 5 * 60 * 1000;

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "waytara" },
});

// ============================================================
// Startup — resolve the device, load its register catalog from the DB.
// ============================================================

/** Categories device_feature_flags disables for this specific physical
 *  installation (absence of a row = enabled) — the exact same query and
 *  reasoning as apps/web's getDisabledCategories, applied here so the
 *  agent never polls (or accepts a write for) a register category this
 *  install doesn't actually have connected, not just hides it in the UI. */
async function loadDisabledCategories(deviceId) {
  const { data } = await supabase.from("device_feature_flags").select("category").eq("device_id", deviceId).eq("is_enabled", false);
  return new Set((data ?? []).map((f) => f.category));
}

async function loadDevice(deviceId) {
  const { data: device, error } = await supabase
    .from("devices")
    .select("id, label, device_type:stock(id, category, name)")
    .eq("id", deviceId)
    .maybeSingle();
  if (error || !device) throw new Error(`Device ${deviceId} not found: ${error?.message ?? "no row"}`);

  // device_parameters is retired — instrument_catalog + device_parameter_map
  // replace it (multi-vendor catalog, see 20260924000100/000200).
  const [{ data: mapRows, error: catalogError }, disabledCategories] = await Promise.all([
    supabase
      .from("device_parameter_map")
      .select("instrument_key, address, decode, instrument_catalog(name, category, unit, direction, value_kind, min_role, regulated, valid_min, valid_max)")
      .eq("stock_id", device.device_type.id)
      .eq("is_enabled", true),
    loadDisabledCategories(deviceId),
  ]);
  if (catalogError) throw new Error(`Failed to load register catalog: ${catalogError.message}`);

  const enabled = (mapRows ?? []).filter((c) => !disabledCategories.has(c.instrument_catalog?.category));

  // Reassembled into device_parameters' old combined `modbus_register`
  // shape ({registers, scale, signed, ...} in one object) for the read
  // catalog specifically, so readModbusTick/buildRows (which predate the
  // address/decode split) need zero changes.
  const readCatalog = enabled
    .filter((c) => c.instrument_catalog?.direction === "read" && c.address?.registers?.length)
    .map((c) => ({
      parameter_key: c.instrument_key,
      parameter_name: c.instrument_catalog?.name ?? c.instrument_key,
      category: c.instrument_catalog?.category ?? null,
      unit: c.instrument_catalog?.unit ?? null,
      modbus_register: { ...c.address, ...(c.decode ?? {}) },
    }));

  // Write catalog keeps address/decode separate (encode() below wants
  // them apart, not pre-merged) plus the catalog metadata applyModbusWrite
  // needs to validate a value before ever touching a register.
  const writeCatalog = enabled
    .filter((c) => c.instrument_catalog?.direction === "write")
    .map((c) => ({
      parameter_key: c.instrument_key,
      parameter_name: c.instrument_catalog?.name ?? c.instrument_key,
      category: c.instrument_catalog?.category ?? null,
      value_kind: c.instrument_catalog?.value_kind ?? "numeric",
      min_role: c.instrument_catalog?.min_role ?? "customer",
      regulated: c.instrument_catalog?.regulated ?? false,
      registers: c.address?.registers ?? [],
      decode: c.decode ?? null,
    }));

  return { device, catalog: readCatalog, writeCatalog, disabledCategories };
}

// ============================================================
// READ — simulate mode. Same physical model as .seed-manoj-live-monitoring.mjs
// (daylight curve, battery-priority dispatch, day-reset counters), extended
// to derive a plausible value for every catalog field, not just the ~10 the
// earlier script covered.
// ============================================================

const BATTERY_CAPACITY_KWH = 10;
const MAX_CHARGE_W = 3000;
const MAX_DISCHARGE_W = 3000;
const PEAK_SOLAR_W = 2200;
const SUNRISE_HOUR = 6.0;
const SUNSET_HOUR = 18.5;
const NOMINAL_BATTERY_V = 51.2; // 16S LiFePO4 nominal — only used to derive plausible charge/discharge limit currents below
const RATED_POWER_W = 8000; // nameplate — the "8K" in SUN-8K-SG05LP1-EU, doesn't change tick to tick

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function jitter(value, pct) {
  return value * (1 + (Math.random() * 2 - 1) * pct);
}

function daylightFactor(hour) {
  if (hour <= SUNRISE_HOUR || hour >= SUNSET_HOUR) return 0;
  const x = (hour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR);
  return Math.max(0, Math.sin(Math.PI * x) ** 1.3);
}

// Weather realism: rather than one flat per-tick random multiplier (which
// reads as pure static noise, not weather), each calendar day gets a
// "day type" — deterministic from the date itself (hashDay), so the same
// day always simulates the same weather even across process restarts —
// that sets a baseline cloud cover and how often a transient "cloud
// passing overhead" dip occurs. Within the day, cloud cover then drifts
// slowly (mean-reverting random walk, see simulateTick) rather than
// jumping randomly tick to tick, so a run of readings actually looks like
// weather moving through, not sensor jitter.
const DAY_TYPES = [
  { name: "clear", weight: 45, baseCloud: 0.05, passProbPerTick: 0.03, passDepth: [0.15, 0.35] },
  { name: "partly-cloudy", weight: 30, baseCloud: 0.2, passProbPerTick: 0.08, passDepth: [0.3, 0.6] },
  { name: "overcast", weight: 15, baseCloud: 0.55, passProbPerTick: 0.05, passDepth: [0.15, 0.35] },
  { name: "rainy", weight: 10, baseCloud: 0.75, passProbPerTick: 0.02, passDepth: [0.05, 0.15] },
];

function hashDay(dayKey) {
  let h = 0;
  for (let i = 0; i < dayKey.length; i++) h = (Math.imul(h, 31) + dayKey.charCodeAt(i)) >>> 0;
  return h;
}

function pickDayType(dayKey) {
  const totalWeight = DAY_TYPES.reduce((sum, d) => sum + d.weight, 0);
  let r = hashDay(dayKey) % totalWeight;
  for (const dayType of DAY_TYPES) {
    if (r < dayType.weight) return dayType;
    r -= dayType.weight;
  }
  return DAY_TYPES[0];
}

function loadBaselineW(hour) {
  const morning = 900 * Math.exp(-((hour - 8) ** 2) / (2 * 1.2 ** 2));
  const evening = 1400 * Math.exp(-((hour - 20) ** 2) / (2 * 1.5 ** 2));
  return 650 + morning + evening;
}

/** Persistent simulation state, carried tick-to-tick and seeded from the
 *  device's real last-known values so a restart doesn't cause a visible
 *  jump. Day counters reset at local midnight; total/month/year counters
 *  only ever grow. */
class SimState {
  constructor() {
    this.socPct = 70;
    this.totalPvKwh = 0;
    this.totalBatteryChargeKwh = 0;
    this.totalBatteryDischargeKwh = 0;
    this.totalGridImportKwh = 0;
    this.totalGridExportKwh = 0;
    this.totalLoadKwh = 0;
    this.monthPvKwh = 0;
    this.monthGridKwh = 0;
    this.monthLoadKwh = 0;
    this.yearPvKwh = 0;
    this.yearGridExportKwh = 0;
    this.yearLoadKwh = 0;
    this.dayKey = null;
    this.dayType = DAY_TYPES[0];
    this.cloudCover = DAY_TYPES[0].baseCloud;
    this.cloudPassRemainingTicks = 0;
    this.cloudPassDepth = 0;
    this.dayYieldKwh = 0;
    this.dayGridImportKwh = 0;
    this.dayGridExportKwh = 0;
    this.dayBatteryChargeKwh = 0;
    this.dayBatteryDischargeKwh = 0;
    this.dayLoadKwh = 0;
    this.dayActiveEnergyKwh = 0;
    this.dayReactiveEnergyKvarh = 0;
  }

  async seedFromDb(deviceId) {
    const latest = async (key, fallback) => {
      const { data } = await supabase
        .from("device_readings")
        .select("value")
        .eq("device_id", deviceId)
        .eq("instrument_key", key)
        .order("ts", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.value ?? fallback;
    };
    this.socPct = await latest("battery_soc_pct", 70);
    this.totalPvKwh = await latest("total_pv_energy_kwh", 0);
    this.totalBatteryChargeKwh = await latest("total_battery_charge_kwh", 0);
    this.totalBatteryDischargeKwh = await latest("total_battery_discharge_kwh", 0);
    this.totalGridImportKwh = await latest("total_grid_import_kwh", 0);
    this.totalGridExportKwh = await latest("total_grid_export_kwh", 0);
    this.totalLoadKwh = await latest("total_load_energy_kwh", 0);
    this.monthPvKwh = await latest("month_pv_energy_kwh", 0);
    this.monthGridKwh = await latest("month_grid_energy_kwh", 0);
    this.monthLoadKwh = await latest("month_load_energy_kwh", 0);
    this.yearPvKwh = await latest("year_pv_energy_kwh", 0);
    this.yearGridExportKwh = await latest("year_grid_export_kwh", 0);
    this.yearLoadKwh = await latest("year_load_energy_kwh", 0);
  }
}

/** One tick's worth of readings, keyed by instrument_key — only the fields
 *  this simulation actually models (Phase 3 of the Modbus register mapping
 *  pass extended this to the full 34-field read-side UI coverage set, not
 *  just the ~10 the earlier .seed-manoj-live-monitoring.mjs covered).
 *  Anything in the catalog still not covered here (AUX/generator fields —
 *  nothing's connected there) is left out of the insert entirely rather
 *  than faked as a nonzero value. */
function simulateTick(date, state) {
  const hour = date.getHours() + date.getMinutes() / 60;
  const dayKey = date.toISOString().slice(0, 10);
  if (state.dayKey !== dayKey) {
    state.dayKey = dayKey;
    state.dayType = pickDayType(dayKey);
    state.cloudCover = state.dayType.baseCloud;
    state.cloudPassRemainingTicks = 0;
    state.dayYieldKwh = 0;
    state.dayGridImportKwh = 0;
    state.dayGridExportKwh = 0;
    state.dayBatteryChargeKwh = 0;
    state.dayBatteryDischargeKwh = 0;
    state.dayLoadKwh = 0;
    state.dayActiveEnergyKwh = 0;
    state.dayReactiveEnergyKvarh = 0;
  }

  const df = daylightFactor(hour);

  // Slow mean-reverting drift toward the day's own baseline (a small random
  // step each tick, pulled back toward baseCloud) — this is what makes
  // cloud cover look like it's actually moving through rather than
  // re-rolling from scratch every 5 minutes.
  state.cloudCover += (Math.random() - 0.5) * 0.04 + (state.dayType.baseCloud - state.cloudCover) * 0.15;
  state.cloudCover = Math.max(0, Math.min(0.95, state.cloudCover));

  // A transient "cloud passing overhead" — a deeper dip layered on top of
  // the slow drift, lasting a few ticks (~5-15 min) once triggered, only
  // possible in daylight (nothing to visibly dim at night).
  if (state.cloudPassRemainingTicks > 0) {
    state.cloudPassRemainingTicks--;
  } else if (df > 0 && Math.random() < state.dayType.passProbPerTick) {
    state.cloudPassRemainingTicks = 1 + Math.floor(Math.random() * 3);
    const [minDepth, maxDepth] = state.dayType.passDepth;
    state.cloudPassDepth = minDepth + Math.random() * (maxDepth - minDepth);
  }
  const passFactor = state.cloudPassRemainingTicks > 0 ? state.cloudPassDepth : 0;
  const effectiveCloud = Math.min(0.97, state.cloudCover + passFactor);
  const cloudFactor = 1 - effectiveCloud; // 1 = full sun, ~0 = heavy overcast/rain

  const solarW = df > 0 ? jitter(PEAK_SOLAR_W * df * cloudFactor, 0.04) : 0;
  const pv1ShareW = solarW * 0.55;
  const pv2ShareW = solarW * 0.45;
  const loadW = jitter(loadBaselineW(hour), 0.12);
  const netW = solarW - loadW;

  let batteryPowerW = 0;
  let gridPowerW = 0;
  const hrs = 5 / 60;

  if (netW > 0) {
    const roomKwh = Math.max(0, ((100 - state.socPct) / 100) * BATTERY_CAPACITY_KWH);
    const roomW = (roomKwh * 1000) / hrs;
    const chargeW = Math.min(netW, MAX_CHARGE_W, roomW);
    batteryPowerW = chargeW;
    gridPowerW = -(netW - chargeW);
  } else {
    const deficitW = -netW;
    const availableKwh = Math.max(0, ((state.socPct - 15) / 100) * BATTERY_CAPACITY_KWH);
    const availableW = (availableKwh * 1000) / hrs;
    const dischargeW = Math.min(deficitW, MAX_DISCHARGE_W, availableW);
    batteryPowerW = -dischargeW;
    gridPowerW = deficitW - dischargeW;
  }

  const deltaBatteryKwh = (batteryPowerW * hrs) / 1000;
  state.socPct = Math.min(100, Math.max(15, state.socPct + (deltaBatteryKwh / BATTERY_CAPACITY_KWH) * 100));

  const solarKwh = (solarW * hrs) / 1000;
  const loadKwh = (loadW * hrs) / 1000;
  const gridImportKwh = (Math.max(gridPowerW, 0) * hrs) / 1000;
  const gridExportKwh = (Math.max(-gridPowerW, 0) * hrs) / 1000;
  const battChargeKwh = (Math.max(batteryPowerW, 0) * hrs) / 1000;
  const battDischargeKwh = (Math.max(-batteryPowerW, 0) * hrs) / 1000;

  state.dayYieldKwh += solarKwh;
  state.dayLoadKwh += loadKwh;
  state.dayGridImportKwh += gridImportKwh;
  state.dayGridExportKwh += gridExportKwh;
  state.dayBatteryChargeKwh += battChargeKwh;
  state.dayBatteryDischargeKwh += battDischargeKwh;
  // No confirmed register-level model for active/reactive metering — these
  // are plausible approximations for demo data, not derived from the doc:
  // net active energy for the day (generation minus consumption, signed),
  // and reactive energy as a fixed fraction of load (typical ratio for a
  // mixed household load, no capacitive/inductive detail modeled).
  state.dayActiveEnergyKwh += solarKwh - loadKwh;
  state.dayReactiveEnergyKvarh += loadKwh * 0.1;
  state.totalPvKwh += solarKwh;
  state.totalBatteryChargeKwh += battChargeKwh;
  state.totalBatteryDischargeKwh += battDischargeKwh;
  state.totalGridImportKwh += gridImportKwh;
  state.totalGridExportKwh += gridExportKwh;
  state.totalLoadKwh += loadKwh;
  state.monthPvKwh += solarKwh;
  state.monthGridKwh += gridImportKwh + gridExportKwh;
  state.monthLoadKwh += loadKwh;
  state.yearPvKwh += solarKwh;
  state.yearGridExportKwh += gridExportKwh;
  state.yearLoadKwh += loadKwh;

  const throughputW = solarW + Math.abs(batteryPowerW);
  const batteryTempC = jitter(26 + Math.abs(batteryPowerW) / 400, 0.03);
  const inverterDcTempC = jitter(30 + throughputW / 250, 0.03);
  const inverterAcTempC = jitter(28 + throughputW / 300, 0.03);
  const batteryVoltageV = jitter(46 + (state.socPct / 100) * 8, 0.01);
  const gridVoltageV = jitter(230, 0.01);
  const gridFrequencyHz = jitter(50, 0.002);
  const inverterVoltageV = gridVoltageV;
  const inverterFrequencyHz = gridFrequencyHz;
  const pv1VoltageV = pv1ShareW > 0 ? jitter(380, 0.02) : 0;
  const pv2VoltageV = pv2ShareW > 0 ? jitter(370, 0.02) : 0;
  const pv1CurrentA = pv1VoltageV > 0 ? pv1ShareW / pv1VoltageV : 0;
  const pv2CurrentA = pv2VoltageV > 0 ? pv2ShareW / pv2VoltageV : 0;
  const inverterCurrentA = inverterVoltageV > 0 ? Math.abs(solarW) / inverterVoltageV : 0;
  const loadFrequencyHz = gridFrequencyHz;
  const batteryCurrentA = batteryVoltageV > 0 ? batteryPowerW / batteryVoltageV : 0;
  // Newly-covered fields (Phase 3): none of these have a confirmed
  // register-level model in the docs — best-effort plausible values so
  // simulate mode isn't blank for the new UI, same spirit as the rest of
  // this function's approximations (see the file header comment).
  const ambientTempC = jitter(18 + 10 * daylightFactor(hour) * cloudFactor - (state.dayType.name === "rainy" ? 2 : 0), 0.05);
  const batteryChargeLimitA = round(MAX_CHARGE_W / NOMINAL_BATTERY_V);
  const batteryDischargeLimitA = round(MAX_DISCHARGE_W / NOMINAL_BATTERY_V);
  const batteryChargingVoltageV = jitter(56.4, 0.002);
  const gridCurrentA = gridVoltageV > 0 ? Math.abs(gridPowerW) / gridVoltageV : 0;

  return {
    // solar
    pv1_voltage_v: round(pv1VoltageV, 1),
    pv1_current_a: round(pv1CurrentA, 1),
    pv1_power_w: round(pv1ShareW),
    pv2_voltage_v: round(pv2VoltageV, 1),
    pv2_current_a: round(pv2CurrentA, 1),
    pv2_power_w: round(pv2ShareW),
    solar_energy_today_kwh: round(state.dayYieldKwh, 2),
    // battery
    battery_power_w: round(batteryPowerW),
    battery_voltage_v: round(batteryVoltageV, 1),
    battery_current_a: round(batteryCurrentA, 2),
    battery_soc_pct: round(state.socPct),
    battery_temp_c: round(batteryTempC, 1),
    battery_charge_limit_current_a: batteryChargeLimitA,
    battery_discharge_limit_current_a: batteryDischargeLimitA,
    battery_charging_voltage_v: round(batteryChargingVoltageV, 2),
    bat1_soc_pct: round(state.socPct),
    // inverter — real PV output is never negative; solarW is already
    // floored at 0 by daylightFactor, so this is the actual generation
    // reading, not a sign-flipped "generation minus load" figure (that was
    // a bug — see git history).
    inverter_power_w: round(solarW),
    inverter_voltage_v: round(inverterVoltageV, 1),
    inverter_current_a: round(inverterCurrentA, 2),
    inverter_frequency_hz: round(inverterFrequencyHz, 2),
    inverter_dc_temp_c: round(inverterDcTempC, 1),
    inverter_ac_temp_c: round(inverterAcTempC, 1),
    environment_temp_c: round(ambientTempC, 1),
    // grid
    grid_power_w: round(gridPowerW),
    grid_voltage_v: round(gridVoltageV, 1),
    grid_frequency_hz: round(gridFrequencyHz, 2),
    grid_connected: 1,
    grid_current_a: round(gridCurrentA, 2),
    grid_ct_power_w: round(gridPowerW),
    grid_l2_power_w: 0, // single-phase unit — L2 doesn't carry load
    // load
    load_power_w: round(loadW),
    load_frequency_hz: round(loadFrequencyHz, 2),
    load_energy_today_kwh: round(state.dayLoadKwh, 2),
    load_l1_power_w: round(loadW), // single-phase — all load on L1
    load_l2_power_w: 0,
    // system / status — real Deye inverter_state codes (register 59, see
    // instrument_enum_values enum_ref 'inverter_state'): 0=Standby,
    // 2=Normal. No fault modeling in this simulator (active_fault_code is
    // always 0 here), so 4=Fault never fires — matches the more detailed
    // Python simulator's same 3-way mapping, just without the fault branch.
    inverter_state: solarW <= 0 && Math.abs(batteryPowerW) < 1 ? 0 : 2,
    active_fault_code: 0,
    sd_status: 0,
    rated_power_w: RATED_POWER_W,
    // energy — today
    day_battery_charge_kwh: round(state.dayBatteryChargeKwh, 2),
    day_battery_discharge_kwh: round(state.dayBatteryDischargeKwh, 2),
    grid_buy_energy_today_kwh: round(state.dayGridImportKwh, 2),
    grid_sell_energy_today_kwh: round(state.dayGridExportKwh, 2),
    day_active_energy_kwh: round(state.dayActiveEnergyKwh, 2),
    day_reactive_energy_kvarh: round(state.dayReactiveEnergyKvarh, 2),
    // energy — month/year/total
    month_pv_energy_kwh: round(state.monthPvKwh, 1),
    month_grid_energy_kwh: round(state.monthGridKwh, 1),
    month_load_energy_kwh: round(state.monthLoadKwh, 1),
    year_pv_energy_kwh: round(state.yearPvKwh, 1),
    year_grid_export_kwh: round(state.yearGridExportKwh, 1),
    year_load_energy_kwh: round(state.yearLoadKwh, 1),
    total_pv_energy_kwh: round(state.totalPvKwh, 1),
    total_battery_charge_kwh: round(state.totalBatteryChargeKwh, 1),
    total_battery_discharge_kwh: round(state.totalBatteryDischargeKwh, 1),
    total_grid_import_kwh: round(state.totalGridImportKwh, 1),
    total_grid_export_kwh: round(state.totalGridExportKwh, 1),
    total_load_energy_kwh: round(state.totalLoadKwh, 1),
  };
}

function buildRows(deviceId, catalog, values, ts) {
  const unitByKey = new Map(catalog.map((c) => [c.parameter_key, c.unit]));
  return Object.entries(values)
    .filter(([key]) => unitByKey.has(key) || catalog.some((c) => c.parameter_key === key))
    .map(([instrument_key, value]) => ({
      device_id: deviceId,
      instrument_key,
      value,
      unit: unitByKey.get(instrument_key) ?? null,
      ts,
      is_test: false,
    }));
}

async function insertReadings(deviceId, catalog, values, ts) {
  const rows = buildRows(deviceId, catalog, values, ts);
  if (rows.length === 0) return;
  const { error } = await supabase.from("device_readings").insert(rows);
  if (error) throw new Error(`insert @ ${ts} failed: ${error.message}`);
}

async function insertRowsChunked(rows, chunkSize = 1000) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("device_readings").insert(chunk);
    if (error) throw new Error(`backfill insert (rows ${i}-${i + chunk.length}) failed: ${error.message}`);
  }
}

/** Regenerates the last `days` days of readings (today included, ending
 *  "now") — one simulateTick() per 5-minute slot, walked forward in order
 *  so the day-boundary counter resets and the cloud model's slow drift
 *  both behave exactly like a real multi-day run would, not like `days`
 *  independent single-day simulations. Meant to be run after deleting a
 *  range of device_readings so the gap doesn't sit empty until the live
 *  loop catches up tick by tick. */
async function backfillDeye(deviceId, catalog, state, days) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  console.log(`[backfill] generating ${days} day(s) of readings from ${start.toISOString()} to ${now.toISOString()}...`);
  let rows = [];
  let ticks = 0;
  for (let t = new Date(start); t <= now; t = new Date(t.getTime() + INTERVAL_MS)) {
    const values = simulateTick(t, state);
    rows.push(...buildRows(deviceId, catalog, values, t.toISOString()));
    ticks++;
  }
  await insertRowsChunked(rows);
  console.log(`[backfill] done — ${ticks} ticks, ${rows.length} rows inserted.`);
}

// ============================================================
// READ — real Modbus mode. Not runnable without the gateway reachable;
// modbus-serial is dynamically imported so `--mode=simulate` never needs
// it installed.
// ============================================================

async function readModbusTick(catalog, host) {
  const { default: ModbusRTU } = await import("modbus-serial");
  const client = new ModbusRTU();
  client.setID(1); // must match the inverter's Modbus SN — see Advanced Function -> Parallel on the LCD
  client.setTimeout(3000);
  await client.connectTCP(host, { port: 502 });

  const values = {};
  try {
    for (const entry of catalog) {
      const spec = entry.modbus_register;
      if (!spec?.registers?.length) continue;
      // Batched-by-field, not batched-by-address-range — simplest correct
      // implementation first; the doc's own batching guidance (~20
      // registers/request, 0.05s spacing) is a later optimization once
      // real timing behavior against the gateway is known.
      const raw = [];
      for (const reg of spec.registers) {
        const res = await client.readHoldingRegisters(reg, 1);
        raw.push(res.data[0]);
        await new Promise((r) => setTimeout(r, 50)); // READ_MESSAGE_SPACING per the doc
      }
      let combined = raw.length === 2 ? (raw[0] << 16) | raw[1] : raw[0];
      if (spec.signed && combined > 0x7fff && raw.length === 1) combined -= 0x10000;
      values[entry.parameter_key] = combined * (spec.scale ?? 1);
    }
  } finally {
    client.close(() => {});
  }
  return values;
}

// ============================================================
// WRITE — real register math via register-codec.mjs's encode(), gated
// behind a live Modbus connection; dry-run (log only) otherwise. A key
// with no enabled write-direction entry in writeCatalog — because
// device_feature_flags disabled its category, this model doesn't map it,
// or it's not a real register write at all (e.g. a setting_presets key
// like tou_slot* resolved through a different pipeline) — is rejected
// before any register math runs, not just logged as unknown.
// ============================================================

function resolveWriteEntry(writeCatalog, settingKey) {
  return writeCatalog.find((e) => e.parameter_key === settingKey) ?? null;
}

/** device_settings.setting_value is always text — converts it to the
 *  number encode() expects, per value_kind. Booleans and enum codes are
 *  written as their numeric register code, same as any other numeric
 *  field once converted. */
function computeRegisterWrites(entry, settingValue) {
  const value = entry.value_kind === "boolean" ? (settingValue === "true" ? 1 : 0) : Number(settingValue);
  if (!Number.isFinite(value)) throw new Error(`cannot convert "${settingValue}" to a number for ${entry.parameter_key}`);
  return encode(value, entry.registers, entry.decode);
}

async function applyModbusWrite(client, writes) {
  for (const w of writes) {
    await client.writeRegister(w.register, w.value);
    await new Promise((r) => setTimeout(r, 50)); // same WRITE_MESSAGE_SPACING reasoning as the read loop
  }
}

function startWriteListener(deviceId, writeCatalog, modbusClient) {
  const channel = supabase
    .channel(`deye-agent:device_settings:${deviceId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "waytara", table: "device_settings", filter: `device_id=eq.${deviceId}` },
      async (payload) => {
        const row = payload.new;
        console.log(`\n[write] setting change requested: ${row.setting_category}.${row.setting_key} = ${row.setting_value}`);

        const entry = resolveWriteEntry(writeCatalog, row.setting_key);
        if (!entry || entry.registers.length === 0) {
          console.log(
            `[write]   no enabled register mapping for "${row.setting_key}" on this device (disabled category, model doesn't map it, or it isn't a direct register write) — nothing sent.`
          );
          return;
        }

        try {
          const writes = computeRegisterWrites(entry, row.setting_value);
          for (const w of writes) {
            console.log(`[write]   register ${w.register} <- ${w.value}${modbusClient ? "" : " (dry-run — no live Modbus connection)"}`);
          }
          if (modbusClient) {
            await applyModbusWrite(modbusClient, writes);
            console.log(`[write]   sent to hardware.`);
          }
        } catch (err) {
          console.error(`[write]   failed to compute/send register write:`, err.message ?? err);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[write] realtime channel status: ${status}`);
    });
  return channel;
}

// ============================================================
// TEST MODES — each runs once, reports, and exits. See the usage comment
// at the top of the file for what each one proves.
// ============================================================

async function codecTest(deviceId) {
  const { data: device } = await supabase.from("devices").select("id, label, device_type:stock(id, name)").eq("id", deviceId).maybeSingle();
  if (!device) throw new Error(`Device ${deviceId} not found`);

  const { data: rows, error } = await supabase
    .from("device_parameter_map")
    .select("instrument_key, address, decode, instrument_catalog!inner(direction)")
    .eq("stock_id", device.device_type.id)
    .eq("is_enabled", true);
  if (error) throw new Error(`catalog load failed: ${error.message}`);

  let pass = 0;
  let fail = 0;
  let skipped = 0;
  for (const row of rows ?? []) {
    const registers = row.address?.registers ?? [];
    if (registers.length === 0) {
      skipped++;
      continue;
    }

    const regReadings = registers.map((register) => ({ register, raw: Math.floor(Math.random() * 60000) + 100 }));

    let decoded;
    try {
      decoded = decode(regReadings, row.decode);
    } catch (err) {
      console.log(`FAIL  ${row.instrument_key}: decode() threw: ${err.message}`);
      fail++;
      continue;
    }

    if (row.instrument_catalog.direction !== "write") {
      console.log(`ok    ${row.instrument_key}: raw=[${regReadings.map((r) => r.raw).join(",")}] -> decoded=${decoded}`);
      pass++;
      continue;
    }

    try {
      const reEncoded = encode(decoded, registers, row.decode);
      const matches = reEncoded.every((w) => regReadings.find((r) => r.register === w.register)?.raw === w.value);
      if (matches) {
        console.log(
          `PASS  ${row.instrument_key}: raw=[${regReadings.map((r) => r.raw).join(",")}] -> decoded=${decoded} -> re-encoded=[${reEncoded.map((w) => w.value).join(",")}]`
        );
        pass++;
      } else {
        console.log(
          `FAIL  ${row.instrument_key}: round-trip mismatch. raw=[${regReadings.map((r) => r.raw).join(",")}] decoded=${decoded} re-encoded=[${reEncoded.map((w) => w.value).join(",")}]`
        );
        fail++;
      }
    } catch (err) {
      console.log(`FAIL  ${row.instrument_key}: encode() threw: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n[codec-test] ${pass} passed, ${fail} failed, ${skipped} skipped (no register address) — ${rows?.length ?? 0} total rows checked.`);
  if (fail > 0) process.exitCode = 1;
}

async function presetTest(deviceId, presetKey) {
  const { data: preset } = await supabase.from("setting_presets").select("key, device_category, values").eq("key", presetKey).maybeSingle();
  if (!preset) throw new Error(`Preset "${presetKey}" not found`);

  const { writeCatalog } = await loadDevice(deviceId);
  const values = preset.values;
  const keys = Object.keys(values);

  // Inserted exactly like the customer dashboard's applySettingPreset —
  // setting_category "test" so cleanup below can scope precisely to these
  // rows and never touch a real pre-existing row for the same key (the
  // lesson from this session's earlier cleanup incident).
  const rows = keys.map((key) => ({
    device_id: deviceId,
    setting_category: "test",
    setting_key: key,
    setting_value: String(values[key]),
    source: "agent_preset_test",
    applied_preset_key: preset.key,
  }));
  const { error: insertErr } = await supabase.from("device_settings").insert(rows);
  if (insertErr) throw new Error(`insert failed: ${insertErr.message}`);
  console.log(`[preset-test] inserted ${rows.length} device_settings rows for preset "${preset.key}"`);

  let resolved = 0;
  let unresolved = 0;
  for (const key of keys) {
    const entry = resolveWriteEntry(writeCatalog, key);
    if (!entry || entry.registers.length === 0) {
      console.log(`  UNRESOLVED  ${key} — no enabled register mapping on this device`);
      unresolved++;
      continue;
    }
    try {
      const writes = computeRegisterWrites(entry, String(values[key]));
      console.log(`  ok  ${key} = ${values[key]} -> register(s) ${writes.map((w) => `${w.register}=${w.value}`).join(", ")}`);
      resolved++;
    } catch (err) {
      console.log(`  FAIL  ${key}: ${err.message}`);
      unresolved++;
    }
  }
  console.log(`\n[preset-test] ${resolved} of ${keys.length} keys resolved to a real register write.`);

  const { data: check } = await supabase
    .from("device_settings")
    .select("applied_preset_key")
    .eq("device_id", deviceId)
    .eq("setting_category", "test")
    .limit(1);
  console.log(`[preset-test] applied_preset_key on the inserted rows: ${check?.[0]?.applied_preset_key ?? "MISSING"}`);

  const { error: cleanupErr, count } = await supabase
    .from("device_settings")
    .delete({ count: "exact" })
    .eq("device_id", deviceId)
    .eq("setting_category", "test")
    .eq("applied_preset_key", preset.key);
  console.log(`[preset-test] cleanup: ${cleanupErr ? cleanupErr.message : `deleted ${count} rows`}`);

  if (unresolved > 0) process.exitCode = 1;
}

async function featureFlagTest(deviceId, category) {
  const before = await loadDevice(deviceId);
  const beforeInCatalog = before.catalog.some((c) => c.category === category) || before.writeCatalog.some((c) => c.category === category);
  console.log(`[feature-flag-test] before disabling "${category}": present in catalog = ${beforeInCatalog}`);

  const { error: insertErr } = await supabase.from("device_feature_flags").insert({ device_id: deviceId, category, is_enabled: false });
  if (insertErr) throw new Error(`could not disable category: ${insertErr.message}`);

  try {
    const after = await loadDevice(deviceId);
    const stillInRead = after.catalog.some((c) => c.category === category);
    const stillInWrite = after.writeCatalog.some((c) => c.category === category);
    console.log(`[feature-flag-test] after disabling: still in read catalog = ${stillInRead}, still in write catalog = ${stillInWrite}`);

    const anyWriteEntry = before.writeCatalog.find((c) => c.category === category);
    if (anyWriteEntry) {
      const resolved = resolveWriteEntry(after.writeCatalog, anyWriteEntry.parameter_key);
      console.log(`[feature-flag-test] write lookup for "${anyWriteEntry.parameter_key}" while disabled: ${resolved ? "STILL RESOLVES (bug)" : "correctly rejected"}`);
    }

    const pass = !stillInRead && !stillInWrite;
    console.log(`\n[feature-flag-test] ${pass ? "PASS" : "FAIL"} — category "${category}" ${pass ? "fully excluded" : "still present"} after being disabled.`);
    if (!pass) process.exitCode = 1;
  } finally {
    const { error: cleanupErr } = await supabase.from("device_feature_flags").delete().eq("device_id", deviceId).eq("category", category);
    console.log(`[feature-flag-test] cleanup: ${cleanupErr ? cleanupErr.message : "re-enabled (flag row removed)"}`);
  }
}

async function protocolTest(deviceId) {
  const { device, catalog, writeCatalog } = await loadDevice(deviceId);

  const { data: protocolRows } = await supabase
    .from("device_parameter_map")
    .select("protocol")
    .eq("stock_id", device.device_type.id)
    .eq("is_enabled", true);
  const protocols = [...new Set((protocolRows ?? []).map((r) => r.protocol))];

  console.log(`[protocol-test] ${device.label ?? device.id} (${device.device_type.name}) — protocol(s) in device_parameter_map: ${protocols.join(", ") || "none"}`);
  console.log(
    `[protocol-test] loadDevice's same query/lookup path (no protocol-specific branching) resolved ${catalog.length} read + ${writeCatalog.length} write entries for this device.`
  );
  console.log(
    `\n[protocol-test] confirmed — this device's registers use [${protocols.join(", ")}], and the exact same generic code that serves the Modbus device above handled it unmodified.`
  );
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(`Deye Modbus agent — mode=${args.mode} device=${args.deviceId}${args.readOnly ? " (read-only)" : ""}`);

  if (args.mode === "codec-test") return codecTest(args.deviceId);
  if (args.mode === "preset-test") {
    if (!args.preset) throw new Error("--mode=preset-test requires --preset=<key>");
    return presetTest(args.deviceId, args.preset);
  }
  if (args.mode === "feature-flag-test") {
    if (!args.category) throw new Error("--mode=feature-flag-test requires --category=<name>");
    return featureFlagTest(args.deviceId, args.category);
  }
  if (args.mode === "protocol-test") return protocolTest(args.deviceId);

  const { device, catalog, writeCatalog } = await loadDevice(args.deviceId);
  console.log(`Device: ${device.label ?? device.id} (${device.device_type.name}) — ${catalog.length} read + ${writeCatalog.length} write registers cataloged`);

  const state = new SimState();
  if (args.mode === "simulate" && !args.noRead) await state.seedFromDb(args.deviceId);

  if (args.mode === "simulate" && args.backfillDays > 0) {
    await backfillDeye(args.deviceId, catalog, state, args.backfillDays);
  }

  let modbusClient = null;
  if (args.mode === "modbus" && !args.readOnly) {
    const { default: ModbusRTU } = await import("modbus-serial");
    modbusClient = new ModbusRTU();
    modbusClient.setID(1);
    modbusClient.setTimeout(3000);
    await modbusClient.connectTCP(args.host, { port: 502 });
    console.log(`[write] connected to ${args.host}:502 for real register writes.`);
  }

  if (!args.readOnly) startWriteListener(args.deviceId, writeCatalog, modbusClient);

  if (args.noRead) {
    console.log("--no-read set: write listener only, no read tick/loop. Ctrl+C to stop.");
    return;
  }

  async function tick() {
    const now = new Date();
    try {
      const values = args.mode === "modbus" ? await readModbusTick(catalog, args.host) : simulateTick(now, state);
      await insertReadings(args.deviceId, catalog, values, now.toISOString());
      console.log(`[read] ${now.toTimeString().slice(0, 8)}  inserted ${Object.keys(values).length} readings (mode=${args.mode})`);
    } catch (err) {
      console.error(`[read] tick failed:`, err.message ?? err);
    }
  }

  await tick();
  if (args.once) {
    console.log("--once set, exiting after one tick.");
    process.exit(0);
  }
  setInterval(tick, INTERVAL_MS);
  console.log(`Read loop running every ${INTERVAL_MS / 60000} min. Write listener ${args.readOnly ? "disabled" : "active"}. Ctrl+C to stop.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
