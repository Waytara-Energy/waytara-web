-- Renames the read-side register catalog table (device_type_instruments)
-- to device_parameters, and its instrument_key/instrument_name columns to
-- parameter_key/parameter_name — "parameter" is the term used consistently
-- elsewhere in this app (Instrument Settings' own SettingField catalog
-- already calls these "settings"/"fields", and the customer-facing copy
-- refers to "parameters"), so this aligns the DB with that vocabulary.
--
-- device_readings.instrument_key is a *different* column on a *different*
-- table (the actual telemetry values, not the catalog of what they mean)
-- and is deliberately NOT touched here — nothing about this rename changes
-- what a reading row looks like, only what the catalog row that describes
-- it is called.
alter table waytara.device_type_instruments rename to device_parameters;
alter table waytara.device_parameters rename column instrument_key to parameter_key;
alter table waytara.device_parameters rename column instrument_name to parameter_name;

-- Policy names follow the table's new identity, same shape as before
-- (policies stay attached across the rename by OID; renaming them here is
-- purely so `\dp`/pg_policies doesn't show a "device_type_instruments_*"
-- policy on a table called device_parameters).
drop policy if exists "device_type_instruments_staff_select" on waytara.device_parameters;
create policy "device_parameters_staff_select" on waytara.device_parameters
  for select
  using (waytara.is_staff());

drop policy if exists "device_type_instruments_customer_select" on waytara.device_parameters;
create policy "device_parameters_customer_select" on waytara.device_parameters
  for select
  using (true);

drop policy if exists "device_type_instruments_admin_write" on waytara.device_parameters;
create policy "device_parameters_admin_write" on waytara.device_parameters
  for all
  using (waytara.is_admin())
  with check (waytara.is_admin());
