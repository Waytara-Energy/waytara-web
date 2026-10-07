-- Data-layer tests: equipment_latest (trigger-maintained) and its row-level security. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(10);

\set c1 '''11111111-1111-1111-1111-111111111111'''
\set c2 '''22222222-2222-2222-2222-222222222222'''

insert into auth.users (id, instance_id, aud, role, email) values
  (:c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  (:c2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  (:c1, 'c1@test.local', 'customer', 'C1'), (:c2, 'c2@test.local', 'customer', 'C2');
insert into waytara.customers (id) values (:c1), (:c2);
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', :c1, 'S1', 'residential_independent_villas', 'hybrid'),
  ('52000000-0000-0000-0000-000000000002', :c2, 'S2', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-000000000009', 'Inv', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id) values
  ('e1000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009'),
  ('e2000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', '99000000-0000-0000-0000-000000000009');

-- ------------------------------------------------------------------
-- Trigger: newest reading per (device, key) wins; test data is ignored
-- ------------------------------------------------------------------
insert into waytara.equipment_telemetry (equipment_id, ts, key_name, value, unit, is_test) values
  ('e1000000-0000-0000-0000-000000000001', '2026-10-01 10:00:00+00', 'battery_soc_pct', 50, '%', false),
  ('e1000000-0000-0000-0000-000000000001', '2026-10-01 10:05:00+00', 'battery_soc_pct', 60, '%', false),
  ('e1000000-0000-0000-0000-000000000001', '2026-10-01 10:02:00+00', 'pv1_power_w',     900, 'W', false),
  ('e1000000-0000-0000-0000-000000000001', '2026-10-01 10:09:00+00', 'pv1_power_w',    9999, 'W', true),
  ('e2000000-0000-0000-0000-000000000002', '2026-10-01 10:00:00+00', 'battery_soc_pct', 20, '%', false);

select is((select value from waytara.equipment_latest where equipment_id = 'e1000000-0000-0000-0000-000000000001' and key_name = 'battery_soc_pct'), 60::numeric,
  'latest keeps the newest reading from a batch');
select is((select value from waytara.equipment_latest where equipment_id = 'e1000000-0000-0000-0000-000000000001' and key_name = 'pv1_power_w'), 900::numeric,
  'test readings never reach equipment_latest');

-- a later INSERT statement with an OLDER timestamp must not overwrite
insert into waytara.equipment_telemetry (equipment_id, ts, key_name, value, unit) values
  ('e1000000-0000-0000-0000-000000000001', '2026-10-01 09:00:00+00', 'battery_soc_pct', 10, '%');
select is((select value from waytara.equipment_latest where equipment_id = 'e1000000-0000-0000-0000-000000000001' and key_name = 'battery_soc_pct'), 60::numeric,
  'an older late-arriving reading does not overwrite a newer one');

-- a later INSERT statement with a NEWER timestamp does
insert into waytara.equipment_telemetry (equipment_id, ts, key_name, value, unit) values
  ('e1000000-0000-0000-0000-000000000001', '2026-10-01 11:00:00+00', 'battery_soc_pct', 70, '%');
select is((select value from waytara.equipment_latest where equipment_id = 'e1000000-0000-0000-0000-000000000001' and key_name = 'battery_soc_pct'), 70::numeric,
  'a newer reading replaces the stored latest');
select is((select count(*)::int from waytara.equipment_latest where equipment_id = 'e1000000-0000-0000-0000-000000000001'), 2, 'one row per (device, key)');

-- ------------------------------------------------------------------
-- one more key through the same trigger
-- ------------------------------------------------------------------
insert into waytara.equipment_telemetry (equipment_id, ts, key_name, value) values
  ('e1000000-0000-0000-0000-000000000001', '2026-10-02 00:05:00+00', 'load_total_power_w', 100),
  ('e1000000-0000-0000-0000-000000000001', '2026-10-02 00:10:00+00', 'load_total_power_w', 300),
  ('e1000000-0000-0000-0000-000000000001', '2026-10-02 00:40:00+00', 'load_total_power_w', 500);

-- ------------------------------------------------------------------
-- RLS on the new objects
-- ------------------------------------------------------------------
set local role anon;
select throws_ok($$ select count(*) from waytara.equipment_latest $$, '42501', null, 'anon cannot read equipment_latest');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;

select is((select count(*)::int from waytara.equipment_latest), 3, 'customer sees only their own latest values (3 keys; none of customer 2''s)');
select is((select count(*)::int from waytara.equipment_latest where equipment_id = 'e2000000-0000-0000-0000-000000000002'), 0, 'customer cannot see another customer''s latest values');
select throws_ok($$ update waytara.equipment_latest set value = 0 $$, '42501', null, 'customer cannot write equipment_latest');
select throws_ok($$ insert into waytara.equipment_latest (equipment_id, key_name, ts) values ('e1000000-0000-0000-0000-000000000001', 'forged', now()) $$, '42501', null, 'customer cannot insert into equipment_latest');

reset role;
select * from finish();
rollback;
