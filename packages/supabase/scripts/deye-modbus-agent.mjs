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
// straight from the DB (device_type_instruments for the read catalog,
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

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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
  const args = { mode: "simulate", deviceId: "bc58bbdb-59d9-4075-b45e-a8c327ecc9bd", host: null, readOnly: false, once: false, noRead: false };
  for (const arg of argv) {
    if (arg === "--read-only") args.readOnly = true;
    else if (arg === "--no-read") args.noRead = true;
    else if (arg === "--once") args.once = true;
    else if (arg.startsWith("--mode=")) args.mode = arg.slice("--mode=".length);
    else if (arg.startsWith("--device-id=")) args.deviceId = arg.slice("--device-id=".length);
    else if (arg.startsWith("--host=")) args.host = arg.slice("--host=".length);
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
    .from("devices")
    .select("id, label, device_uid, device_type:device_types(id, code, name)")
    .eq("id", deviceId)
    .maybeSingle();
  if (error || !device) throw new Error(`Device ${deviceId} not found: ${error?.message ?? "no row"}`);

  const { data: catalog, error: catalogError } = await supabase
    .from("device_type_instruments")
    .select("instrument_key, instrument_name, category, unit, modbus_register")
    .eq("device_type_id", device.device_type.id)
    .not("modbus_register", "is", null);
  if (catalogError) throw new Error(`Failed to load register catalog: ${catalogError.message}`);

  return { device, catalog: catalog ?? [] };
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
  const cloudNoise = 0.85 + Math.random() * 0.3;
  const solarW = df > 0 ? jitter(PEAK_SOLAR_W * df * cloudNoise, 0.05) : 0;
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
  const ambientTempC = jitter(18 + 10 * daylightFactor(hour), 0.05);
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
    // inverter
    inverter_power_w: round(solarW - loadW < 0 ? -Math.abs(solarW) : solarW),
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
    grid_ld_power_w: round(gridPowerW),
    grid_l2_power_w: 0, // single-phase unit — L2 doesn't carry load
    // load
    load_power_w: round(loadW),
    load_frequency_hz: round(loadFrequencyHz, 2),
    load_energy_today_kwh: round(state.dayLoadKwh, 2),
    load_l1_power_w: round(loadW), // single-phase — all load on L1
    load_l2_power_w: 0,
    // system / status
    inverter_state: 0,
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

async function insertReadings(deviceId, catalog, values, ts) {
  const unitByKey = new Map(catalog.map((c) => [c.instrument_key, c.unit]));
  const rows = Object.entries(values)
    .filter(([key]) => unitByKey.has(key) || catalog.some((c) => c.instrument_key === key))
    .map(([instrument_key, value]) => ({
      device_id: deviceId,
      instrument_key,
      value,
      unit: unitByKey.get(instrument_key) ?? null,
      ts,
      is_test: false,
    }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("device_readings").insert(rows);
  if (error) throw new Error(`insert @ ${ts} failed: ${error.message}`);
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
      values[entry.instrument_key] = combined * (spec.scale ?? 1);
    }
  } finally {
    client.close(() => {});
  }
  return values;
}

// ============================================================
// WRITE LISTENER — Realtime, dry-run only.
// ============================================================

function startWriteListener(deviceId) {
  const channel = supabase
    .channel(`deye-agent:device_settings:${deviceId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "waytara", table: "device_settings", filter: `device_id=eq.${deviceId}` },
      (payload) => {
        const row = payload.new;
        const spec = row.modbus_register;
        console.log(`\n[write] setting change requested: ${row.setting_category}.${row.setting_key} = ${row.setting_value}`);
        if (!spec) {
          console.log(`[write]   no modbus_register on this row — nothing to attempt.`);
          return;
        }
        if (spec.fields) {
          console.log(`[write]   compound field (${Object.keys(spec.fields).length} sub-registers):`);
          for (const [sub, subSpec] of Object.entries(spec.fields)) {
            console.log(`[write]     .${sub} -> register(s) [${subSpec.registers.join(",")}]${subSpec.bitmask ? ` bitmask ${subSpec.bitmask}` : ""}${subSpec.scale ? ` x${subSpec.scale}` : ""}`);
          }
        } else {
          console.log(
            `[write]   would write register(s) [${spec.registers.join(",")}]${spec.bitmask ? ` (bitmask ${spec.bitmask}, read-modify-write required)` : ""}${spec.scale ? ` scale x${spec.scale}` : ""}`
          );
        }
        // TODO: real Modbus write (client.writeRegister / read-modify-write
        // for bitmask fields) + insert a confirmation row back to Supabase
        // once the read side above has been verified against real
        // hardware. Deliberately dry-run only for now.
      }
    )
    .subscribe((status) => {
      console.log(`[write] realtime channel status: ${status}`);
    });
  return channel;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(`Deye Modbus agent — mode=${args.mode} device=${args.deviceId}${args.readOnly ? " (read-only)" : ""}`);

  const { device, catalog } = await loadDevice(args.deviceId);
  console.log(`Device: ${device.label ?? device.device_uid} (${device.device_type.name}) — ${catalog.length} registers cataloged`);

  const state = new SimState();
  if (args.mode === "simulate" && !args.noRead) await state.seedFromDb(args.deviceId);

  if (!args.readOnly) startWriteListener(args.deviceId);

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
