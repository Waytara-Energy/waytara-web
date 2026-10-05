-- Regression test for the offline-alert bug: "last seen" must be exact per
-- device no matter how many (device, key) rows exist — the API's 1,000-row
-- cap used to hide devices whose newest reading was older.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(7);

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
  ('e2000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', '99000000-0000-0000-0000-000000000009'),
  ('e3000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000002', '99000000-0000-0000-0000-000000000009');

-- Device 1: 1,200 keys, all reported RECENTLY (this alone exceeds the API cap).
insert into waytara.equipment_telemetry (equipment_id, ts, key_name, value)
select 'e1000000-0000-0000-0000-000000000001', now() - interval '1 minute', 'k' || g, g from generate_series(1, 1200) g;
-- Device 2: one key, last reported 3 days ago (older than every row of device 1).
insert into waytara.equipment_telemetry (equipment_id, ts, key_name, value) values
  ('e2000000-0000-0000-0000-000000000002', now() - interval '3 days', 'k1', 1),
  ('e2000000-0000-0000-0000-000000000002', now() - interval '4 days', 'k2', 2);
-- Device 3: never reported.

select is((select count(*)::int from waytara.equipment_latest), 1202, 'precondition: more latest rows than the API will return in one request');

select is(
  (select count(*)::int from waytara.device_last_seen(array['e1000000-0000-0000-0000-000000000001','e2000000-0000-0000-0000-000000000002','e3000000-0000-0000-0000-000000000003']::uuid[])),
  2, 'one row per device that has ever reported (the silent device is simply absent)');

select ok(
  (select last_ts from waytara.device_last_seen(array['e2000000-0000-0000-0000-000000000002']::uuid[])) < now() - interval '2 days 23 hours',
  'the OLD device is still found with its exact last reading (it is not crowded out by the 1,200 newer rows)');

select ok(
  (select last_ts from waytara.device_last_seen(array['e1000000-0000-0000-0000-000000000001']::uuid[])) > now() - interval '5 minutes',
  'the busy device reports its newest reading');

select is(
  (select count(*)::int from waytara.device_last_seen(array['e3000000-0000-0000-0000-000000000003']::uuid[])),
  0, 'a device that never reported returns no row');

set local role anon;
select throws_ok($$ select * from waytara.device_last_seen(array['e1000000-0000-0000-0000-000000000001']::uuid[]) $$, '42501', null, 'anon cannot call device_last_seen');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select is(
  (select count(*)::int from waytara.device_last_seen(array['e1000000-0000-0000-0000-000000000001','e2000000-0000-0000-0000-000000000002']::uuid[])),
  1, 'a customer only sees their own device (RLS applies)');
reset role;

select * from finish();
rollback;
