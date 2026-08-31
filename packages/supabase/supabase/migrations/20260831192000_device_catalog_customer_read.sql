-- Task 9.3: the Sites/Devices page embeds device_types(name) to show a
-- device's type — came back null for a real customer session. Only staff
-- had read access (20260831181500) — flagged at the time as "customers may
-- eventually need this too... revisit when Task 9/10 needs it." That's now.
--
-- device_type_instruments included too: Task 10's Monitoring module will
-- need the same customer-facing read for instrument labels/units, same
-- reasoning as device_types — adding both now avoids a second identical
-- migration later for the same underlying need.

drop policy if exists "device_types_customer_select" on waytara.device_types;
create policy "device_types_customer_select" on waytara.device_types
  for select
  using (true);

drop policy if exists "device_type_instruments_customer_select" on waytara.device_type_instruments;
create policy "device_type_instruments_customer_select" on waytara.device_type_instruments
  for select
  using (true);
