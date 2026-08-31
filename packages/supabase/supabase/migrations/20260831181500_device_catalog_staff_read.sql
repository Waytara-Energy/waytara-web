-- Task 8.4: the employee's device-type picker came back completely empty
-- despite the catalog being seeded. Checked directly: RLS turned out to be
-- enabled on both device_types and device_type_instruments
-- (relrowsecurity = true) with zero policies — silently filtering every
-- row for every role except service_role. This contradicts the original
-- schema script, which only wrapped 13 tables in
-- `alter table ... enable row level security` and didn't include either
-- of these two — RLS must have been turned on afterward by some other
-- action. Whatever the cause, the fix is the same "admin-only write, staff
-- read" pattern the schema's own comment already called for on this
-- table pair — adding the read half now since it's what's actually
-- blocking this task; the write half is Task 11.3's concern once there's
-- a real catalog-editing UI to test it against.
--
-- Customers may eventually need read access too (Tasks 9/10, to show a
-- device type's display name on their own dashboard) — not added here,
-- out of scope for a staff-only pipeline screen; revisit when that's built.

drop policy if exists "device_types_staff_select" on waytara.device_types;
create policy "device_types_staff_select" on waytara.device_types
  for select
  using (waytara.is_staff());

drop policy if exists "device_type_instruments_staff_select" on waytara.device_type_instruments;
create policy "device_type_instruments_staff_select" on waytara.device_type_instruments
  for select
  using (waytara.is_staff());
