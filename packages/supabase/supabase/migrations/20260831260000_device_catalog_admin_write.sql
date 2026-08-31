-- Task 11.3 (device/instrument catalog editor): device_types and
-- device_type_instruments have had staff/customer SELECT since Task 8.4's
-- seed migration, which explicitly flagged this as pending — "there's no
-- write UI for this catalog yet (that's Task 11.3)". This is that write
-- path: admin-only, matching plans_write_admin's shape.

drop policy if exists "device_types_admin_write" on waytara.device_types;
create policy "device_types_admin_write" on waytara.device_types
  for all
  using (waytara.is_admin())
  with check (waytara.is_admin());

drop policy if exists "device_type_instruments_admin_write" on waytara.device_type_instruments;
create policy "device_type_instruments_admin_write" on waytara.device_type_instruments
  for all
  using (waytara.is_admin())
  with check (waytara.is_admin());
