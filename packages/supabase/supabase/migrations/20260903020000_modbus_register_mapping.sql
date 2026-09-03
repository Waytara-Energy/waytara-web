-- Modbus register mapping for the real Deye SUN-8K-SG05LP1-EU hardware
-- (RS485 -> Waveshare gateway -> Modbus TCP), sourced from Deye's official
-- manual + the kellerza/sunsynk open-source register map, both scoped to
-- this exact single-phase model. `modbus_register` is JSONB so the mapping
-- is data the read/write scripts consume directly, not something
-- hardcoded in yet another place:
--   { "registers": [N] | [N,M], "scale": number, "signed": boolean }
--   { "registers": [N], "bitmask": "0x..", "shift": number }   -- packed field
--   { "fields": { "<subKey>": { same shape as above } } }      -- compound (TOU slots)
--
-- Only instrument keys with a confirmed register in the docs are included
-- (explicit product decision this session) — `essential_load_pct` is
-- dropped for exactly that reason: the docs only give a derived Watts
-- formula, not a percentage register.
--
-- Read side (device_type_instruments): 6 existing keys renamed to match
-- the docs' own naming more precisely (ac_output_power_w -> inverter_power_w
-- etc.), plus a 7th (day_load_kwh -> load_energy_today_kwh) for naming
-- consistency with the other "_energy_today_kwh" siblings — 22 existing
-- keys keep their name and just gain a register, and ~34 new rows cover
-- everything else the docs confirm as readable for this model.
--
-- Write side (device_settings): no renames — every existing setting key
-- already had a confirmed register (instrument-settings-catalog.ts was
-- deliberately scoped to exactly that list) — this only adds the column
-- and backfills it on every existing row.

ALTER TABLE waytara.device_type_instruments ADD COLUMN modbus_register jsonb;
ALTER TABLE waytara.device_settings ADD COLUMN modbus_register jsonb;

-- ============================================================
-- READ SIDE — device_type_instruments (solar_inverter)
-- ============================================================

-- Rename + register (7 keys)
UPDATE waytara.device_type_instruments dti
SET instrument_key = v.new_key,
    instrument_name = v.new_name,
    modbus_register = v.register::jsonb
FROM (VALUES
  ('ac_output_power_w', 'inverter_power_w', 'Inverter Power', '{"registers":[175],"scale":1,"signed":true}'),
  ('daily_yield_kwh', 'solar_energy_today_kwh', 'Solar Energy Today', '{"registers":[108],"scale":0.1,"signed":false}'),
  ('dc_transformer_temp_c', 'inverter_dc_temp_c', 'Inverter DC Temperature', '{"registers":[90],"scale":0.1,"signed":false}'),
  ('radiator_temp_c', 'inverter_ac_temp_c', 'Inverter AC Temperature', '{"registers":[91],"scale":0.1,"signed":false}'),
  ('day_grid_import_kwh', 'grid_buy_energy_today_kwh', 'Grid Buy Energy Today', '{"registers":[76],"scale":0.1,"signed":false}'),
  ('day_grid_export_kwh', 'grid_sell_energy_today_kwh', 'Grid Sell Energy Today', '{"registers":[77],"scale":0.1,"signed":false}'),
  ('day_load_kwh', 'load_energy_today_kwh', 'Load Energy Today', '{"registers":[84],"scale":0.1,"signed":false}')
) AS v(old_key, new_key, new_name, register)
WHERE dti.instrument_key = v.old_key
  AND dti.device_type_id = 'ac398ad4-723c-487b-9d54-5912401de0d9';

-- Drop essential_load_pct — no confirmed register (derived-only per the docs)
DELETE FROM waytara.device_type_instruments
WHERE instrument_key = 'essential_load_pct'
  AND device_type_id = 'ac398ad4-723c-487b-9d54-5912401de0d9';

-- Register the 22 existing keys that keep their name
UPDATE waytara.device_type_instruments dti
SET modbus_register = v.register::jsonb
FROM (VALUES
  ('battery_power_w', '{"registers":[190],"scale":1,"signed":true}'),
  ('battery_temp_c', '{"registers":[182],"scale":0.1,"signed":false}'),
  ('battery_cycle_count', '{"registers":[611],"scale":1,"signed":false}'),
  ('battery_soc_pct', '{"registers":[184],"scale":1,"signed":false}'),
  ('battery_voltage_v', '{"registers":[183],"scale":0.01,"signed":false}'),
  ('grid_connected', '{"registers":[194],"scale":1,"signed":false}'),
  ('grid_frequency_hz', '{"registers":[79],"scale":0.01,"signed":false}'),
  ('grid_power_w', '{"registers":[169],"scale":1,"signed":true}'),
  ('grid_voltage_v', '{"registers":[150],"scale":0.1,"signed":false}'),
  ('pv1_voltage_v', '{"registers":[109],"scale":0.1,"signed":false}'),
  ('pv1_current_a', '{"registers":[110],"scale":0.1,"signed":false}'),
  ('pv1_power_w', '{"registers":[186],"scale":1,"signed":true}'),
  ('pv2_voltage_v', '{"registers":[111],"scale":0.1,"signed":false}'),
  ('pv2_current_a', '{"registers":[112],"scale":0.1,"signed":false}'),
  ('pv2_power_w', '{"registers":[187],"scale":1,"signed":true}'),
  ('load_power_w', '{"registers":[178],"scale":1,"signed":true}'),
  ('inverter_state', '{"registers":[59],"scale":1,"signed":false}'),
  ('active_fault_code', '{"registers":[103,104,105,106],"scale":1,"signed":false,"combine":"first_nonzero"}'),
  ('day_battery_charge_kwh', '{"registers":[70],"scale":0.1,"signed":false}'),
  ('day_battery_discharge_kwh', '{"registers":[71],"scale":0.1,"signed":false}'),
  ('total_pv_energy_kwh', '{"registers":[96,97],"scale":0.1,"signed":false}'),
  ('sd_status', '{"registers":[92],"scale":1,"signed":false}')
) AS v(instrument_key, register)
WHERE dti.instrument_key = v.instrument_key
  AND dti.device_type_id = 'ac398ad4-723c-487b-9d54-5912401de0d9';

-- New rows (34) — everything else the docs confirm as readable
INSERT INTO waytara.device_type_instruments (device_type_id, instrument_key, instrument_name, category, unit, is_required, modbus_register)
VALUES
  -- battery (5 new)
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'battery_current_a', 'Battery Current', 'battery', 'A', false, '{"registers":[191],"scale":0.01,"signed":true}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'battery_charge_limit_current_a', 'Battery Charge Limit Current', 'battery', 'A', false, '{"registers":[314],"scale":1,"signed":true}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'battery_discharge_limit_current_a', 'Battery Discharge Limit Current', 'battery', 'A', false, '{"registers":[315],"scale":1,"signed":true}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'battery_charging_voltage_v', 'Battery Charging Voltage', 'battery', 'V', false, '{"registers":[312],"scale":0.01,"signed":false}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'bat1_soc_pct', 'Battery Pack 1 SOC', 'battery', '%', false, '{"registers":[603],"scale":1,"signed":false}'),

  -- inverter (4 new)
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'inverter_voltage_v', 'Inverter Voltage', 'inverter', 'V', false, '{"registers":[154],"scale":0.1,"signed":false}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'inverter_current_a', 'Inverter Current', 'inverter', 'A', false, '{"registers":[164],"scale":0.01,"signed":false}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'inverter_frequency_hz', 'Inverter Frequency', 'inverter', 'Hz', false, '{"registers":[193],"scale":0.01,"signed":false}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'environment_temp_c', 'Environment Temperature', 'inverter', '°C', false, '{"registers":[95],"scale":0.1,"signed":false}'),

  -- grid (4 new)
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'grid_ld_power_w', 'Grid LD Power', 'grid', 'W', false, '{"registers":[167],"scale":1,"signed":true}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'grid_l2_power_w', 'Grid L2 Power', 'grid', 'W', false, '{"registers":[168],"scale":1,"signed":true}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'grid_current_a', 'Grid Current', 'grid', 'A', false, '{"registers":[160,161],"scale":0.01,"signed":false,"note":"doc unclear how the two registers combine"}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'grid_ct_power_w', 'Grid CT Power', 'grid', 'W', false, '{"registers":[172],"scale":1,"signed":true}'),

  -- load (3 new)
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'load_l1_power_w', 'Load L1 Power', 'load', 'W', false, '{"registers":[176],"scale":1,"signed":true}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'load_l2_power_w', 'Load L2 Power', 'load', 'W', false, '{"registers":[177],"scale":1,"signed":true}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'load_frequency_hz', 'Load Frequency', 'load', 'Hz', false, '{"registers":[192],"scale":0.01,"signed":false}'),

  -- gen (3 new)
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'aux_power_w', 'AUX / Generator Power', 'gen', 'W', false, '{"registers":[166],"scale":1,"signed":true}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'aux_voltage_v', 'AUX / Generator Voltage', 'gen', 'V', false, '{"registers":[181],"scale":0.1,"signed":false}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'aux_frequency_hz', 'AUX / Generator Frequency', 'gen', 'Hz', false, '{"registers":[196],"scale":0.1,"signed":false}'),

  -- system (1 new)
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'rated_power_w', 'Rated Power', 'system', 'W', false, '{"registers":[16,17],"scale":0.1,"signed":false}'),

  -- energy_today (2 new)
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'day_active_energy_kwh', 'Day Active Energy', 'energy_today', 'kWh', false, '{"registers":[60],"scale":0.1,"signed":true}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'day_reactive_energy_kvarh', 'Day Reactive Energy', 'energy_today', 'kVarh', false, '{"registers":[61],"scale":0.1,"signed":true}'),

  -- energy_month (3 new)
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'month_grid_energy_kwh', 'Month Grid Energy', 'energy_month', 'kWh', false, '{"registers":[67],"scale":0.1,"signed":false}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'month_load_energy_kwh', 'Month Load Energy', 'energy_month', 'kWh', false, '{"registers":[66],"scale":0.1,"signed":false}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'month_pv_energy_kwh', 'Month PV Energy', 'energy_month', 'kWh', false, '{"registers":[65],"scale":0.1,"signed":false}'),

  -- energy_year (3 new)
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'year_grid_export_kwh', 'Year Grid Export Energy', 'energy_year', 'kWh', false, '{"registers":[98,99],"scale":0.1,"signed":false}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'year_load_energy_kwh', 'Year Load Energy', 'energy_year', 'kWh', false, '{"registers":[87,88],"scale":0.1,"signed":false}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'year_pv_energy_kwh', 'Year PV Energy', 'energy_year', 'kWh', false, '{"registers":[68,69],"scale":0.1,"signed":false}'),

  -- energy_total (6 new)
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'total_active_energy_kwh', 'Total Active Energy', 'energy_total', 'kWh', false, '{"registers":[63,64],"scale":0.1,"signed":true,"note":"sign unconfirmed per doc"}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'total_battery_charge_kwh', 'Total Battery Charge Energy', 'energy_total', 'kWh', false, '{"registers":[72,73],"scale":0.1,"signed":false}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'total_battery_discharge_kwh', 'Total Battery Discharge Energy', 'energy_total', 'kWh', false, '{"registers":[74,75],"scale":0.1,"signed":false}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'total_grid_export_kwh', 'Total Grid Export Energy', 'energy_total', 'kWh', false, '{"registers":[81,82],"scale":0.1,"signed":false}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'total_grid_import_kwh', 'Total Grid Import Energy', 'energy_total', 'kWh', false, '{"registers":[78,80],"scale":0.1,"signed":false,"note":"register gap [78,80] not [78,79] per doc, not a typo"}'),
  ('ac398ad4-723c-487b-9d54-5912401de0d9', 'total_load_energy_kwh', 'Total Load Energy', 'energy_total', 'kWh', false, '{"registers":[85,86],"scale":0.1,"signed":false}');

-- ============================================================
-- WRITE SIDE — device_settings (backfill every existing row; no renames)
-- ============================================================

UPDATE waytara.device_settings ds
SET modbus_register = v.register::jsonb
FROM (VALUES
  -- basic
  ('basic', 'beep_enabled', '{"registers":[228],"bitmask":"0x0C"}'),
  ('basic', 'auto_dim_enabled', '{"registers":[228],"bitmask":"0xC0"}'),
  ('basic', 'time_sync_enabled', '{"registers":[228],"bitmask":"0x03"}'),
  ('basic', 'inverter_enabled', '{"registers":[43],"scale":1,"signed":false}'),
  -- battery
  ('battery', 'max_charge_current_a', '{"registers":[210],"scale":1,"signed":false}'),
  ('battery', 'max_discharge_current_a', '{"registers":[211],"scale":1,"signed":false}'),
  ('battery', 'equalization_voltage_v', '{"registers":[201],"scale":0.01,"signed":false}'),
  ('battery', 'absorption_voltage_v', '{"registers":[202],"scale":0.01,"signed":false}'),
  ('battery', 'float_voltage_v', '{"registers":[203],"scale":0.01,"signed":false}'),
  ('battery', 'shutdown_capacity_pct', '{"registers":[217],"scale":1,"signed":false}'),
  ('battery', 'low_capacity_pct', '{"registers":[219],"scale":1,"signed":false}'),
  ('battery', 'restart_capacity_pct', '{"registers":[218],"scale":1,"signed":false}'),
  ('battery', 'shutdown_voltage_v', '{"registers":[220],"scale":0.01,"signed":false}'),
  ('battery', 'low_voltage_v', '{"registers":[222],"scale":0.01,"signed":false}'),
  ('battery', 'restart_voltage_v', '{"registers":[221],"scale":0.01,"signed":false}'),
  ('battery', 'grid_charge_current_a', '{"registers":[230],"scale":1,"signed":false}'),
  ('battery', 'grid_charge_enabled', '{"registers":[232],"bitmask":"0x01"}'),
  ('battery', 'bms_protocol', '{"registers":[325],"scale":1,"signed":false,"note":"app value is an enum string, needs enum->code table"}'),
  -- system_work_mode
  ('system_work_mode', 'max_solar_power_w', '{"registers":[53],"scale":1,"signed":false}'),
  ('system_work_mode', 'max_sell_power_w', '{"registers":[245],"scale":1,"signed":false}'),
  ('system_work_mode', 'solar_export_enabled', '{"registers":[247],"bitmask":"0x01"}'),
  ('system_work_mode', 'load_limit_w', '{"registers":[244],"scale":1,"signed":false}'),
  ('system_work_mode', 'priority_load_enabled', '{"registers":[243],"bitmask":"0x01"}'),
  ('system_work_mode', 'peak_shaving_power_w', '{"registers":[280],"bitmask":"0x0F"}'),
  ('system_work_mode', 'use_timer_enabled', '{"registers":[248],"bitmask":"0x01"}'),
  -- gen
  ('gen', 'gen_port_usage', '{"registers":[235],"scale":1,"signed":false,"note":"app value is an enum string, needs enum->code table"}'),
  ('gen', 'gen_peak_shaving_enabled', '{"registers":[280],"bitmask":"0xF0"}'),
  ('gen', 'gen_peak_shaving_power_w', '{"registers":[292],"scale":1,"signed":false}'),
  -- grid
  ('grid', 'grid_always_on_enabled', '{"registers":[280],"bitmask":"0xF000"}'),
  ('grid', 'grid_trickle_feed_power_w', '{"registers":[206],"scale":1,"signed":true}'),
  -- time-of-use (one JSON blob per slot; `fields` maps each JSON sub-key to its own register)
  ('system_work_mode', 'tou_prog1', '{"fields":{"startTime":{"registers":[250]},"powerW":{"registers":[256]},"capacityPct":{"registers":[268]},"voltageV":{"registers":[262],"scale":0.01},"charge":{"registers":[274],"bitmask":"0x03"},"mode":{"registers":[274],"bitmask":"0x1C"},"gridSellEnabled":{"registers":[274],"bitmask":"0x40"}}}'),
  ('system_work_mode', 'tou_prog2', '{"fields":{"startTime":{"registers":[251]},"powerW":{"registers":[257]},"capacityPct":{"registers":[269]},"voltageV":{"registers":[263],"scale":0.01},"charge":{"registers":[275],"bitmask":"0x03"},"mode":{"registers":[275],"bitmask":"0x1C"},"gridSellEnabled":{"registers":[275],"bitmask":"0x40"}}}'),
  ('system_work_mode', 'tou_prog3', '{"fields":{"startTime":{"registers":[252]},"powerW":{"registers":[258]},"capacityPct":{"registers":[270]},"voltageV":{"registers":[264],"scale":0.01},"charge":{"registers":[276],"bitmask":"0x03"},"mode":{"registers":[276],"bitmask":"0x1C"},"gridSellEnabled":{"registers":[276],"bitmask":"0x40"}}}'),
  ('system_work_mode', 'tou_prog4', '{"fields":{"startTime":{"registers":[253]},"powerW":{"registers":[259]},"capacityPct":{"registers":[271]},"voltageV":{"registers":[265],"scale":0.01},"charge":{"registers":[277],"bitmask":"0x03"},"mode":{"registers":[277],"bitmask":"0x1C"},"gridSellEnabled":{"registers":[277],"bitmask":"0x40"}}}'),
  ('system_work_mode', 'tou_prog5', '{"fields":{"startTime":{"registers":[254]},"powerW":{"registers":[260]},"capacityPct":{"registers":[272]},"voltageV":{"registers":[266],"scale":0.01},"charge":{"registers":[278],"bitmask":"0x03"},"mode":{"registers":[278],"bitmask":"0x1C"},"gridSellEnabled":{"registers":[278],"bitmask":"0x40"}}}'),
  ('system_work_mode', 'tou_prog6', '{"fields":{"startTime":{"registers":[255]},"powerW":{"registers":[261]},"capacityPct":{"registers":[273]},"voltageV":{"registers":[267],"scale":0.01},"charge":{"registers":[279],"bitmask":"0x03"},"mode":{"registers":[279],"bitmask":"0x1C"},"gridSellEnabled":{"registers":[279],"bitmask":"0x40"}}}')
) AS v(setting_category, setting_key, register)
WHERE ds.setting_category = v.setting_category
  AND ds.setting_key = v.setting_key;
