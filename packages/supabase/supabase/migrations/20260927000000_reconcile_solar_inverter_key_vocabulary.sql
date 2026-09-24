-- The Deye register-map Excel seed (20260924000200) and the actual
-- simulator (D:\Manoj-Waytara\inverter & ev simulation script, and
-- deye-modbus-agent.mjs's own --mode=simulate) were built independently
-- and disagree on 12 instrument_key names for the same real signals —
-- e.g. the seed says grid_total_power_w, the live simulator has always
-- written grid_power_w. Confirmed by grep that nothing in the app
-- currently references the seed's names at all, so renaming the DB rows
-- (not the already-live app/simulator vocabulary) is pure addition of
-- correctness with zero risk to already-shipped UI.
--
-- ON UPDATE CASCADE added to device_parameter_map's FK (alongside the
-- existing ON DELETE RESTRICT from 20260925010000) so the rename below
-- propagates automatically instead of needing a manual two-table dance.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'waytara.device_parameter_map'::regclass
      and confrelid = 'waytara.instrument_catalog'::regclass
      and contype = 'f'
  loop
    execute format('alter table waytara.device_parameter_map drop constraint %I', c.conname);
  end loop;
end $$;

alter table waytara.device_parameter_map
  add constraint device_parameter_map_instrument_key_fkey
  foreign key (instrument_key) references waytara.instrument_catalog(instrument_key)
  on delete restrict on update cascade;

update waytara.instrument_catalog set instrument_key = 'grid_power_w' where instrument_key = 'grid_total_power_w';
update waytara.instrument_catalog set instrument_key = 'load_power_w' where instrument_key = 'load_total_power_w';
update waytara.instrument_catalog set instrument_key = 'grid_current_a' where instrument_key = 'grid_l1_current_a';
update waytara.instrument_catalog set instrument_key = 'solar_energy_today_kwh' where instrument_key = 'day_pv_energy_kwh';
update waytara.instrument_catalog set instrument_key = 'grid_buy_energy_today_kwh' where instrument_key = 'day_grid_import_kwh';
update waytara.instrument_catalog set instrument_key = 'grid_sell_energy_today_kwh' where instrument_key = 'day_grid_export_kwh';
update waytara.instrument_catalog set instrument_key = 'load_energy_today_kwh' where instrument_key = 'day_load_energy_kwh';
update waytara.instrument_catalog set instrument_key = 'battery_charge_limit_current_a' where instrument_key = 'bms_charge_current_limit_a';
update waytara.instrument_catalog set instrument_key = 'battery_discharge_limit_current_a' where instrument_key = 'bms_discharge_current_limit_a';
update waytara.instrument_catalog set instrument_key = 'battery_charging_voltage_v' where instrument_key = 'bms_charge_voltage_v';
update waytara.instrument_catalog set instrument_key = 'bat1_soc_pct' where instrument_key = 'bms_soc_pct';
update waytara.instrument_catalog set instrument_key = 'environment_temp_c' where instrument_key = 'ambient_temp_c';
