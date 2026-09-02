-- Telemetry-driven dashboard, Phase 7: Overview/Monitoring/Performance/
-- Analytics/Maintenance all still only read `ac_output_power_w` and
-- `daily_yield_kwh` — nowhere near the energy-flow / PV-string / battery /
-- grid / temperature / fault picture the inverter's own LCD (and the
-- customer's read-register manual) actually reports. device_readings is
-- already a flexible EAV table (device_id, instrument_key, value, unit,
-- ts) — same shape used for every reading so far — so this is purely
-- additive `device_type_instruments` catalog rows, no schema change, no
-- new table. The external Node ingestion script (not part of this app)
-- is what will eventually write these instrument_keys; until it does,
-- every page reading them renders a clean empty/zero state, same as any
-- other not-yet-reported instrument today.
--
-- Sign conventions (documented again in telemetry-catalog.ts, the code
-- that actually interprets these):
--   battery_power_w: positive = charging, negative = discharging
--   grid_power_w:    positive = importing, negative = exporting
-- inverter_state: 0 = Normal, 1 = Standby, 2 = Fault (mirrors the LCD's
-- own three-state summary, [59] in the manual).
-- active_fault_code: 0 = none; a non-zero value is looked up against
-- deye-fault-codes.ts, not decoded here.
-- day_*_kwh: daily-reset running counters, identical shape to the
-- existing daily_yield_kwh (climbs through the day, resets each
-- morning) — reuses maxByDeviceDay/sumByDay unchanged.
-- total_pv_energy_kwh: lifetime, never resets.
-- essential_load_pct: the inverter's own essential-vs-total load split
-- (manual §7) — reported, not computed here.

insert into waytara.device_type_instruments (device_type_id, instrument_key, instrument_name, unit, category, is_required)
select id, instrument_key, instrument_name, unit, category, is_required
from waytara.device_types dt
cross join lateral (
  values
    -- solar: PV1 already existed (voltage/current); PV2 + power are new
    ('pv1_power_w', 'PV String 1 Power', 'W', 'solar', false),
    ('pv2_voltage_v', 'PV String 2 Voltage', 'V', 'solar', false),
    ('pv2_current_a', 'PV String 2 Current', 'A', 'solar', false),
    ('pv2_power_w', 'PV String 2 Power', 'W', 'solar', false),

    -- battery: solar_inverter is a hybrid inverter with its own battery
    -- port, so these live here too, not only on battery_storage devices
    ('battery_soc_pct', 'Battery State of Charge', '%', 'battery', false),
    ('battery_voltage_v', 'Battery Voltage', 'V', 'battery', false),
    ('battery_power_w', 'Battery Power', 'W', 'battery', false),
    ('battery_temp_c', 'Battery Temperature', '°C', 'battery', false),
    ('dc_transformer_temp_c', 'DC Transformer Temperature', '°C', 'battery', false),
    ('radiator_temp_c', 'Radiator Temperature', '°C', 'battery', false),
    ('battery_cycle_count', 'Battery Cycle Count', null, 'battery', false),

    -- grid
    ('grid_power_w', 'Grid Power', 'W', 'grid', false),
    ('grid_voltage_v', 'Grid Voltage', 'V', 'grid', false),
    ('grid_connected', 'Grid Connected', null, 'grid', false),

    -- system: load, overall state, faults, daily/lifetime energy totals
    ('load_power_w', 'Load Power', 'W', 'system', false),
    ('inverter_state', 'Inverter State', null, 'system', false),
    ('active_fault_code', 'Active Fault Code', null, 'system', false),
    ('day_grid_import_kwh', 'Grid Import (Today)', 'kWh', 'system', false),
    ('day_grid_export_kwh', 'Grid Export (Today)', 'kWh', 'system', false),
    ('day_battery_charge_kwh', 'Battery Charge (Today)', 'kWh', 'system', false),
    ('day_battery_discharge_kwh', 'Battery Discharge (Today)', 'kWh', 'system', false),
    ('day_load_kwh', 'Load Energy (Today)', 'kWh', 'system', false),
    ('total_pv_energy_kwh', 'Total PV Energy (Lifetime)', 'kWh', 'system', false),
    ('essential_load_pct', 'Essential Load Share', '%', 'system', false)
) as instruments(instrument_key, instrument_name, unit, category, is_required)
where dt.code = 'solar_inverter'
on conflict (device_type_id, instrument_key) do nothing;
