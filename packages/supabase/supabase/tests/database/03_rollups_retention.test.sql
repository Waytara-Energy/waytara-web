-- Hourly rollup, per-day reads and raw-data retention. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(18);

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

-- IST midnight of 2026-10-02 is 2026-10-01 18:30:00 UTC.
-- Day 2026-10-01 (IST): 18:00 and 18:20 UTC are 23:30 / 23:50 IST.
-- Day 2026-10-02 (IST): 18:40 and 19:10 UTC are 00:10 / 00:40 IST.
insert into waytara.equipment_telemetry (equipment_id, ts, key_name, value, is_test) values
  ('e1000000-0000-0000-0000-000000000001', '2026-10-01 18:00:00+00', 'day_pv_energy_kwh', 10, false),
  ('e1000000-0000-0000-0000-000000000001', '2026-10-01 18:20:00+00', 'day_pv_energy_kwh', 12, false),
  ('e1000000-0000-0000-0000-000000000001', '2026-10-01 18:40:00+00', 'day_pv_energy_kwh', 0.5, false),
  ('e1000000-0000-0000-0000-000000000001', '2026-10-01 19:10:00+00', 'day_pv_energy_kwh', 1.5, false),
  ('e1000000-0000-0000-0000-000000000001', '2026-10-01 19:20:00+00', 'day_pv_energy_kwh', 9999, true),   -- test data
  ('e1000000-0000-0000-0000-000000000001', '2026-10-01 19:25:00+00', 'day_pv_energy_kwh', null, false),  -- null reading
  ('e2000000-0000-0000-0000-000000000002', '2026-10-01 19:10:00+00', 'day_pv_energy_kwh', 77, false);

select is(waytara.rollup_telemetry_hourly('-infinity'), 3::bigint, 'rollup writes one row per (device, key, hour bin); test and null readings excluded');
select is(waytara.rollup_telemetry_hourly('-infinity'), 3::bigint, 'rollup is idempotent (re-running upserts the same rows)');
select is((select count(*)::int from waytara.equipment_telemetry_hourly), 3, 'no duplicate rollup rows after re-running');

select results_eq(
  $$ select min_value, avg_value, max_value, samples from waytara.equipment_telemetry_hourly
     where equipment_id = 'e1000000-0000-0000-0000-000000000001' and hour = '2026-10-01 18:30:00+00' $$,
  $$ values (0.5::double precision, 1::double precision, 1.5::double precision, 2) $$,
  'hour bins are IST-aligned: they start :30 past the UTC hour (18:40 and 19:10 UTC share the 18:30 bin)');

-- ------------------------------------------------------------------
-- telemetry_daily: exact IST day boundaries
-- ------------------------------------------------------------------
select results_eq(
  $$ select day, max_value, samples from waytara.telemetry_daily(
       'e1000000-0000-0000-0000-000000000001', array['day_pv_energy_kwh'],
       '2026-09-30 00:00:00+00', '2026-10-05 00:00:00+00') order by day $$,
  $$ values ('2026-09-30 18:30:00+00'::timestamptz, 12::double precision, 2),
            ('2026-10-01 18:30:00+00'::timestamptz, 1.5::double precision, 2) $$,
  'readings are attributed to the correct IST day (23:50 IST stays on the 1st, 00:10 IST starts the 2nd)');

select throws_ok(
  $$ select * from waytara.telemetry_daily('e1000000-0000-0000-0000-000000000001', array['x'], '2020-01-01', '2026-10-01') $$,
  'P0001', 'time range too large (max 800 days)', 'daily read refuses an unbounded range');

-- ------------------------------------------------------------------
-- Access control
-- ------------------------------------------------------------------
set local role anon;
select throws_ok($$ select count(*) from waytara.equipment_telemetry_hourly $$, '42501', null, 'anon cannot read the rollup');
select throws_ok($$ select * from waytara.telemetry_daily('e1000000-0000-0000-0000-000000000001', array['x'], now() - interval '1 day', now()) $$, '42501', null, 'anon cannot call telemetry_daily');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;

select is((select count(*)::int from waytara.equipment_telemetry_hourly), 2, 'customer sees only their own rollup rows');
select is((select count(*)::int from waytara.telemetry_daily('e2000000-0000-0000-0000-000000000002', array['day_pv_energy_kwh'], '2026-09-30', '2026-10-05')), 0, 'customer gets nothing for another customer''s device');
select throws_ok($$ delete from waytara.equipment_telemetry_hourly $$, '42501', null, 'customer cannot delete rollup rows');
select throws_ok($$ select waytara.purge_old_telemetry(90) $$, '42501', null, 'customer cannot purge telemetry');
select throws_ok($$ select waytara.rollup_telemetry_hourly() $$, '42501', null, 'customer cannot trigger a rollup');

reset role;

-- ------------------------------------------------------------------
-- Retention: raw rows beyond the window go, the rollup stays
-- ------------------------------------------------------------------
insert into waytara.equipment_telemetry (equipment_id, ts, key_name, value) values
  ('e1000000-0000-0000-0000-000000000001', now() - interval '120 days', 'old_key', 1),
  ('e1000000-0000-0000-0000-000000000001', now() - interval '100 days', 'old_key', 3),
  ('e1000000-0000-0000-0000-000000000001', now() - interval '10 days',  'old_key', 5);
select waytara.rollup_telemetry_hourly('-infinity');

select throws_ok($$ select waytara.purge_old_telemetry(7) $$, 'P0001', null, 'retention below 14 days is refused');
select is(waytara.purge_old_telemetry(90), 2::bigint, 'purge removes only raw rows older than the retention window');
select is((select count(*)::int from waytara.equipment_telemetry where key_name = 'old_key'), 1, 'the recent raw row survives');
select is((select count(*)::int from waytara.equipment_telemetry_hourly where key_name = 'old_key'), 3, 'hourly rollups are kept after raw rows are purged');
select is(waytara.purge_old_telemetry(90), 0::bigint, 'purge is a no-op once nothing is old enough');

select * from finish();
rollback;
