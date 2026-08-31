-- Task 8.4: site & device setup needs a device catalog to pick from —
-- device_types and device_type_instruments were both completely empty.
-- Seeding a reasonable first pass (Task 11.3's catalog editor is where
-- these get built out for real); "settings mirroring the deye_settings
-- sheet" in the schema's own comment on device_settings points at Deye as
-- the reference inverter brand, reflected in the solar_inverter row below.
--
-- Note: device_types / device_type_instruments were never wrapped in
-- `enable row level security` at all in the original schema (unlike every
-- other table) — the author's own comment flagged this as a known gap
-- ("Repeat the 'admin-only write' pattern for device_types,
-- device_type_instruments, and employee_invites"). Left alone here:
-- there's no write UI for this catalog yet (that's Task 11.3), so there's
-- nothing to test the restriction against yet, and tightening it
-- prematurely without a builder to verify against isn't worth the risk of
-- getting the policy wrong unverified. Revisit when Task 11.3 lands.

insert into waytara.device_types (code, name, manufacturer, description)
values
  ('solar_inverter', 'Solar Inverter', 'Deye', 'Grid-tied / hybrid string inverter converting PV DC to AC.'),
  ('battery_storage', 'Battery Storage (BESS)', 'Deye', 'LiFePO4 battery bank for backup and self-consumption.'),
  ('ev_charger', 'EV Charger', 'WayTara', 'AC EV charging point for residential or fleet depot use.'),
  ('grid_meter', 'Bi-Directional Grid Meter', 'Generic', 'Net meter recording import/export against the DISCOM grid.')
on conflict (code) do nothing;

insert into waytara.device_type_instruments (device_type_id, instrument_key, instrument_name, unit, category, is_required)
select id, instrument_key, instrument_name, unit, category, is_required
from waytara.device_types dt
cross join lateral (
  values
    ('pv1_voltage_v', 'PV String 1 Voltage', 'V', 'solar', true),
    ('pv1_current_a', 'PV String 1 Current', 'A', 'solar', true),
    ('ac_output_power_w', 'AC Output Power', 'W', 'solar', true),
    ('daily_yield_kwh', 'Daily Yield', 'kWh', 'solar', false),
    ('grid_frequency_hz', 'Grid Frequency', 'Hz', 'grid', false)
) as instruments(instrument_key, instrument_name, unit, category, is_required)
where dt.code = 'solar_inverter'
on conflict (device_type_id, instrument_key) do nothing;

insert into waytara.device_type_instruments (device_type_id, instrument_key, instrument_name, unit, category, is_required)
select id, instrument_key, instrument_name, unit, category, is_required
from waytara.device_types dt
cross join lateral (
  values
    ('battery_soc_pct', 'State of Charge', '%', 'battery', true),
    ('battery_voltage_v', 'Battery Voltage', 'V', 'battery', true),
    ('charge_power_w', 'Charge Power', 'W', 'battery', false),
    ('discharge_power_w', 'Discharge Power', 'W', 'battery', false),
    ('cell_temp_c', 'Cell Temperature', '°C', 'battery', false)
) as instruments(instrument_key, instrument_name, unit, category, is_required)
where dt.code = 'battery_storage'
on conflict (device_type_id, instrument_key) do nothing;

insert into waytara.device_type_instruments (device_type_id, instrument_key, instrument_name, unit, category, is_required)
select id, instrument_key, instrument_name, unit, category, is_required
from waytara.device_types dt
cross join lateral (
  values
    ('charging_power_kw', 'Charging Power', 'kW', 'ev', true),
    ('session_energy_kwh', 'Session Energy', 'kWh', 'ev', false),
    ('connector_status', 'Connector Status', null, 'ev', true)
) as instruments(instrument_key, instrument_name, unit, category, is_required)
where dt.code = 'ev_charger'
on conflict (device_type_id, instrument_key) do nothing;

insert into waytara.device_type_instruments (device_type_id, instrument_key, instrument_name, unit, category, is_required)
select id, instrument_key, instrument_name, unit, category, is_required
from waytara.device_types dt
cross join lateral (
  values
    ('import_energy_kwh', 'Grid Import (Cumulative)', 'kWh', 'grid', true),
    ('export_energy_kwh', 'Grid Export (Cumulative)', 'kWh', 'grid', true),
    ('grid_voltage_v', 'Grid Voltage', 'V', 'grid', false)
) as instruments(instrument_key, instrument_name, unit, category, is_required)
where dt.code = 'grid_meter'
on conflict (device_type_id, instrument_key) do nothing;

-- Task 8.4: sites/devices had SELECT policies for all three viewer types
-- but no INSERT/UPDATE at all — same gap shape as every other write path
-- so far. Scoped through customer_onboarding.employee_id, matching the
-- existing sites_employee_assigned / devices_employee_assigned SELECT
-- policies' approach.

drop policy if exists "sites_admin_insert" on waytara.sites;
create policy "sites_admin_insert" on waytara.sites
  for insert
  with check (waytara.is_admin());

drop policy if exists "sites_employee_insert_assigned" on waytara.sites;
create policy "sites_employee_insert_assigned" on waytara.sites
  for insert
  with check (
    exists (
      select 1 from waytara.customer_onboarding co
      where co.customer_id = sites.customer_id and co.employee_id = auth.uid()
    )
  );

drop policy if exists "sites_admin_update" on waytara.sites;
create policy "sites_admin_update" on waytara.sites
  for update
  using (waytara.is_admin())
  with check (waytara.is_admin());

drop policy if exists "sites_employee_update_assigned" on waytara.sites;
create policy "sites_employee_update_assigned" on waytara.sites
  for update
  using (
    exists (
      select 1 from waytara.customer_onboarding co
      where co.customer_id = sites.customer_id and co.employee_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from waytara.customer_onboarding co
      where co.customer_id = sites.customer_id and co.employee_id = auth.uid()
    )
  );

drop policy if exists "devices_admin_insert" on waytara.devices;
create policy "devices_admin_insert" on waytara.devices
  for insert
  with check (waytara.is_admin());

drop policy if exists "devices_employee_insert_assigned" on waytara.devices;
create policy "devices_employee_insert_assigned" on waytara.devices
  for insert
  with check (
    exists (
      select 1 from waytara.sites s
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where s.id = devices.site_id and co.employee_id = auth.uid()
    )
  );

drop policy if exists "devices_admin_update" on waytara.devices;
create policy "devices_admin_update" on waytara.devices
  for update
  using (waytara.is_admin())
  with check (waytara.is_admin());

drop policy if exists "devices_employee_update_assigned" on waytara.devices;
create policy "devices_employee_update_assigned" on waytara.devices
  for update
  using (
    exists (
      select 1 from waytara.sites s
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where s.id = devices.site_id and co.employee_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from waytara.sites s
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where s.id = devices.site_id and co.employee_id = auth.uid()
    )
  );
