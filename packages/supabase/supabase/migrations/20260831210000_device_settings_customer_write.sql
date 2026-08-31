-- Task 10.5 (Application & instrument settings) needs the customer to be
-- able to change their own devices' instrument settings — device_settings
-- had SELECT-only policies (settings_owner/settings_employee_assigned/
-- settings_admin_all), same gap shape as every other table this session:
-- read wired up, write never was.
--
-- device_settings is an append-only change log, not a mutable "current
-- value" row (id, device_id, setting_key, setting_value, ts, written_by —
-- no updated_at, no unique constraint on (device_id, setting_key)),
-- mirroring device_readings' shape. So "changing a setting" is an INSERT
-- of a new row with ts = now(); the current value is derived as the
-- latest row per (device_id, setting_key), same pattern the dashboard
-- already uses for device_readings. No UPDATE/DELETE policy needed.
--
-- Scoped to the customer's own devices (via devices -> sites ->
-- customer_id, same shape as settings_owner's SELECT policy) and
-- `written_by` restricted to null or the customer's own id — stops a
-- customer attributing a settings change to someone else in the log.
-- Employee/admin write access (e.g. for Task 8.4's staff-side device
-- setup) isn't opened here — out of this task's scope, add its own
-- policy when a builder exists to verify it against.

drop policy if exists "settings_owner_insert" on waytara.device_settings;
create policy "settings_owner_insert" on waytara.device_settings
  for insert
  with check (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      where d.id = device_settings.device_id and s.customer_id = auth.uid()
    )
    and (written_by is null or written_by = auth.uid())
  );
