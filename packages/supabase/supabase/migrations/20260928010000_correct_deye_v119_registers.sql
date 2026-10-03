-- Corrects the Deye SUN-8K-SG01LP1-EU (single-phase hybrid) register map
-- against the real Deye "Modbus RTU Protocol V119" documentation the user
-- obtained from Deye support, rebuilt into deye-modbus-register-map-v119.xlsx
-- (13 sheets: per-device-type register tables, Enums, Bitfields,
-- Faults_Warnings). The original device_parameter_map/instrument_catalog
-- seed (20260924000200) was derived from an Excel doc that turned out to
-- have several real address/decode bugs, caught by diffing against this
-- new authoritative source. See the approved plan
-- (C:\Users\Admin\.claude\plans\logical-brewing-squirrel.md) for the full
-- register-by-register reasoning; this migration only carries the
-- "confirmed, safe to apply" findings — genuinely unresolved items
-- (fault-word bit-position mapping, the 312-323 read-vs-write question)
-- are deliberately left untouched.

-- ============================================================
-- 1a. Fix confirmed bugs
-- ============================================================

-- day_active_energy_kwh / day_reactive_energy_kvarh: confirmed S16 (signed)
-- in the source — decode was missing signed:true, so a net-negative day
-- silently decoded as a huge positive number.
update waytara.device_parameter_map
set decode = decode || '{"signed": true}'::jsonb,
    notes = 'v is S16; (v>=32768 ? v-65536 : v) * 0.1',
    verified = true
where instrument_key in ('day_active_energy_kwh', 'day_reactive_energy_kvarh')
  and stock_id = (select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU');

-- total_grid_import_kwh: confirmed U32, low word at register 78, high word
-- at register 80 (previously unmapped) — was decoded from register 78
-- alone, silently wrapping at 6553.5 kWh.
update waytara.device_parameter_map
set address = '{"registers": [78, 80]}'::jsonb,
    decode = '{"scale": 0.1, "combine": "low_high_word", "low_word_register": 78}'::jsonb,
    notes = '((high<<16) | v[78]) * 0.1 -- high word confirmed at register 80',
    verified = true
where instrument_key = 'total_grid_import_kwh'
  and stock_id = (select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU');

-- sd_status: was wrongly pointed at register 92 (which is actually half of
-- Total Generator Energy, see below) — real SD status is register 94, and
-- it's a real 2-value enum (1000/2000), not a small integer code.
update waytara.instrument_catalog
set value_kind = 'enum', enum_ref = 'sd_status'
where instrument_key = 'sd_status';

update waytara.device_parameter_map
set address = '{"registers": [94]}'::jsonb,
    notes = 'map[v] -- 1000=fault, 2000=normal',
    verified = true
where instrument_key = 'sd_status'
  and stock_id = (select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU');

insert into waytara.instrument_enum_values (enum_ref, code, label, notes) values
  ('sd_status', '1000', 'SD card fault', null),
  ('sd_status', '2000', 'Normal', null)
on conflict (enum_ref, code) do nothing;

-- environment_temp_c: registers 92/95 (where this was pointed) are
-- confirmed to be the low/high words of Total Generator Energy, not a
-- temperature — this device has no confirmed "ambient/environment"
-- temperature register at all (only DC-transformer/90, AC-radiator/91,
-- and BMS pack temp/319 are real). Removing the mapping, not the shared
-- instrument_catalog definition (other future models may have a real one)
-- — is_enabled-filtering already means this just stops appearing in the UI.
delete from waytara.device_parameter_map
where instrument_key = 'environment_temp_c'
  and stock_id = (select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU');

-- grid_standard: wrong register entirely. Register 284 is a *different*,
-- 5-value North-America-oriented enum (added below as grid_mode) — the
-- 22-entry EU/multi-region table we already have belongs at register 51
-- (confirmed in the source as ENUM:GridStandard51). Only the address
-- moves; the enum labels are untouched.
update waytara.device_parameter_map
set address = '{"registers": [51]}'::jsonb,
    verified = true
where instrument_key = 'grid_standard'
  and stock_id = (select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU');

-- function_switches / schedule_enable_days: full bit layout is now
-- confirmed (see Bitfields sheet) — updating the placeholder notes to the
-- real, confirmed field breakdown. Still stored as one raw number each
-- (bit-range decode isn't a register-codec.mjs capability yet), this is a
-- documentation-only fix.
update waytara.device_parameter_map
set notes = 'bits0-3: output voltage code (see grid_type for which table applies); bits4-7: gen peak-shaving enable; bits8-11: grid peak-shaving enable; bit12: on-grid always on; bit13: external relay; bit14: fault on lithium battery loss; bit15: DRM enable'
where instrument_key = 'function_switches'
  and stock_id = (select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU');

update waytara.device_parameter_map
set notes = 'bit0: TOU master enable; bits1-7: Monday..Sunday enable; bit8: work mode 3 (Spain)'
where instrument_key = 'schedule_enable_days'
  and stock_id = (select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU');

-- ============================================================
-- 1b / Part 2: add confirmed gaps — new instrument_catalog rows.
-- Includes the two phase/grid-configuration registers Part 2 of the plan
-- is built around (grid_type, power_class) alongside the rest.
-- ============================================================

insert into waytara.instrument_catalog
  (instrument_key, name, category, device_category, unit, description, value_kind,
   direction, min_role, regulated, cadence_seconds, enum_ref, valid_min, valid_max)
values
  ('total_gen_energy_kwh', 'Total Generator Energy', 'generator', 'solar_inverter', 'kWh', null, 'numeric', 'read', 'customer'::waytara.user_role, false, 30, null, null, null),
  ('warning_word_1', 'Warning Word 1', 'system', 'solar_inverter', null, 'Raw diagnostic mask — bit-level meaning not yet decomposed into named sub-fields', 'numeric', 'read', 'customer'::waytara.user_role, false, 30, null, null, null),
  ('warning_word_2', 'Warning Word 2', 'system', 'solar_inverter', null, 'Raw diagnostic mask — bit-level meaning not yet decomposed into named sub-fields', 'numeric', 'read', 'customer'::waytara.user_role, false, 30, null, null, null),
  ('bms_max_charge_current_a', 'BMS Max Charge Current', 'battery', 'solar_inverter', 'A', null, 'numeric', 'read', 'customer'::waytara.user_role, false, 30, null, null, null),
  ('bms_max_discharge_current_a', 'BMS Max Discharge Current', 'battery', 'solar_inverter', 'A', null, 'numeric', 'read', 'customer'::waytara.user_role, false, 30, null, null, null),
  ('bms_status_flags_2', 'BMS Status Flags 2', 'battery', 'solar_inverter', null, 'bit0: vacant; bit1: force-charge flag', 'numeric', 'read', 'customer'::waytara.user_role, false, 30, null, null, null),
  ('gen_relay_status', 'Generator Relay Status', 'generator', 'solar_inverter', null, 'bits0-3: relay state (0 open/1 closed/2 vacant/3 closed-and-running); bits4-7: switch signal; bits8-11: generation signal', 'numeric', 'read', 'customer'::waytara.user_role, false, 30, null, null, null),
  ('battery_status_flags', 'Battery Status', 'battery', 'solar_inverter', null, 'Raw diagnostic value — meaning beyond the name not documented in the source', 'numeric', 'read', 'customer'::waytara.user_role, false, 30, null, null, null),
  ('power_class', 'Rated Power Class', 'system', 'solar_inverter', null, 'Identifies the unit''s phase class independent of device_type', 'enum', 'read', 'admin'::waytara.user_role, false, 3600, 'power_class', null, null),
  ('mppt_count_and_phase_code', 'MPPT Count & Phase Code', 'system', 'solar_inverter', null, 'Packed value, range [1,8]/[1,3] — MPPT count and phase count, exact bit split not confirmed in the source', 'numeric', 'read', 'admin'::waytara.user_role, false, 3600, null, 1, 8),
  ('grid_type', 'Grid Type', 'grid', 'solar_inverter', null, 'Site''s configured electrical service — the authoritative phase/voltage-configuration setting', 'enum', 'write', 'site_engineer'::waytara.user_role, true, null, 'grid_type', 0, 3),
  ('grid_mode', 'Grid Mode', 'grid', 'solar_inverter', null, 'North-America-oriented grid certification mode — distinct from grid_standard (register 51)', 'enum', 'write', 'site_engineer'::waytara.user_role, true, null, 'grid_mode', 0, 4),
  ('solar_input_as_psu', 'Solar Input As PSU', 'solar', 'solar_inverter', null, null, 'enum', 'write', 'customer'::waytara.user_role, false, null, 'solar_input_as_psu', 0, 1),
  ('force_gen_as_load', 'Force Generator Port As Load', 'generator', 'solar_inverter', null, 'Requires gen_port_function = Smart load output', 'boolean', 'write', 'customer'::waytara.user_role, false, null, null, 0, 1),
  ('energy_management_mode', 'Energy Management Mode', 'system', 'solar_inverter', null, null, 'enum', 'write', 'customer'::waytara.user_role, false, null, 'energy_management_mode', 0, 1),
  ('external_ct_clamp_phase', 'External CT Clamp Phase', 'grid', 'solar_inverter', null, null, 'numeric', 'write', 'customer'::waytara.user_role, false, null, null, null, null),
  ('gen_connected_to_grid', 'Generator Connected To Grid Input', 'generator', 'solar_inverter', null, null, 'boolean', 'write', 'customer'::waytara.user_role, false, null, null, 0, 1);

insert into waytara.instrument_enum_values (enum_ref, code, label, notes) values
  ('power_class', '2', 'Single-phase inverter', null),
  ('power_class', '3', 'Three-phase inverter', null),
  ('power_class', '8', 'Single-phase storage inverter', 'This unit''s expected value'),
  ('grid_type', '0', 'Single-phase', null),
  ('grid_type', '1', 'Split-phase 120/240V', 'This unit''s configuration'),
  ('grid_type', '2', 'Three-phase 208V/120V', null),
  ('grid_type', '3', '120V single-phase', null),
  ('grid_mode', '0', 'General standard', null),
  ('grid_mode', '1', 'UL1741 & IEEE1547', null),
  ('grid_mode', '2', 'CPUC Rule 21', null),
  ('grid_mode', '3', 'SRD-UL1741', null),
  ('grid_mode', '4', 'CEI 0-21', null),
  ('solar_input_as_psu', '0', 'Solar', null),
  ('solar_input_as_psu', '1', 'PSU', null),
  ('energy_management_mode', '0', 'Battery priority', null),
  ('energy_management_mode', '1', 'Load priority', null)
on conflict (enum_ref, code) do nothing;

-- bms_protocol: was documented with only the single value ever observed on
-- this unit (code 0) — the source's LiProtocol table has 11 real named
-- codes, adding the other 10.
update waytara.instrument_enum_values
set label = 'General CAN (ZTE, Pylontech, DLN, Solax)'
where enum_ref = 'bms_protocol' and code = '0';

insert into waytara.instrument_enum_values (enum_ref, code, label, notes) values
  ('bms_protocol', '1', 'Tianbangda RS485 Modbus', null),
  ('bms_protocol', '2', 'KOK', null),
  ('bms_protocol', '3', 'Keith', null),
  ('bms_protocol', '4', 'Topai', null),
  ('bms_protocol', '5', 'Pylontech RS485', null),
  ('bms_protocol', '6', 'Jielisi RS485', null),
  ('bms_protocol', '7', 'Sunwoda RS485', null),
  ('bms_protocol', '8', 'Xinruineng RS485', null),
  ('bms_protocol', '9', 'Tianbangda RS485', null),
  ('bms_protocol', '10', 'Shenggao Electric CAN', null)
on conflict (enum_ref, code) do nothing;

-- Fault/warning code reference tables — pure reference data for now (not
-- wired to fault_word_1-4/warning_word_1-2's enum_ref, since which bit of
-- which word maps to which code is NOT defined anywhere in the source —
-- see the plan's own "still flagged" section). Ready to be wired up if
-- that bit mapping is ever confirmed against a live faulted unit.
insert into waytara.instrument_enum_values (enum_ref, code, label, notes) values
  ('warning_code', 'W01', 'Reserved', null),
  ('warning_code', 'W02', 'Fan warning', null),
  ('warning_code', 'W03', 'Grid phase wrong', null),
  ('warning_code', 'W04', 'Meter communication failure', null),
  ('fault_code', 'F07', 'DC/DC soft-start fault', 'Check battery fuse; restart; contact Deye if persistent'),
  ('fault_code', 'F10', 'Auxiliary power supply failure', 'Wait a few minutes; remove Wi-Fi/logger stick; contact Deye'),
  ('fault_code', 'F13', 'Working mode changed', 'Wait a minute; contact Deye if persistent'),
  ('fault_code', 'F17', 'Active battery hold', null),
  ('fault_code', 'F18', 'Hardware AC over-current', 'Check backup and normal load within range; restart; contact Deye'),
  ('fault_code', 'F20', 'Hardware DC over-current', 'Check PV and battery wiring; switch DC/AC off 1 min then on; contact Deye'),
  ('fault_code', 'F22', 'Emergency stop (inverter locked)', 'Contact Deye (rare)'),
  ('fault_code', 'F23', 'Transient AC leakage over-current', 'Check PV/inverter cabling; restart; contact Deye'),
  ('fault_code', 'F24', 'PV insulation resistance too low', 'Check PV connections; check PE/earth; contact Deye'),
  ('fault_code', 'F25', 'AC active battery fault', null),
  ('fault_code', 'F26', 'DC bus unbalanced', 'Wait; switch DC/AC off 1 min then on; contact Deye'),
  ('fault_code', 'F29', 'Parallel CAN bus fault', 'Check parallel settings and CAN wiring; contact Deye'),
  ('fault_code', 'F31', 'Soft start failed', null),
  ('fault_code', 'F35', 'No AC grid', 'Confirm grid; check grid wiring and breaker; contact Deye'),
  ('fault_code', 'F37', 'DC LLC software over-current', null),
  ('fault_code', 'F39', 'DC LLC over-current', null),
  ('fault_code', 'F40', 'Battery over-current', null),
  ('fault_code', 'F41', 'Parallel system stop (another unit faulted)', 'Check all units; record all fault codes; contact Deye'),
  ('fault_code', 'F42', 'AC line voltage too low', 'Check grid voltage within spec; check AC wiring; contact Deye'),
  ('fault_code', 'F46', 'Backup battery fault', 'Check capacity and battery wiring; reduce load; contact Deye'),
  ('fault_code', 'F47', 'AC over-frequency', 'Check grid frequency; check AC wiring; contact Deye'),
  ('fault_code', 'F48', 'AC under-frequency', 'Check grid frequency; check AC wiring; contact Deye'),
  ('fault_code', 'F49', 'Backup battery fault', 'Same as F46'),
  ('fault_code', 'F56', 'DC bus voltage too low (battery low)', 'Charge battery from PV/grid; contact Deye'),
  ('fault_code', 'F58', 'BMS communication fault', 'Check BMS cable and reg 325 protocol'),
  ('fault_code', 'F60', 'Generator voltage or frequency fault', null),
  ('fault_code', 'F61', 'Manually turned off by button', null),
  ('fault_code', 'F63', 'Arc fault (US only)', 'Check PV cabling; clear fault via reg 283 = 2; contact Deye'),
  ('fault_code', 'F64', 'Heat sink over-temperature', 'Check ambient temp; power off 10 min and restart; contact Deye')
on conflict (enum_ref, code) do nothing;

-- ============================================================
-- device_parameter_map rows for every new instrument_key above, scoped to
-- the real live stock.
-- ============================================================

insert into waytara.device_parameter_map
  (stock_id, instrument_key, protocol, address, decode, is_required, verified, notes)
values
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'total_gen_energy_kwh', 'modbus_tcp', '{"registers": [92, 95]}'::jsonb, '{"scale": 0.1, "combine": "low_high_word", "low_word_register": 92}'::jsonb, false, true, '((high<<16) | v[92]) * 0.1'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'warning_word_1', 'modbus_tcp', '{"registers": [101]}'::jsonb, '{"note": "raw diagnostic mask — bit-level meaning not yet decomposed into named sub-fields"}'::jsonb, false, true, '16 independent bits; report as word 1 bit N'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'warning_word_2', 'modbus_tcp', '{"registers": [102]}'::jsonb, '{"note": "raw diagnostic mask — bit-level meaning not yet decomposed into named sub-fields"}'::jsonb, false, true, '16 independent bits; report as word 2 bit N'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'bms_max_charge_current_a', 'modbus_tcp', '{"registers": [320]}'::jsonb, null, false, true, 'v'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'bms_max_discharge_current_a', 'modbus_tcp', '{"registers": [321]}'::jsonb, null, false, true, 'v'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'bms_status_flags_2', 'modbus_tcp', '{"registers": [324]}'::jsonb, '{"note": "raw diagnostic mask — bit0 vacant, bit1 force-charge flag"}'::jsonb, false, true, 'bit0: vacant; bit1: force-charge flag'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'gen_relay_status', 'modbus_tcp', '{"registers": [195]}'::jsonb, '{"note": "raw diagnostic mask — bits0-3 relay state, bits4-7 switch signal, bits8-11 generation signal"}'::jsonb, false, true, 'bits0-3: relay state; bits4-7: switch signal; bits8-11: generation signal'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'battery_status_flags', 'modbus_tcp', '{"registers": [185]}'::jsonb, null, false, false, 'v -- meaning not fully documented in source'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'power_class', 'modbus_tcp', '{"registers": [8]}'::jsonb, null, false, true, 'map[v]'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'mppt_count_and_phase_code', 'modbus_tcp', '{"registers": [18]}'::jsonb, null, false, false, 'v -- packed MPPT count / phase count, exact split unconfirmed'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'grid_type', 'modbus_tcp', '{"registers": [286]}'::jsonb, null, false, true, 'map[v]'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'grid_mode', 'modbus_tcp', '{"registers": [284]}'::jsonb, null, false, true, 'map[v]'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'solar_input_as_psu', 'modbus_tcp', '{"registers": [233]}'::jsonb, null, false, true, 'map[v]'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'force_gen_as_load', 'modbus_tcp', '{"registers": [234]}'::jsonb, null, false, true, '0=do not force, 1=force; requires register 235=1'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'energy_management_mode', 'modbus_tcp', '{"registers": [243]}'::jsonb, null, false, true, 'map[v]'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'external_ct_clamp_phase', 'modbus_tcp', '{"registers": [246]}'::jsonb, null, false, false, 'v'),
  ((select id from waytara.stock where model_number = 'SUN-8K-SG01LP1-EU'), 'gen_connected_to_grid', 'modbus_tcp', '{"registers": [291]}'::jsonb, null, false, true, '0/1 boolean');

-- ============================================================
-- Part 2 — phase-handling forward provisioning. Purely additive: no
-- device_parameter_map row is created for these on the existing
-- single/split-phase stock, so fetchReadKeys() never returns them and no
-- UI changes today. They exist so a future 3-phase model's onboarding is
-- a pure data change (device_parameter_map rows only), per the plan.
-- ============================================================

insert into waytara.instrument_catalog
  (instrument_key, name, category, device_category, unit, description, value_kind,
   direction, min_role, regulated, cadence_seconds, enum_ref, valid_min, valid_max)
values
  ('grid_l3_power_w', 'Grid L3 Power', 'grid', 'solar_inverter', 'W', null, 'numeric', 'read', 'customer'::waytara.user_role, false, 5, null, null, null),
  ('grid_l3_current_a', 'Grid L3 Current', 'grid', 'solar_inverter', 'A', null, 'numeric', 'read', 'customer'::waytara.user_role, false, 5, null, null, null),
  ('grid_l3_voltage_v', 'Grid L3 Voltage', 'grid', 'solar_inverter', 'V', null, 'numeric', 'read', 'customer'::waytara.user_role, false, 5, null, null, null),
  ('load_l3_power_w', 'Load L3 Power', 'load', 'solar_inverter', 'W', null, 'numeric', 'read', 'customer'::waytara.user_role, false, 5, null, null, null)
on conflict (instrument_key) do nothing;

-- Admin-UI convenience label only — never branched on by read/write
-- filtering logic (device_parameter_map row presence already does that
-- job). Backfilled for the real stock since we now know it from register
-- 286 (grid_type): 1 = split-phase, matching this unit.
alter table waytara.stock add column if not exists phase_count int;

update waytara.stock set phase_count = 2 where model_number = 'SUN-8K-SG01LP1-EU';
