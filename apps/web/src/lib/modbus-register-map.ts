import "server-only";

/**
 * Write-side register map for `device_settings` — mirrors exactly what's
 * now backfilled onto every existing row in the DB (see the
 * `modbus_register_mapping` migration in packages/supabase), used here so
 * every *new* write from now on carries its register too, with no extra
 * round trip: the Modbus write listener gets everything it needs straight
 * off the `device_settings` row its realtime subscription just received.
 *
 * Source: Deye's official manual + the kellerza/sunsynk open-source
 * register map, both scoped to SUN-8K-SG05LP1-EU (single-phase). Every key
 * here already has a confirmed register — `instrument-settings-catalog.ts`
 * was deliberately scoped to exactly that "confirmed + safe to implement"
 * list, so there's nothing here without one.
 *
 * `[280]` is shared by 3 settings (peak_shaving 0x0F, gen_peak_shaving
 * 0xF0, grid_always_on 0xF000) and `[228]` by 3 more (time_sync/beep/
 * auto_dim) — a real write to any of these must read-modify-write the
 * whole register, never blind-write (see the write-registers doc's own
 * cross-cutting rule #2). `bms_protocol`/`gen_port_usage` are select
 * fields whose app-side string values need a separate enum->register-code
 * table in the write script — this map only carries the register address,
 * not that translation.
 */
export interface ModbusRegisterSpec {
  registers: number[];
  scale?: number;
  signed?: boolean;
  bitmask?: string;
  note?: string;
}

export interface ModbusFieldSpec {
  fields: Record<string, ModbusRegisterSpec>;
}

const REGISTER_MAP: Record<string, ModbusRegisterSpec> = {
  "basic:beep_enabled": { registers: [228], bitmask: "0x0C" },
  "basic:auto_dim_enabled": { registers: [228], bitmask: "0xC0" },
  "basic:time_sync_enabled": { registers: [228], bitmask: "0x03" },
  "basic:inverter_enabled": { registers: [43] },

  "battery:max_charge_current_a": { registers: [210] },
  "battery:max_discharge_current_a": { registers: [211] },
  "battery:equalization_voltage_v": { registers: [201], scale: 0.01 },
  "battery:absorption_voltage_v": { registers: [202], scale: 0.01 },
  "battery:float_voltage_v": { registers: [203], scale: 0.01 },
  "battery:shutdown_capacity_pct": { registers: [217] },
  "battery:low_capacity_pct": { registers: [219] },
  "battery:restart_capacity_pct": { registers: [218] },
  "battery:shutdown_voltage_v": { registers: [220], scale: 0.01 },
  "battery:low_voltage_v": { registers: [222], scale: 0.01 },
  "battery:restart_voltage_v": { registers: [221], scale: 0.01 },
  "battery:grid_charge_current_a": { registers: [230] },
  "battery:grid_charge_enabled": { registers: [232], bitmask: "0x01" },
  "battery:bms_protocol": { registers: [325], note: "enum string -> code table needed" },

  "system_work_mode:max_solar_power_w": { registers: [53] },
  "system_work_mode:max_sell_power_w": { registers: [245] },
  "system_work_mode:solar_export_enabled": { registers: [247], bitmask: "0x01" },
  "system_work_mode:load_limit_w": { registers: [244] },
  "system_work_mode:priority_load_enabled": { registers: [243], bitmask: "0x01" },
  "system_work_mode:peak_shaving_power_w": { registers: [280], bitmask: "0x0F" },
  "system_work_mode:use_timer_enabled": { registers: [248], bitmask: "0x01" },

  "gen:gen_port_usage": { registers: [235], note: "enum string -> code table needed" },
  "gen:gen_peak_shaving_enabled": { registers: [280], bitmask: "0xF0" },
  "gen:gen_peak_shaving_power_w": { registers: [292] },

  "grid:grid_always_on_enabled": { registers: [280], bitmask: "0xF000" },
  "grid:grid_trickle_feed_power_w": { registers: [206], signed: true },
};

const TOU_REGISTERS: [start: number[], power: number[], capacity: number[], voltage: number[], packed: number[]] = [
  [250, 251, 252, 253, 254, 255],
  [256, 257, 258, 259, 260, 261],
  [268, 269, 270, 271, 272, 273],
  [262, 263, 264, 265, 266, 267],
  [274, 275, 276, 277, 278, 279],
];

/** Prog1..6's own register spec — the 6 slots share the same shape, just
 *  shifted by one register per slot (see the write-registers doc's Time
 *  of Use table), so this is generated rather than hand-repeated 6 times. */
function touRegisterSpec(slotIndex: number): ModbusFieldSpec {
  const i = slotIndex - 1;
  const [start, power, capacity, voltage, packed] = TOU_REGISTERS;
  return {
    fields: {
      startTime: { registers: [start[i]] },
      powerW: { registers: [power[i]] },
      capacityPct: { registers: [capacity[i]] },
      voltageV: { registers: [voltage[i]], scale: 0.01 },
      charge: { registers: [packed[i]], bitmask: "0x03" },
      mode: { registers: [packed[i]], bitmask: "0x1C" },
      gridSellEnabled: { registers: [packed[i]], bitmask: "0x40" },
    },
  };
}

/** Looks up the register spec for a `device_settings` write. Returns null
 *  for anything not in the confirmed-register list (nothing should hit
 *  this in practice — the settings catalog is itself scoped to exactly
 *  what's confirmed — but a null is safer than throwing from a write path
 *  over an unexpected key). */
export function getModbusRegister(category: string, key: string): ModbusRegisterSpec | ModbusFieldSpec | null {
  const touMatch = /^tou_prog([1-6])$/.exec(key);
  if (touMatch) return touRegisterSpec(Number(touMatch[1]));

  return REGISTER_MAP[`${category}:${key}`] ?? null;
}
