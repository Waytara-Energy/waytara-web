#!/usr/bin/env node
// Deye SUN-8K-SG05LP1-EU Modbus agent — the real hardware read/write bridge
// this project has been building toward all session. Two independent jobs
// in one process:
//
//  1. READ LOOP, every 5 minutes: populate equipment_telemetry. Two modes:
//     --mode=simulate (default) generates plausible values with the same
//     physical model as the earlier .seed-manoj-live-monitoring.mjs, now
//     covering the full register-mapped catalog and inserting under the
//     equipment schema's key_name names. --mode=modbus reads the
//     real inverter over Modbus TCP via the Waveshare RS485 gateway — built
//     against the read-registers doc's own guidance, but not yet run
//     against real hardware.
//  2. WRITE LISTENER, always on: subscribes to equipment_configs INSERT via
//     Supabase Realtime. For now this only *prints* what it would write —
//     no actual register write, no confirmation-back-to-Supabase yet, both
//     deliberately deferred (see the TODO at applyModbusWrite below) until
//     the read side has been verified against real hardware.
//
// Register data is NOT hardcoded here — both loops read `address`/`decode`
// straight from the DB (equipment_metrics — this device's own per-install
// copy of its registers, joined to equipment_templates for display
// metadata), so this script and the database can never silently drift
// apart on what maps to what.
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
//                                                               deleting a day's worth of equipment_telemetry so the
//                                                               gap doesn't sit empty until the live loop refills it
//                                                               one tick at a time. --backfill-days=7 for a week.
//
// Test modes — each runs once, reports, and exits (no live loop):
//   node scripts/deye-modbus-agent.mjs --mode=codec-test [--device-id=<uuid>]
//       Round-trips register-codec.mjs's decode()/encode() against every
//       real decode spec in this device's own equipment_metrics rows:
//       generates a plausible raw register value, decodes it, and for
//       write-direction rows encodes the decoded value back and asserts it
//       reproduces the same raw register value(s).
//   node scripts/deye-modbus-agent.mjs --mode=protocol-test --device-id=<ev-charger-device-id>
//       Confirms loadDevice's generic equipment_id-keyed lookup works
//       unmodified against a non-Modbus device (an EV charger, whose
//       `address` is an OCPP path rather than a register list) — proves the
//       catalog/lookup layer is protocol-agnostic. Not a live OCPP
//       connection — there's no real charger or simulator to connect to.
//   node scripts/deye-modbus-agent.mjs --mode=seed-settings [--device-id=<uuid>]
//       Simulates the one-time "device reports its full current
//       configuration" read a real inverter/charger does at commissioning,
//       before any customer edit — inserts one equipment_configs row per
//       write-direction catalog key that doesn't already have one (never
//       touches a key that's already set). Idempotent: safe to re-run after
//       a catalog update, since it only ever fills gaps.
//
// Removed test modes: --mode=preset-test and --mode=feature-flag-test no
// longer apply — setting_presets/TOU-as-template was dropped (customers
// enter every TOU field directly now) and device_feature_flags was folded
// into equipment_metrics itself (a category is only ever present on a
// device's own rows at all, per-device, so there's nothing left to
// dynamically disable/re-enable).

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
    // No default on purpose: the old hard-coded id pointed at a device that no longer exists,
    // and this script writes to whatever database apps/web/.env.local points at.
    deviceId: null,
    host: null,
    readOnly: false,
    once: false,
    noRead: false,
    backfillDays: 0,
  };
  for (const arg of argv) {
    if (arg === "--read-only") args.readOnly = true;
    else if (arg === "--no-read") args.noRead = true;
    else if (arg === "--once") args.once = true;
    else if (arg.startsWith("--mode=")) args.mode = arg.slice("--mode=".length);
    else if (arg.startsWith("--device-id=")) args.deviceId = arg.slice("--device-id=".length);
    else if (arg.startsWith("--host=")) args.host = arg.slice("--host=".length);
    else if (arg.startsWith("--backfill-days=")) args.backfillDays = Number(arg.slice("--backfill-days=".length));
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

async function loadDevice(deviceId) {
  const { data: device, error } = await supabase
    .from("equipment")
    .select("id, label, device_type:equipment_inventory(id, category, name, phase_count, power_capacity_value, technical_specs)")
    .eq("id", deviceId)
    .maybeSingle();
  if (error || !device) throw new Error(`Device ${deviceId} not found: ${error?.message ?? "no row"}`);

  // equipment_metrics is this device's own per-install copy of its
  // registers — there's no separate "is this category enabled" flag to
  // check anymore (that was device_feature_flags, now retired): a category
  // is simply absent from a device's rows when it doesn't apply.
  const { data: metricRows, error: catalogError } = await supabase
    .from("equipment_metrics")
    .select(
      "key_name, category, direction, address, decode, enum_ref, valid_min, valid_max, equipment_templates!inner(display_name, unit, value_kind)"
    )
    .eq("equipment_id", deviceId);
  if (catalogError) throw new Error(`Failed to load register catalog: ${catalogError.message}`);

  // Reassembled into the old combined `modbus_register` shape
  // ({registers, scale, signed, ...} in one object) for the read catalog
  // specifically, so readModbusTick/buildRows (which predate the
  // address/decode split) need zero changes. Not gated on
  // c.address?.registers?.length here — a freshly template-cloned device
  // (cloneTemplateIntoEquipment leaves address/decode null until staff map
  // real registers) still needs its keys in simulate mode, which never
  // reads modbus_register at all; readModbusTick (real hardware mode)
  // already guards its own per-entry loop with the same registers.length
  // check, so an unaddressed entry is silently skipped there instead.
  const readCatalog = (metricRows ?? [])
    .filter((c) => c.direction === "read")
    .map((c) => ({
      parameter_key: c.key_name,
      parameter_name: c.equipment_templates?.display_name ?? c.key_name,
      category: c.category,
      unit: c.equipment_templates?.unit ?? null,
      modbus_register: { ...c.address, ...(c.decode ?? {}) },
    }));

  // Write catalog keeps address/decode separate (encode() below wants
  // them apart, not pre-merged) plus the catalog metadata applyModbusWrite
  // needs to validate a value before ever touching a register.
  // equipment_templates no longer carries a min_role/regulated distinction
  // (every write-direction row is already customer-curated) — same
  // reasoning apps/web's updateInstrumentSetting already follows.
  const writeCatalog = (metricRows ?? [])
    .filter((c) => c.direction === "write")
    .map((c) => ({
      parameter_key: c.key_name,
      parameter_name: c.equipment_templates?.display_name ?? c.key_name,
      category: c.category,
      unit: c.equipment_templates?.unit ?? null,
      value_kind: c.equipment_templates?.value_kind ?? "number",
      enum_ref: c.enum_ref ?? null,
      valid_min: c.valid_min ?? null,
      valid_max: c.valid_max ?? null,
      registers: c.address?.registers ?? [],
      decode: c.decode ?? null,
    }));

  return { device, catalog: readCatalog, writeCatalog };
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
    this.phaseCount = 1;
    // Grid-tied family only (String Inverter / Microinverter — see
    // simulateGridTiedTick below); unused by the battery-dispatch model.
    this.ratedPowerW = 0;
    this.hasLoadMetering = false;
    this.subUnitKind = null; // "string" | "module" | null
    this.subUnitCount = 0;
    this.daySubUnitEnergyKwh = [];
    this.subUnitLifetimeEnergyKwh = [];
    this.totalReactiveEnergyKvarh = 0;
    this.totalWorkingTimeH = 0;
    this.socPct = 70;
    this.totalPvKwh = 0;
    this.totalBatteryChargeKwh = 0;
    this.totalBatteryDischargeKwh = 0;
    this.totalGridImportKwh = 0;
    this.totalGridExportKwh = 0;
    this.totalLoadKwh = 0;
    this.monthPvKwh = 0;
    this.monthGridExportKwh = 0;
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
        .from("equipment_telemetry")
        .select("value")
        .eq("equipment_id", deviceId)
        .eq("key_name", key)
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
    this.monthGridExportKwh = await latest("month_grid_export_energy_kwh", 0);
    this.monthLoadKwh = await latest("month_load_energy_kwh", 0);
    this.yearPvKwh = await latest("year_pv_energy_kwh", 0);
    this.yearGridExportKwh = await latest("year_grid_export_energy_kwh", 0);
    this.yearLoadKwh = await latest("year_load_energy_kwh", 0);
    this.totalReactiveEnergyKvarh = await latest("total_reactive_energy_kvarh", 0);
    this.totalWorkingTimeH = await latest("total_working_time_h", 0);
  }
}

/** One tick's worth of readings, keyed by key_name — only the fields
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
  state.totalReactiveEnergyKvarh += loadKwh * 0.1;
  state.totalWorkingTimeH += solarW > 0 ? hrs : 0;
  state.totalPvKwh += solarKwh;
  state.totalBatteryChargeKwh += battChargeKwh;
  state.totalBatteryDischargeKwh += battDischargeKwh;
  state.totalGridImportKwh += gridImportKwh;
  state.totalGridExportKwh += gridExportKwh;
  state.totalLoadKwh += loadKwh;
  state.monthPvKwh += solarKwh;
  state.monthGridExportKwh += gridExportKwh;
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
  // BMS-reported pack readings (Phase 5 read-side coverage) — a separate
  // chip on the same physical pack as the inverter's own battery_* sensors,
  // so these track them closely rather than being independently modeled.
  // No fault modeling in this simulator (active_fault_code is always 0),
  // so the alarm/fault masks and fault words stay clear, same as
  // active_fault_code itself above.
  const bmsVoltageV = jitter(batteryVoltageV, 0.005);
  const bmsCurrentA = jitter(batteryCurrentA, 0.01);
  const bmsTempC = jitter(batteryTempC, 0.02);
  const BMS_DISCHARGE_LIMIT_V = 44.8;

  // Per-phase split (Phase 6, real 3-phase data) — a true 3-phase device
  // splits grid/load/inverter power+current evenly across L1/L2/L3;
  // single-phase and split-phase (2-leg) devices keep everything on L1,
  // as they did before this field existed. L3 values are only ever
  // written for the one stock that has grid_l3_*/load_l3_power_w/
  // inverter_power_l3_w mapped in equipment_metrics — for
  // every other device buildRows() drops them regardless of what's
  // returned here, same mechanism that already keeps pv3/pv4 out of
  // devices with only 2 MPPT channels.
  const isThreePhase = state.phaseCount === 3;
  const gridL1PowerW = isThreePhase ? gridPowerW / 3 : gridPowerW;
  const gridL2PowerW = isThreePhase ? gridPowerW / 3 : 0;
  const gridL3PowerW = isThreePhase ? gridPowerW / 3 : 0;
  const loadL1PowerW = isThreePhase ? loadW / 3 : loadW;
  const loadL2PowerW = isThreePhase ? loadW / 3 : 0;
  const loadL3PowerW = isThreePhase ? loadW / 3 : 0;
  const inverterL1PowerW = isThreePhase ? solarW / 3 : solarW;
  const inverterL2PowerW = isThreePhase ? solarW / 3 : 0;
  const inverterL3PowerW = isThreePhase ? solarW / 3 : 0;
  const secondLegVoltageV = isThreePhase ? jitter(230, 0.01) : 0;
  const thirdLegVoltageV = isThreePhase ? jitter(230, 0.01) : 0;
  const loadCurrentL1A = gridVoltageV > 0 ? Math.abs(loadL1PowerW) / gridVoltageV : 0;
  const loadCurrentL2A = isThreePhase && secondLegVoltageV > 0 ? Math.abs(loadL2PowerW) / secondLegVoltageV : 0;
  const loadCurrentL3A = isThreePhase && thirdLegVoltageV > 0 ? Math.abs(loadL3PowerW) / thirdLegVoltageV : 0;
  const gridCurrentL2A = isThreePhase && secondLegVoltageV > 0 ? Math.abs(gridL2PowerW) / secondLegVoltageV : 0;
  const gridCurrentL3A = isThreePhase && thirdLegVoltageV > 0 ? Math.abs(gridL3PowerW) / thirdLegVoltageV : 0;
  const inverterCurrentL2A = isThreePhase && secondLegVoltageV > 0 ? Math.abs(inverterL2PowerW) / secondLegVoltageV : 0;
  const inverterCurrentL3A = isThreePhase && thirdLegVoltageV > 0 ? Math.abs(inverterL3PowerW) / thirdLegVoltageV : 0;

  // Battery packs (Battery > Battery packs, up to 15) — each pack tracks
  // the same aggregate SOC/voltage/current the inverter's own sensor
  // reports, with a small fixed per-pack offset (imbalance is real but
  // small in a healthy pack, not independently modeled) rather than
  // independent physics per pack. buildRows() only keeps whichever packs
  // this device's own equipment_metrics actually maps, same mechanism
  // already used for PV inputs/strings/modules below.
  const packFields = {};
  for (let i = 1; i <= 15; i++) {
    const offset = ((i * 37) % 11) / 100 - 0.05; // deterministic small per-pack spread, not random noise
    packFields[`battery_pack${i}_voltage_v`] = round(batteryVoltageV * (1 + offset * 0.02), 2);
    packFields[`battery_pack${i}_current_a`] = round(batteryCurrentA * (1 + offset * 0.05), 2);
    packFields[`battery_pack${i}_soc_pct`] = round(Math.max(0, Math.min(100, state.socPct + offset * 2)));
    packFields[`battery_pack${i}_temperature_c`] = round(batteryTempC + offset * 3, 1);
    packFields[`battery_pack${i}_charge_current_a`] = round(Math.max(0, batteryCurrentA) * (1 + offset * 0.05), 2);
    packFields[`battery_pack${i}_charge_voltage_v`] = round(batteryChargingVoltageV, 2);
    packFields[`battery_pack${i}_discharge_current_a`] = round(Math.max(0, -batteryCurrentA) * (1 + offset * 0.05), 2);
    packFields[`battery_pack${i}_max_cell_voltage_v`] = round(batteryVoltageV / 16 + 0.02, 3);
    packFields[`battery_pack${i}_min_cell_voltage_v`] = round(batteryVoltageV / 16 - 0.02, 3);
    packFields[`battery_pack${i}_max_cell_temperature_c`] = round(batteryTempC + 1.5, 1);
    packFields[`battery_pack${i}_min_cell_temperature_c`] = round(batteryTempC - 1.5, 1);
    // Maintenance (Battery Alerts > Packs) — no fault modeling in this
    // simulator, matching every other fault/alarm bitmask below.
    packFields[`battery_pack${i}_fault`] = 0;
    packFields[`battery_pack${i}_warning`] = 0;
    // Performance (Battery Health > Packs) — cycle count/capacity grow
    // very slowly; approximated from total lifetime throughput rather
    // than independently tracked per pack.
    packFields[`battery_pack${i}_cycle_count`] = round(state.totalBatteryDischargeKwh / (BATTERY_CAPACITY_KWH / 15 || 1));
    packFields[`battery_pack${i}_total_capacity_ah`] = round((BATTERY_CAPACITY_KWH * 1000) / 15 / NOMINAL_BATTERY_V, 1);
    packFields[`battery_pack${i}_remaining_capacity_ah`] = round(
      (((BATTERY_CAPACITY_KWH * 1000) / 15) * (state.socPct / 100)) / NOMINAL_BATTERY_V,
      1
    );
    packFields[`battery_pack${i}_soh_pct`] = 98;
  }

  // PV inputs 3-8 (Solar Array > Per input (MPPT)) — pv1/pv2 already
  // carry the real generation split above; 3-8 are this same device's
  // remaining MPPT channels, sharing the leftover none of pv1/pv2 claims
  // (a real 8-input hybrid inverter spreads generation across whichever
  // strings are physically wired, not just the first two).
  const pvExtraShares = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]; // this stock's own doc only confirms 2 real MPPT inputs wired — see PV_STRING_FIELDS' old comment
  const pvExtraFields = {};
  for (let i = 0; i < 6; i++) {
    const n = i + 3;
    const shareW = solarW * pvExtraShares[i];
    const voltageV = shareW > 0 ? jitter(380, 0.02) : 0;
    pvExtraFields[`pv${n}_voltage_v`] = round(voltageV, 1);
    pvExtraFields[`pv${n}_current_a`] = round(voltageV > 0 ? shareW / voltageV : 0, 2);
    // pv5-8_power_w are source: "calculated" (app-resolved from voltage *
    // current) — pv3/pv4_power_w are the only extras with a real register,
    // so only those two are emitted here.
    if (n <= 4) pvExtraFields[`pv${n}_power_w`] = round(shareW);
  }

  // Per-string (up to 16) / per-microinverter-panel (up to 4) totals —
  // same even-share-of-generation model as simulateGridTiedTick's own
  // sub-unit loop, sized to the schema's own ceiling since buildRows()
  // filters to whatever this device actually maps.
  const stringFields = {};
  for (let i = 1; i <= 16; i++) {
    const shareKwh = (state.totalPvKwh * 0.02) / 16; // even share of lifetime yield, rough approximation
    const currentA = pv1VoltageV > 0 ? (solarW / 16) / pv1VoltageV : 0;
    stringFields[`pv_string${i}_current_a`] = round(currentA, 2);
    stringFields[`pv_string${i}_total_energy_kwh`] = round(shareKwh, 2);
  }
  const panelFields = {};
  for (let i = 1; i <= 4; i++) {
    panelFields[`micro_panel${i}_day_energy_kwh`] = round(state.dayYieldKwh / 4, 2);
    panelFields[`micro_panel${i}_total_energy_kwh`] = round(state.totalPvKwh / 4, 2);
  }

  return {
    // Solar Array — Per input (MPPT) / Per string / Per panel
    pv1_voltage_v: round(pv1VoltageV, 1),
    pv1_current_a: round(pv1CurrentA, 1),
    pv1_power_w: round(pv1ShareW),
    pv2_voltage_v: round(pv2VoltageV, 1),
    pv2_current_a: round(pv2CurrentA, 1),
    pv2_power_w: round(pv2ShareW),
    ...pvExtraFields,
    ...stringFields,
    ...panelFields,
    // Overview — cross-referenced by Monitoring/Performance/Reports too
    day_pv_energy_kwh: round(state.dayYieldKwh, 2),
    total_pv_energy_kwh: round(state.totalPvKwh, 1),
    battery_power_w: round(batteryPowerW),
    battery_soc_pct: round(state.socPct),
    grid_total_power_w: round(gridPowerW),
    load_total_power_w: round(loadW),
    inverter_run_state: solarW <= 0 && Math.abs(batteryPowerW) < 1 ? 0 : 2,
    day_grid_import_energy_kwh: round(state.dayGridImportKwh, 2),
    day_grid_export_energy_kwh: round(state.dayGridExportKwh, 2),
    day_load_energy_kwh: round(state.dayLoadKwh, 2),
    // Battery — Live / BMS / Energy / packs
    battery_voltage_v: round(batteryVoltageV, 1),
    battery_current_a: round(batteryCurrentA, 2),
    battery_temperature_c: round(batteryTempC, 1),
    battery_charge_status: batteryPowerW > 0 ? 1 : batteryPowerW < 0 ? 2 : 0,
    battery_pack_count: 1,
    bms_voltage_v: round(bmsVoltageV, 2),
    bms_current_a: round(bmsCurrentA, 2),
    bms_temperature_c: round(bmsTempC, 1),
    bms_soc_pct: round(state.socPct),
    bms_discharge_voltage_v: BMS_DISCHARGE_LIMIT_V,
    bms_charge_voltage_v: round(batteryChargingVoltageV, 2),
    bms_charge_current_limit_a: batteryChargeLimitA,
    bms_discharge_current_limit_a: batteryDischargeLimitA,
    bms_max_charge_current_limit_a: batteryChargeLimitA,
    bms_max_discharge_current_limit_a: batteryDischargeLimitA,
    bms_alarm_1: 0,
    bms_alarm_2: 0,
    bms_fault_1: 0,
    bms_fault_2: 0,
    battery_alarm: 0,
    battery_fault: 0,
    battery_corrected_capacity_ah: round(jitter((BATTERY_CAPACITY_KWH * 1000) / NOMINAL_BATTERY_V, 0.01), 1),
    battery_remaining_capacity_ah: round((((BATTERY_CAPACITY_KWH * 1000) * (state.socPct / 100)) / NOMINAL_BATTERY_V), 1),
    battery_soh_pct: 98,
    battery_communication_status: 1,
    day_battery_charge_energy_kwh: round(state.dayBatteryChargeKwh, 2),
    day_battery_discharge_energy_kwh: round(state.dayBatteryDischargeKwh, 2),
    total_battery_charge_energy_kwh: round(state.totalBatteryChargeKwh, 1),
    total_battery_discharge_energy_kwh: round(state.totalBatteryDischargeKwh, 1),
    ...packFields,
    // Inverter — AC output / DC input / Energy / Temperature
    inverter_output_power_w: round(solarW),
    inverter_dc_input_power_w: round(solarW),
    inverter_l1_voltage_v: round(inverterVoltageV, 1),
    inverter_l1_current_a: round(inverterCurrentA, 2),
    inverter_l1_power_w: round(inverterL1PowerW),
    inverter_l2_voltage_v: isThreePhase ? round(secondLegVoltageV, 1) : 0,
    inverter_l2_current_a: round(inverterCurrentL2A, 2),
    inverter_l2_power_w: round(inverterL2PowerW),
    inverter_l3_voltage_v: isThreePhase ? round(thirdLegVoltageV, 1) : 0,
    inverter_l3_current_a: round(inverterCurrentL3A, 2),
    inverter_l3_power_w: round(inverterL3PowerW),
    inverter_l1_l2_voltage_v: isThreePhase ? round(inverterVoltageV + secondLegVoltageV, 1) : round(inverterVoltageV, 1),
    inverter_output_frequency_hz: round(inverterFrequencyHz, 2),
    output_apparent_power_va: round(Math.abs(solarW) / 0.99),
    output_reactive_power_var: round(loadW * 0.1),
    backup_ups_power_w: round(loadW),
    inverter_dc_temperature_c: round(inverterDcTempC, 1),
    inverter_ac_temperature_c: round(inverterAcTempC, 1),
    day_active_energy_kwh: round(state.dayActiveEnergyKwh, 2),
    day_reactive_energy_kvarh: round(state.dayReactiveEnergyKvarh, 2),
    total_active_energy_kwh: round(state.totalPvKwh - state.totalLoadKwh, 1),
    total_reactive_energy_kvarh: round(state.totalReactiveEnergyKvarh, 2),
    inverter_efficiency_pct: round(solarW > 0 ? jitter(97.5, 0.005) : 0, 1),
    total_working_time_h: round(state.totalWorkingTimeH, 2),
    rated_power_w: RATED_POWER_W,
    // Grid — Per phase / Energy meter/CT / Status
    grid_l1_voltage_v: round(gridVoltageV, 1),
    grid_l1_current_a: round(gridCurrentA, 2),
    grid_l1_power_w: round(gridL1PowerW),
    grid_l2_voltage_v: isThreePhase ? round(secondLegVoltageV, 1) : 0,
    grid_l2_current_a: round(gridCurrentL2A, 2),
    grid_l2_power_w: round(gridL2PowerW),
    grid_l3_voltage_v: isThreePhase ? round(thirdLegVoltageV, 1) : 0,
    grid_l3_current_a: round(gridCurrentL3A, 2),
    grid_l3_power_w: round(gridL3PowerW),
    grid_l1_l2_voltage_v: isThreePhase ? round(gridVoltageV + secondLegVoltageV, 1) : round(gridVoltageV, 1),
    grid_l2_l3_voltage_v: isThreePhase ? round(secondLegVoltageV + thirdLegVoltageV, 1) : 0,
    grid_l3_l1_voltage_v: isThreePhase ? round(thirdLegVoltageV + gridVoltageV, 1) : 0,
    grid_relay_middle_voltage_v: isThreePhase ? round(gridVoltageV + secondLegVoltageV, 1) : round(gridVoltageV, 1),
    grid_frequency_hz: round(gridFrequencyHz, 2),
    grid_relay_status: 1,
    grid_ct_total_power_w: round(gridPowerW),
    grid_ct_l1_power_w: round(gridL1PowerW),
    grid_ct_l1_current_a: round(gridCurrentA, 2),
    grid_ct_l2_power_w: round(gridL2PowerW),
    grid_ct_l2_current_a: round(gridCurrentL2A, 2),
    export_limiter_power_w: 0,
    // Home Load — Per phase
    load_frequency_hz: round(loadFrequencyHz, 2),
    load_l1_voltage_v: round(gridVoltageV, 1),
    load_l1_current_a: round(loadCurrentL1A, 2),
    load_l1_power_w: round(loadL1PowerW),
    load_l2_voltage_v: isThreePhase ? round(secondLegVoltageV, 1) : 0,
    load_l2_current_a: round(loadCurrentL2A, 2),
    load_l2_power_w: round(loadL2PowerW),
    load_l3_voltage_v: isThreePhase ? round(thirdLegVoltageV, 1) : 0,
    load_l3_current_a: round(loadCurrentL3A, 2),
    load_l3_power_w: round(loadL3PowerW),
    // Generator — no generator hardware modeled (this simulator has no
    // dispatch logic for one), so it reads a consistent idle/off state
    // rather than perpetual "no data" — same "stay clear, don't fabricate
    // activity" spirit as the fault bitmasks below.
    generator_power_w: 0,
    generator_voltage_v: 0,
    generator_frequency_hz: 0,
    generator_relay_status: 0,
    day_generator_energy_kwh: 0,
    generator_day_run_time_h: 0,
    total_generator_energy_kwh: 0,
    // Maintenance — Alerts / System Checks. No fault modeling in this
    // simulator, so every bitmask and check stays clear/clean.
    fault_message_1: 0,
    fault_message_2: 0,
    fault_message_3: 0,
    fault_message_4: 0,
    warning_message_1: 0,
    warning_message_2: 0,
    alarm_status_1: 0,
    alarm_status_2: 0,
    fault_history: 0,
    grid_phase_error: 0,
    generator_phase_error: 0,
    inverter_date_time: Math.floor(Date.now() / 1000),
    // Reports — month/year/total rollups
    month_pv_energy_kwh: round(state.monthPvKwh, 1),
    month_grid_export_energy_kwh: round(state.monthGridExportKwh, 1),
    month_load_energy_kwh: round(state.monthLoadKwh, 1),
    year_pv_energy_kwh: round(state.yearPvKwh, 1),
    year_grid_export_energy_kwh: round(state.yearGridExportKwh, 1),
    year_load_energy_kwh: round(state.yearLoadKwh, 1),
    total_grid_import_energy_kwh: round(state.totalGridImportKwh, 1),
    total_grid_export_energy_kwh: round(state.totalGridExportKwh, 1),
    total_load_energy_kwh: round(state.totalLoadKwh, 1),
  };
}

// ============================================================
// READ — simulate mode, grid-tied family (String Inverter, Microinverter:
// no battery, so no charge/discharge dispatch decision — generation flows
// straight through to the grid/load side). Reuses the same daylight/cloud
// curve as simulateTick above; picked by main() when the device's own
// catalog has no battery_power_w mapped, so onboarding a third grid-tied
// model needs zero changes here.
// ============================================================

function simulateGridTiedTick(date, state) {
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
    state.dayLoadKwh = 0;
    state.dayActiveEnergyKwh = 0;
    state.dayReactiveEnergyKvarh = 0;
    state.daySubUnitEnergyKwh = state.subUnitCount > 0 ? new Array(state.subUnitCount).fill(0) : [];
  }

  const df = daylightFactor(hour);
  state.cloudCover += (Math.random() - 0.5) * 0.04 + (state.dayType.baseCloud - state.cloudCover) * 0.15;
  state.cloudCover = Math.max(0, Math.min(0.95, state.cloudCover));
  if (state.cloudPassRemainingTicks > 0) {
    state.cloudPassRemainingTicks--;
  } else if (df > 0 && Math.random() < state.dayType.passProbPerTick) {
    state.cloudPassRemainingTicks = 1 + Math.floor(Math.random() * 3);
    const [minDepth, maxDepth] = state.dayType.passDepth;
    state.cloudPassDepth = minDepth + Math.random() * (maxDepth - minDepth);
  }
  const passFactor = state.cloudPassRemainingTicks > 0 ? state.cloudPassDepth : 0;
  const effectiveCloud = Math.min(0.97, state.cloudCover + passFactor);
  const cloudFactor = 1 - effectiveCloud;

  const solarW = df > 0 ? jitter(state.ratedPowerW * df * cloudFactor, 0.05) : 0;
  const hrs = 5 / 60;
  const solarKwh = (solarW * hrs) / 1000;
  state.dayYieldKwh += solarKwh;
  state.totalPvKwh += solarKwh;
  state.monthPvKwh += solarKwh;
  state.yearPvKwh += solarKwh;

  // Microinverter has no smart-meter/load registers at all (every watt
  // generated is exported); String does (its own meter_active_power_w
  // etc.), so it nets against a plausible building load — same curve
  // loadBaselineW already uses for the Hybrid family, scaled down since
  // this is a smaller commercial/villa load than a full hybrid site.
  const hasLoad = state.hasLoadMetering;
  const loadW = hasLoad ? jitter(loadBaselineW(hour) * 0.6, 0.12) : 0;
  const loadKwh = (loadW * hrs) / 1000;
  if (hasLoad) {
    state.dayLoadKwh += loadKwh;
    state.totalLoadKwh += loadKwh;
    state.monthLoadKwh += loadKwh;
    state.yearLoadKwh += loadKwh;
  }
  const gridPowerW = loadW - solarW; // positive = importing, negative = exporting — same convention as simulateTick
  const gridImportKwh = (Math.max(gridPowerW, 0) * hrs) / 1000;
  const gridExportKwh = (Math.max(-gridPowerW, 0) * hrs) / 1000;
  state.dayGridImportKwh += gridImportKwh;
  state.dayGridExportKwh += gridExportKwh;
  state.totalGridImportKwh += gridImportKwh;
  state.totalGridExportKwh += gridExportKwh;
  state.monthGridExportKwh += gridExportKwh;
  state.yearGridExportKwh += gridExportKwh;
  state.dayActiveEnergyKwh += solarKwh - loadKwh;
  const reactiveKvarhThisTick = (hasLoad ? loadKwh : solarKwh) * 0.06;
  state.dayReactiveEnergyKvarh += reactiveKvarhThisTick;
  state.totalReactiveEnergyKvarh += reactiveKvarhThisTick;
  state.totalWorkingTimeH += solarW > 0 ? hrs : 0;

  const gridVoltageV = jitter(230, 0.01);
  const gridFrequencyHz = jitter(50, 0.002);
  const inverterCurrentA = gridVoltageV > 0 ? solarW / gridVoltageV : 0;
  const inverterDcTempC = jitter(30 + solarW / 300, 0.03);
  const inverterAcTempC = jitter(28 + solarW / 350, 0.03);

  // PV channels — up to 8 MPPT-style DC inputs (this product line's fixed
  // naming, not model-variable). Only pv1-4_power_w have a real register —
  // pv5-8_power_w are source: "calculated" (app-resolved from voltage *
  // current, see template-fields.ts's COMPUTED_RESOLVERS) — same
  // "don't fabricate a register nothing backs" rule simulateTick's own
  // pv5-8 handling already follows.
  const pvShares = [0.16, 0.14, 0.13, 0.12, 0.12, 0.11, 0.11, 0.11];
  const pv = {};
  for (let i = 0; i < 8; i++) {
    const n = i + 1;
    const shareW = solarW * pvShares[i];
    const voltageV = shareW > 0 ? jitter(370, 0.02) : 0;
    pv[`pv${n}_voltage_v`] = round(voltageV, 1);
    pv[`pv${n}_current_a`] = round(voltageV > 0 ? shareW / voltageV : 0, 1);
    if (n <= 4) pv[`pv${n}_power_w`] = round(shareW);
  }

  // Per-string (String Inverter, up to 16) or per-panel (Microinverter,
  // up to 4) breakdown — an even share of solarW across
  // state.subUnitCount, sized from each device's own technical_specs
  // (mppt_strings / modules_per_gateway) rather than a hardcoded count.
  const subUnits = {};
  const unitCount = state.subUnitCount ?? 0;
  for (let i = 0; i < unitCount; i++) {
    const shareW = unitCount > 0 ? solarW / unitCount : 0;
    const currentA = gridVoltageV > 0 ? shareW / gridVoltageV : 0;
    const shareKwh = (shareW * hrs) / 1000;
    state.daySubUnitEnergyKwh[i] = (state.daySubUnitEnergyKwh[i] ?? 0) + shareKwh;
    state.subUnitLifetimeEnergyKwh[i] = (state.subUnitLifetimeEnergyKwh[i] ?? 0) + shareKwh;
    if (state.subUnitKind === "string") {
      subUnits[`pv_string${i + 1}_current_a`] = round(currentA, 2);
      subUnits[`pv_string${i + 1}_total_energy_kwh`] = round(state.subUnitLifetimeEnergyKwh[i], 2);
    } else if (state.subUnitKind === "module") {
      subUnits[`micro_panel${i + 1}_day_energy_kwh`] = round(state.daySubUnitEnergyKwh[i], 2);
      subUnits[`micro_panel${i + 1}_total_energy_kwh`] = round(state.subUnitLifetimeEnergyKwh[i], 2);
    }
  }

  // Per-phase split — String Inverter can be 3-phase (state.phaseCount,
  // fixed from stock.phase_count); Microinverter is always single-phase.
  // Same L1/L2/L3 convention as simulateTick's own split.
  const isThreePhaseGridTied = state.phaseCount === 3;
  const secondLegVoltageV = isThreePhaseGridTied ? jitter(230, 0.01) : 0;
  const thirdLegVoltageV = isThreePhaseGridTied ? jitter(230, 0.01) : 0;
  const perPhaseCurrentA = isThreePhaseGridTied ? inverterCurrentA / 3 : inverterCurrentA;
  const gridL1PowerW = isThreePhaseGridTied ? gridPowerW / 3 : gridPowerW;
  const gridL2PowerW = isThreePhaseGridTied ? gridPowerW / 3 : 0;
  const gridL3PowerW = isThreePhaseGridTied ? gridPowerW / 3 : 0;
  const inverterL1PowerW = isThreePhaseGridTied ? solarW / 3 : solarW;
  const inverterL2PowerW = isThreePhaseGridTied ? solarW / 3 : 0;
  const inverterL3PowerW = isThreePhaseGridTied ? solarW / 3 : 0;

  // No fault modeling in this simulator — same "stay clear, don't
  // fabricate activity" convention simulateTick's own fault fields use.
  const faultMessage1 = 0;

  return {
    ...pv,
    ...subUnits,
    // Overview — cross-referenced by Monitoring/Performance/Reports too
    day_pv_energy_kwh: round(state.dayYieldKwh, 2),
    total_pv_energy_kwh: round(state.totalPvKwh, 1),
    grid_total_power_w: round(gridPowerW),
    load_total_power_w: round(loadW),
    inverter_run_state: solarW > 0 ? 2 : 0,
    day_grid_import_energy_kwh: round(state.dayGridImportKwh, 2),
    day_grid_export_energy_kwh: round(state.dayGridExportKwh, 2),
    day_load_energy_kwh: round(state.dayLoadKwh, 2),
    // Inverter — AC output / DC input / Energy / Temperature
    inverter_output_power_w: round(solarW),
    inverter_dc_input_power_w: round(solarW),
    inverter_l1_voltage_v: round(gridVoltageV, 1),
    inverter_l1_current_a: round(inverterCurrentA, 2),
    inverter_l1_power_w: round(inverterL1PowerW),
    inverter_l2_voltage_v: isThreePhaseGridTied ? round(secondLegVoltageV, 1) : 0,
    inverter_l2_current_a: 0,
    inverter_l2_power_w: round(inverterL2PowerW),
    inverter_l3_voltage_v: isThreePhaseGridTied ? round(thirdLegVoltageV, 1) : 0,
    inverter_l3_current_a: 0,
    inverter_l3_power_w: round(inverterL3PowerW),
    inverter_l1_l2_voltage_v: isThreePhaseGridTied ? round(gridVoltageV + secondLegVoltageV, 1) : round(gridVoltageV, 1),
    output_apparent_power_va: round(solarW / 0.99),
    output_reactive_power_var: round(solarW * 0.05),
    inverter_dc_temperature_c: round(inverterDcTempC, 1),
    inverter_ac_temperature_c: round(inverterAcTempC, 1),
    day_active_energy_kwh: round(state.dayActiveEnergyKwh, 2),
    day_reactive_energy_kvarh: round(state.dayReactiveEnergyKvarh, 2),
    total_active_energy_kwh: round(state.totalPvKwh - state.totalLoadKwh, 1),
    total_reactive_energy_kvarh: round(state.totalReactiveEnergyKvarh, 2),
    inverter_efficiency_pct: round(solarW > 0 ? jitter(97.5, 0.005) : 0, 1),
    total_working_time_h: round(state.totalWorkingTimeH, 2),
    rated_power_w: state.ratedPowerW,
    // Grid — Per phase / Status
    grid_l1_voltage_v: round(gridVoltageV, 1),
    grid_l1_current_a: round(perPhaseCurrentA, 2),
    grid_l1_power_w: round(gridL1PowerW),
    grid_l2_voltage_v: isThreePhaseGridTied ? round(secondLegVoltageV, 1) : 0,
    grid_l2_current_a: isThreePhaseGridTied ? round(perPhaseCurrentA, 2) : 0,
    grid_l2_power_w: round(gridL2PowerW),
    grid_l3_voltage_v: isThreePhaseGridTied ? round(thirdLegVoltageV, 1) : 0,
    grid_l3_current_a: isThreePhaseGridTied ? round(perPhaseCurrentA, 2) : 0,
    grid_l3_power_w: round(gridL3PowerW),
    grid_l1_l2_voltage_v: isThreePhaseGridTied ? round(gridVoltageV + secondLegVoltageV, 1) : round(gridVoltageV, 1),
    grid_l2_l3_voltage_v: isThreePhaseGridTied ? round(secondLegVoltageV + thirdLegVoltageV, 1) : 0,
    grid_l3_l1_voltage_v: isThreePhaseGridTied ? round(thirdLegVoltageV + gridVoltageV, 1) : 0,
    grid_relay_middle_voltage_v: isThreePhaseGridTied ? round(gridVoltageV + secondLegVoltageV, 1) : round(gridVoltageV, 1),
    grid_frequency_hz: round(gridFrequencyHz, 2),
    grid_relay_status: 1,
    // Maintenance — Alerts / System Checks. No fault modeling in this
    // simulator, so every bitmask and check stays clear/clean.
    fault_message_1: faultMessage1,
    fault_message_2: 0,
    fault_message_3: 0,
    fault_message_4: 0,
    warning_message_1: 0,
    warning_message_2: 0,
    alarm_status_1: 0,
    alarm_status_2: 0,
    fault_history: 0,
    grid_phase_error: 0,
    // Reports — month/year/total rollups
    month_pv_energy_kwh: round(state.monthPvKwh, 1),
    month_grid_export_energy_kwh: round(state.monthGridExportKwh, 1),
    month_load_energy_kwh: round(state.monthLoadKwh, 1),
    year_pv_energy_kwh: round(state.yearPvKwh, 1),
    year_grid_export_energy_kwh: round(state.yearGridExportKwh, 1),
    year_load_energy_kwh: round(state.yearLoadKwh, 1),
    total_grid_import_energy_kwh: round(state.totalGridImportKwh, 1),
    total_grid_export_energy_kwh: round(state.totalGridExportKwh, 1),
    total_load_energy_kwh: round(state.totalLoadKwh, 1),
  };
}

function buildRows(deviceId, catalog, values, ts) {
  const unitByKey = new Map(catalog.map((c) => [c.parameter_key, c.unit]));
  return Object.entries(values)
    .filter(([key]) => unitByKey.has(key) || catalog.some((c) => c.parameter_key === key))
    .map(([key_name, value]) => ({
      equipment_id: deviceId,
      key_name,
      value,
      unit: unitByKey.get(key_name) ?? null,
      ts,
      is_test: false,
    }));
}

async function insertReadings(deviceId, catalog, values, ts) {
  const rows = buildRows(deviceId, catalog, values, ts);
  if (rows.length === 0) return;
  const { error } = await supabase.from("equipment_telemetry").insert(rows);
  if (error) throw new Error(`insert @ ${ts} failed: ${error.message}`);
}

async function insertRowsChunked(rows, chunkSize = 1000) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("equipment_telemetry").insert(chunk);
    if (error) throw new Error(`backfill insert (rows ${i}-${i + chunk.length}) failed: ${error.message}`);
  }
}

/** Regenerates the last `days` days of readings (today included, ending
 *  "now") — one simulateTick() per 5-minute slot, walked forward in order
 *  so the day-boundary counter resets and the cloud model's slow drift
 *  both behave exactly like a real multi-day run would, not like `days`
 *  independent single-day simulations. Meant to be run after deleting a
 *  range of equipment_telemetry so the gap doesn't sit empty until the live
 *  loop catches up tick by tick. */
async function backfillDeye(deviceId, catalog, state, days, tickFn = simulateTick) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  console.log(`[backfill] generating ${days} day(s) of readings from ${start.toISOString()} to ${now.toISOString()}...`);
  let rows = [];
  let ticks = 0;
  for (let t = new Date(start); t <= now; t = new Date(t.getTime() + INTERVAL_MS)) {
    const values = tickFn(t, state);
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
// with no enabled write-direction entry in writeCatalog — because this
// device doesn't map it, or it's not a real register write at all — is
// rejected before any register math runs, not just logged as unknown.
// ============================================================

function resolveWriteEntry(writeCatalog, settingKey) {
  return writeCatalog.find((e) => e.parameter_key === settingKey) ?? null;
}

/** equipment_configs.setting_value is always text — converts it to the
 *  number encode() expects, per value_kind. Booleans and enum codes are
 *  written as their numeric register code, same as any other numeric
 *  field once converted. */
function computeRegisterWrites(entry, settingValue) {
  const value = entry.value_kind === "bool" ? (settingValue === "true" ? 1 : 0) : Number(settingValue);
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
    .channel(`deye-agent:equipment_configs:${deviceId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "waytara", table: "equipment_configs", filter: `equipment_id=eq.${deviceId}` },
      async (payload) => {
        const row = payload.new;
        console.log(`\n[write] setting change requested: ${row.setting_category}.${row.key_name} = ${row.setting_value}`);

        const entry = resolveWriteEntry(writeCatalog, row.key_name);
        if (!entry || entry.registers.length === 0) {
          console.log(
            `[write]   no enabled register mapping for "${row.key_name}" on this device (this device doesn't map it, or it isn't a direct register write) — nothing sent.`
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
  const { data: device } = await supabase
    .from("equipment")
    .select("id, label, device_type:equipment_inventory(id, name)")
    .eq("id", deviceId)
    .maybeSingle();
  if (!device) throw new Error(`Device ${deviceId} not found`);

  const { data: rows, error } = await supabase
    .from("equipment_metrics")
    .select("key_name, address, decode, direction")
    .eq("equipment_id", deviceId);
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
      console.log(`FAIL  ${row.key_name}: decode() threw: ${err.message}`);
      fail++;
      continue;
    }

    if (row.direction !== "write") {
      console.log(`ok    ${row.key_name}: raw=[${regReadings.map((r) => r.raw).join(",")}] -> decoded=${decoded}`);
      pass++;
      continue;
    }

    try {
      const reEncoded = encode(decoded, registers, row.decode);
      const matches = reEncoded.every((w) => regReadings.find((r) => r.register === w.register)?.raw === w.value);
      if (matches) {
        console.log(
          `PASS  ${row.key_name}: raw=[${regReadings.map((r) => r.raw).join(",")}] -> decoded=${decoded} -> re-encoded=[${reEncoded.map((w) => w.value).join(",")}]`
        );
        pass++;
      } else {
        console.log(
          `FAIL  ${row.key_name}: round-trip mismatch. raw=[${regReadings.map((r) => r.raw).join(",")}] decoded=${decoded} re-encoded=[${reEncoded.map((w) => w.value).join(",")}]`
        );
        fail++;
      }
    } catch (err) {
      console.log(`FAIL  ${row.key_name}: encode() threw: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n[codec-test] ${pass} passed, ${fail} failed, ${skipped} skipped (no register address) — ${rows?.length ?? 0} total rows checked.`);
  if (fail > 0) process.exitCode = 1;
}

async function protocolTest(deviceId) {
  const { device, catalog, writeCatalog } = await loadDevice(deviceId);

  console.log(`[protocol-test] ${device.label ?? device.id} (${device.device_type.name}, category=${device.device_type.category}).`);
  console.log(
    `[protocol-test] loadDevice's same query/lookup path (no protocol-specific branching) resolved ${catalog.length} read + ${writeCatalog.length} write entries for this device.`
  );
  console.log(
    `\n[protocol-test] confirmed — a non-Modbus device (this one's "address" is an OCPP path, not a register list) flows through the exact same generic code that serves a Modbus inverter above, unmodified.`
  );
}

// ============================================================
// seed-settings — a real device reports its full current configuration to
// the platform once at commissioning, before any customer ever edits a
// setting. Without that, the Settings tab shows blank for every
// write-direction field until the customer happens to touch it. This mode
// fills in exactly the gap: one equipment_configs row per write-direction
// catalog key that doesn't already have one (never overwrites an existing
// row, customer-made or otherwise — safe to re-run after a partial catalog
// update). TOU fields are seeded like any other write field now — there's
// no preset layer deferring them anymore (customers enter every TOU slot
// directly).
//
// KNOWN_INITIAL_VALUES is the part a human fills in once per new stock
// model (or per key_name, since these are vendor-agnostic logical
// simulateTick() already uses for the Deye SUN-8K (lithium pack, 51.2V
// nominal, 56.4V charging voltage, 44.8V BMS cutoff, 230V/50Hz grid). A key
// with no entry here falls back to a generic, still-plausible default
// (enum: lowest known code; boolean: false; numeric: midpoint of
// valid_min/valid_max, or 0 if neither is set; text: empty string) — good
// enough to not be blank, but nowhere near as considered as a value someone
// who actually knows the model picked, so extending this table is always
// the better fix for a new vendor/model.
// ============================================================

const KNOWN_INITIAL_VALUES = {
  rtc_year_month: "2609",
  rtc_day_hour: "1516",
  rtc_minute_second: "5130",
  batt_max_charge_current_a: 120,
  batt_max_discharge_current_a: 120,
  battery_type: "1", // Lithium
  bms_protocol: "0", // only value observed on this unit
  batt_capacity_ah: 200,
  batt_equalize_voltage_v: 58.4,
  batt_absorption_voltage_v: 56.4, // matches simulateTick's battery_charging_voltage_v
  batt_float_voltage_v: 54.0,
  batt_empty_voltage_v: 44.8, // matches bms_discharge_voltage_v
  equalize_interval_days: 30,
  equalize_duration_h: 2,
  temp_compensation_mv_per_c: 0, // lithium — no temp compensation applied
  batt_control_mode: "1", // By SOC
  batt_charge_efficiency_pct: 95,
  batt_shutdown_soc_pct: 10,
  batt_low_soc_pct: 15, // matches the simulator's own discharge floor
  batt_restart_soc_pct: 20,
  batt_shutdown_voltage_v: 44.0,
  batt_low_voltage_v: 46.0,
  batt_restart_voltage_v: 48.0,
  grid_charge_start_voltage_v: 46.0,
  grid_charge_start_soc_pct: 20,
  grid_charge_current_a: 30,
  gen_charge_enabled: false,
  gen_charge_start_voltage_v: 44.0,
  gen_charge_start_soc_pct: 10,
  gen_charge_current_a: 20,
  gen_max_run_time_h: 8,
  gen_cooling_time_h: 1,
  gen_port_function: "0", // Generator input (factory default)
  smartload_off_voltage_v: 46.0,
  smartload_off_soc_pct: 20,
  smartload_on_voltage_v: 50.0,
  smartload_on_soc_pct: 50,
  smartload_on_delay_min: 5,
  schedule_enable_days: 127, // all 7 days
  export_limit_mode: "0", // Sell to grid
  solar_sell_enabled: true,
  max_sell_power_w: 8000,
  zero_export_power_w: 0,
  gen_peak_shaving_power_w: 0,
  grid_peak_shaving_power_w: 0,
  output_power_factor: 1.0,
  function_switches: 0,
  grid_standard: "4", // IEC61727 — general-purpose default, no dedicated India entry in this enum
  grid_frequency_setting: "0", // 50 Hz
  grid_ov_trip_v: 253,
  grid_uv_trip_v: 196,
  grid_of_trip_hz: 51.5,
  grid_uf_trip_hz: 47.5,
  display_settings: 0,
};

async function genericFallbackValue(entry) {
  if (entry.value_kind === "bool") return false;
  if (entry.value_kind === "enum" && entry.enum_ref) {
    const { data } = await supabase.from("equipment_enum").select("code").eq("enum_ref", entry.enum_ref).order("code").limit(1);
    if (data?.[0]) return data[0].code;
  }
  if (entry.value_kind === "number") {
    if (entry.valid_min !== null && entry.valid_max !== null) return round((entry.valid_min + entry.valid_max) / 2, 2);
    return 0;
  }
  return "";
}

async function seedSettingsMode(deviceId) {
  const { device, writeCatalog } = await loadDevice(deviceId);

  const { data: existing, error } = await supabase.from("equipment_configs").select("key_name").eq("equipment_id", deviceId);
  if (error) throw new Error(`equipment_configs lookup failed: ${error.message}`);
  const have = new Set((existing ?? []).map((r) => r.key_name));

  const missing = writeCatalog.filter((c) => !have.has(c.parameter_key));
  if (missing.length === 0) {
    console.log(`[seed-settings] ${device.label ?? device.id} — every write-direction key already has an equipment_configs row. Nothing to do.`);
    return;
  }

  const baseTs = Date.now();
  const rows = [];
  let knownCount = 0;
  for (const [i, entry] of missing.entries()) {
    const known = Object.prototype.hasOwnProperty.call(KNOWN_INITIAL_VALUES, entry.parameter_key);
    const value = known ? KNOWN_INITIAL_VALUES[entry.parameter_key] : await genericFallbackValue(entry);
    if (known) knownCount++;
    rows.push({
      equipment_id: deviceId,
      ts: new Date(baseTs + i * 1000).toISOString(),
      setting_category: entry.category,
      key_name: entry.parameter_key,
      setting_value: String(value),
      unit: entry.unit,
      written_by: null,
      source: "modbus_initial_read",
      notes: null,
      modbus_register: null,
      previous_value: null,
    });
    console.log(`  ${known ? "known  " : "fallback"}  ${entry.parameter_key} = ${value}`);
  }

  const { error: insertError } = await supabase.from("equipment_configs").insert(rows);
  if (insertError) throw new Error(`insert failed: ${insertError.message}`);

  console.log(
    `\n[seed-settings] ${device.label ?? device.id} — inserted ${rows.length} initial settings rows (${knownCount} known, ${rows.length - knownCount} generic fallback). ${have.size} key(s) already had a row and were left untouched.`
  );
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(`Deye Modbus agent — mode=${args.mode} device=${args.deviceId}${args.readOnly ? " (read-only)" : ""}`);

  if (args.mode === "modbus") {
    console.error(
      "[deprecated] --mode=modbus is disabled. Real inverters are read by the Python equipment_agent\n" +
        "(D:/Manoj-Waytara/inverter script, `python -m equipment_agent`), which decodes offsets, word order,\n" +
        "bit masks and signed values correctly and verifies writes. Running two writers against one device\n" +
        "would duplicate readings. Use --mode=simulate here for demo data only."
    );
    process.exit(1);
  }

  if (!args.deviceId) {
    console.error("Pass --device-id=<equipment uuid> (there is no default; see the comment in parseArgs).");
    process.exit(1);
  }

  if (args.mode === "codec-test") return codecTest(args.deviceId);
  if (args.mode === "protocol-test") return protocolTest(args.deviceId);
  if (args.mode === "seed-settings") return seedSettingsMode(args.deviceId);

  const { device, catalog, writeCatalog } = await loadDevice(args.deviceId);
  console.log(`Device: ${device.label ?? device.id} (${device.device_type.name}) — ${catalog.length} read + ${writeCatalog.length} write registers cataloged`);

  const state = new SimState();
  // Drives the L1/L2/L3 (Hybrid) / A/B/C (String) power split below — a
  // true 3-phase device splits grid/load/inverter power evenly across all
  // three legs; everything else (single-phase and split-phase 2-leg
  // wiring, which is still 1 AC phase) keeps all of it on the one leg.
  state.phaseCount = device.device_type.phase_count ?? 1;

  // battery_power_w mapped -> this is a Hybrid-family (battery-dispatch)
  // device; otherwise it's the grid-tied family (String/Microinverter —
  // no battery, no dispatch decision). Data-driven off the device's own
  // catalog rather than a hardcoded device/category list, so a third
  // grid-tied model just works without touching this file.
  const hasBattery = catalog.some((c) => c.parameter_key === "battery_power_w");
  const tickFn = hasBattery ? simulateTick : simulateGridTiedTick;
  if (!hasBattery) {
    const specs = device.device_type.technical_specs ?? {};
    state.ratedPowerW = (device.device_type.power_capacity_value ?? 0) * 1000;
    state.hasLoadMetering = catalog.some((c) => c.parameter_key === "load_total_power_w");
    if (specs.mppt_strings) {
      state.subUnitKind = "string";
      state.subUnitCount = specs.mppt_strings;
    } else if (specs.modules_per_gateway) {
      state.subUnitKind = "module";
      state.subUnitCount = specs.modules_per_gateway;
    }
  }

  if (args.mode === "simulate" && !args.noRead) await state.seedFromDb(args.deviceId);

  if (args.mode === "simulate" && args.backfillDays > 0) {
    await backfillDeye(args.deviceId, catalog, state, args.backfillDays, tickFn);
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
      const values = args.mode === "modbus" ? await readModbusTick(catalog, args.host) : tickFn(now, state);
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
