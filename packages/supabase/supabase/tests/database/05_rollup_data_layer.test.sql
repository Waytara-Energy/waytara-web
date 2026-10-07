-- Rollup data layer: agent ingest, 15m -> 1h -> 1d jobs, the combine-exactly read
-- function, backfill from raw readings (the hold semantics), retention, and access.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(59);

\set c1 '''11111111-1111-1111-1111-111111111111'''
\set c2 '''22222222-2222-2222-2222-222222222222'''
\set e1 '''e1000000-0000-0000-0000-000000000001'''
\set e2 '''e2000000-0000-0000-0000-000000000002'''

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
  (:e1, '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009'),
  (:e2, '52000000-0000-0000-0000-000000000002', '99000000-0000-0000-0000-000000000009');
insert into waytara.equipment_templates (category, dashboard_section, device_category, key_name, display_name, direction)
  values ('Test', 'Monitoring', 'solar', 'raw1', 'Raw one', 'read');
insert into waytara.equipment_metrics (equipment_id, key_name, category, device_category, direction, cadence_seconds)
  values (:e1, 'raw1', 'Test', 'solar', 'read', 10);

-- Fixed reference points (IST-aligned): an old hour (> 2 h ago, so the hourly tier serves it)
-- and the current quarter hour.
create temp table ctx as
select date_bin(interval '1 hour', now() - interval '6 hours', timestamptz '2000-01-01 00:00:00+05:30') as h0,
       date_bin(interval '15 minutes', now(), timestamptz '2000-01-01 00:00:00+05:30') as cur,
       date_bin(interval '15 minutes', now() - interval '4 hours', timestamptz '2000-01-01 00:00:00+05:30') as rb;
grant select on ctx to public;

-- ---------- 1. structure and privileges ----------
select waytara.ensure_rollup_partitions();
select ok(to_regclass('waytara.equipment_rollup_15m_p' || to_char(now() at time zone 'Asia/Kolkata', 'YYYYMMDD')) is not null,
  'today''s 15-minute partition exists');
select ok(to_regclass('waytara.equipment_rollup_1h_p' || to_char(now() at time zone 'Asia/Kolkata', 'YYYYMM')) is not null,
  'this month''s hourly partition exists');
select ok(not has_function_privilege('authenticated', 'waytara.ingest_tick(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb)', 'execute'),
  'signed-in users cannot call ingest_tick');
select ok(not has_function_privilege('anon', 'waytara.ingest_tick(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb)', 'execute'),
  'anon cannot call ingest_tick');
select ok(has_function_privilege('service_role', 'waytara.ingest_tick(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb)', 'execute'),
  'the service role (the agent) can call ingest_tick');
select throws_ok($$ select waytara.ingest_tick('00000000-0000-0000-0000-00000000dead', now()) $$, '22023', null,
  'ingest for an unknown device is refused');

-- ---------- 2. ingest ----------
-- Four finished buckets of key p in the old hour: avg 10/20/30/40, covered 900 s each.
create temp table closed4 as
select jsonb_agg(jsonb_build_object(
  'k', 'p', 'b', (select h0 from ctx) + make_interval(mins => 15 * i),
  'w', 900 * 10 * (i + 1), 'c', 900,
  'mn', 5 + 10 * i, 'mx', 15 + 10 * i, 'l', 12 + 10 * i, 'n', 90)) as j
from generate_series(0, 3) i;

select is(
  (select waytara.ingest_tick(:e1, now(), '{"p": 100, "q": {"v": 5, "u": "V"}}', '{}', (select j from closed4), '{"interval_s": 60, "version": "t"}')->>'closed_written'),
  '4', 'four finished buckets are written');
select is((select count(*)::int from waytara.equipment_rollup_15m where equipment_id = :e1 and key_name = 'p'), 4, 'four rows stored');
select is(
  (select waytara.ingest_tick(:e1, now(), '{}', '{}', (select j from closed4))->>'closed_written'),
  '0', 'replaying the same buckets writes nothing (no duplicates)');
select is((select count(*)::int from waytara.equipment_rollup_15m where equipment_id = :e1 and key_name = 'p'), 4, 'still four rows after the replay');

-- a bucket re-sent with MORE coverage replaces the stored one; with less, it does not
select waytara.ingest_tick(:e1, now(), '{}', '{}', jsonb_build_array(jsonb_build_object(
  'k', 'p', 'b', (select h0 from ctx) + interval '60 minutes', 'w', 22500, 'c', 450, 'mn', 40, 'mx', 60, 'l', 55, 'n', 45)));
select waytara.ingest_tick(:e1, now(), '{}', '{}', jsonb_build_array(jsonb_build_object(
  'k', 'p', 'b', (select h0 from ctx) + interval '60 minutes', 'w', 45000, 'c', 900, 'mn', 40, 'mx', 60, 'l', 55, 'n', 90)));
select is((select covered_s from waytara.equipment_rollup_15m where equipment_id = :e1 and key_name = 'p' and bucket = (select h0 from ctx) + interval '60 minutes'),
  900::double precision, 'a more complete re-send replaces the bucket');
select waytara.ingest_tick(:e1, now(), '{}', '{}', jsonb_build_array(jsonb_build_object(
  'k', 'p', 'b', (select h0 from ctx) + interval '60 minutes', 'w', 100, 'c', 10, 'mn', 1, 'mx', 1, 'l', 1, 'n', 1)));
select is((select covered_s from waytara.equipment_rollup_15m where equipment_id = :e1 and key_name = 'p' and bucket = (select h0 from ctx) + interval '60 minutes'),
  900::double precision, 'a less complete re-send does not overwrite it');

-- invalid buckets are rejected, not stored
select is(
  (select waytara.ingest_tick(:e1, now(), '{}', '{}', jsonb_build_array(
     jsonb_build_object('k', 'bad', 'b', (select h0 from ctx) + interval '7 minutes', 'w', 1, 'c', 1),
     jsonb_build_object('k', 'bad', 'b', date_bin(interval '15 minutes', now() - interval '9 days', timestamptz '2000-01-01 00:00:00+05:30'), 'w', 1, 'c', 1),
     jsonb_build_object('k', 'bad', 'b', date_bin(interval '15 minutes', now() + interval '2 days', timestamptz '2000-01-01 00:00:00+05:30'), 'w', 1, 'c', 1)))->>'closed_rejected'),
  '3', 'misaligned, too-old and future buckets are rejected');
select is((select count(*)::int from waytara.equipment_rollup_15m where key_name = 'bad'), 0, 'nothing from the rejected buckets was stored');

-- live values: newer wins, units are kept, heartbeat is written
select is((select value from waytara.equipment_latest where equipment_id = :e1 and key_name = 'p'), 100::numeric, 'live value stored');
select waytara.ingest_tick(:e1, now() - interval '1 hour', '{"p": 1}');
select is((select value from waytara.equipment_latest where equipment_id = :e1 and key_name = 'p'), 100::numeric, 'an older live value never overwrites a newer one');
select waytara.ingest_tick(:e1, now(), '{"q": 6}');
select is((select unit from waytara.equipment_latest where equipment_id = :e1 and key_name = 'q'), 'V', 'the unit survives a later number-only update');
select is((select upload_interval_s from waytara.equipment_heartbeat where equipment_id = :e1), 60, 'heartbeat records the upload interval');

-- open bucket: overwritten by the same or a newer bucket, never by an older one
select waytara.ingest_tick(:e1, now(), '{}', jsonb_build_object('p', jsonb_build_object('b', (select cur from ctx), 'w', 100, 'c', 10, 'mn', 10, 'mx', 10, 'l', 10, 'n', 2)));
select waytara.ingest_tick(:e1, now(), '{}', jsonb_build_object('p', jsonb_build_object('b', (select cur from ctx) - interval '15 minutes', 'w', 999, 'c', 999, 'n', 9)));
select is((select wsum from waytara.equipment_open_bucket where equipment_id = :e1 and key_name = 'p'), 100::double precision, 'an older open bucket does not replace the current one');

-- ---------- 3. jobs: 15m -> 1h -> 1d ----------
select waytara.run_rollups();
select is((select wsum from waytara.equipment_rollup_1h where equipment_id = :e1 and key_name = 'p' and hour = (select h0 from ctx)), 90000::double precision, 'hour: wsum is the sum of its four buckets');
select is((select covered_s from waytara.equipment_rollup_1h where equipment_id = :e1 and key_name = 'p' and hour = (select h0 from ctx)), 3600::double precision, 'hour: covered seconds');
select is((select (min_value, max_value, last_value) from waytara.equipment_rollup_1h where equipment_id = :e1 and key_name = 'p' and hour = (select h0 from ctx)),
  row(5::double precision, 45::double precision, 42::double precision), 'hour: min, max and last (from the newest bucket)');
select is((select n_samples from waytara.equipment_rollup_1h where equipment_id = :e1 and key_name = 'p' and hour = (select h0 from ctx)), 360, 'hour: sample count');
select is((select pos_wsum from waytara.equipment_rollup_1h where equipment_id = :e1 and key_name = 'p' and hour = (select h0 from ctx)), null::double precision, 'no negatives, so no pos/neg split is stored');
select is(
  (select covered_s from waytara.equipment_rollup_1d d where d.equipment_id = :e1 and d.key_name = 'p' and d.day = (((select h0 from ctx)) at time zone 'Asia/Kolkata')::date),
  (select sum(covered_s) from waytara.equipment_rollup_1h h where h.equipment_id = :e1 and h.key_name = 'p' and (h.hour at time zone 'Asia/Kolkata')::date = (((select h0 from ctx)) at time zone 'Asia/Kolkata')::date),
  'day: equals the sum of its hours');

-- late data fixes the hour it belongs to
select waytara.ingest_tick(:e1, now(), '{}', '{}', jsonb_build_array(jsonb_build_object('k', 'z', 'b', (select h0 from ctx), 'w', 9000, 'c', 900, 'mn', 1, 'mx', 1, 'l', 1, 'n', 1)));
select waytara.run_rollups();
select is((select covered_s from waytara.equipment_rollup_1h where equipment_id = :e1 and key_name = 'z' and hour = (select h0 from ctx)), 900::double precision, 'first bucket rolls into its hour');
select waytara.ingest_tick(:e1, now(), '{}', '{}', jsonb_build_array(jsonb_build_object('k', 'z', 'b', (select h0 from ctx) + interval '15 minutes', 'w', 18000, 'c', 900, 'mn', 2, 'mx', 2, 'l', 2, 'n', 1)));
select waytara.run_rollups();
select is((select covered_s from waytara.equipment_rollup_1h where equipment_id = :e1 and key_name = 'z' and hour = (select h0 from ctx)), 1800::double precision, 'a bucket that arrives late is added to its hour on the next run');

-- ---------- 4. read function: combining is exact ----------
select is((select count(*)::int from waytara.telemetry_series(:e1, array['p'], (select h0 from ctx), (select h0 from ctx) + interval '1 hour', 15)), 4, '15 min: four buckets');
select is((select array_agg(round(avg_value)::int order by bucket) from waytara.telemetry_series(:e1, array['p'], (select h0 from ctx), (select h0 from ctx) + interval '1 hour', 15)),
  array[10, 20, 30, 40], '15 min: averages');
select is((select array_agg(round(avg_value)::int order by bucket) from waytara.telemetry_series(:e1, array['p'], (select h0 from ctx), (select h0 from ctx) + interval '1 hour', 30)),
  array[15, 35], '30 min = two 15-minute buckets, time-weighted');
select is((select (round(avg_value), min_value, max_value, last_value) from waytara.telemetry_series(:e1, array['p'], (select h0 from ctx), (select h0 from ctx) + interval '1 hour', 60)),
  row(25::double precision, 5::double precision, 45::double precision, 42::double precision), '1 hour (served from the hourly tier): avg, min, max, last');
select is((select round((sum(avg_value * covered_s) / sum(covered_s))::numeric, 3) from waytara.telemetry_series(:e1, array['p'], (select h0 from ctx), (select h0 from ctx) + interval '2 hours', 120)),
  30.000, '2 hours: overall weighted average is exact (135000 / 4500)');
select ok((select covered_s >= 3600 from waytara.telemetry_series(:e1, array['p'],
    date_trunc('day', (select h0 from ctx) at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata',
    date_trunc('day', (select h0 from ctx) at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' + interval '1 day', 1440) order by bucket limit 1),
  '1 day: includes the hour (daily tier)');

-- signed values keep their positive and negative halves
select waytara.ingest_tick(:e1, now(), '{}', '{}', jsonb_build_array(jsonb_build_object(
  'k', 'bp', 'b', (select h0 from ctx), 'w', 900, 'c', 900, 'mn', -2, 'mx', 4, 'l', 4, 'pw', 1800, 'nw', 900, 'n', 90)));
select is((select (avg_value, pos_avg, neg_avg) from waytara.telemetry_series(:e1, array['bp'], (select h0 from ctx), (select h0 from ctx) + interval '15 minutes', 15)),
  row(1::double precision, 2::double precision, 1::double precision), 'avg 1 = +2 charged/discharged part minus 1 the other way');

-- the open bucket is merged in, once
select is((select avg_value from waytara.telemetry_series(:e1, array['p'], (select cur from ctx), (select cur from ctx) + interval '15 minutes', 15)), 10::double precision, 'open bucket appears in the current slot');
select is((select count(*)::int from waytara.telemetry_series(:e1, array['p'], (select cur from ctx), (select cur from ctx) + interval '15 minutes', 60)), 1, 'and is not duplicated in a coarser interval');

select throws_ok($$ select * from waytara.telemetry_series('e1000000-0000-0000-0000-000000000001', array['p'], now() - interval '1 day', now(), 7) $$, '22023', null, 'unsupported interval is refused');
select throws_ok($$ select * from waytara.telemetry_series('e1000000-0000-0000-0000-000000000001', array['p'], now() - interval '10 days', now(), 15) $$, '22023', null, 'more than 750 points per key is refused');
select throws_ok($$ select * from waytara.telemetry_series('e1000000-0000-0000-0000-000000000001', array['p'], now(), now(), 15) $$, '22023', null, 'an empty range is refused');

-- ---------- 5. backfill from raw readings: the hold semantics ----------
-- raw1 (cadence 10 s -> hold H = 60 s). Readings at b+0 s = 100, b+10 s = 200, b+870 s = 50.
--   100 holds 10 s (until the next reading); 200 holds min(860, 60) = 60 s; 50 holds 60 s, of which 30 s
--   fall in this bucket and 30 s in the next.
insert into waytara.equipment_telemetry (equipment_id, ts, key_name, value)
select :e1, (select rb from ctx) + make_interval(secs => s), 'raw1', v from (values (0, 100), (10, 200), (870, 50)) t(s, v);
select is(waytara.backfill_rollup_15m(:e1, (select rb from ctx), (select rb from ctx) + interval '30 minutes'), 2::bigint, 'backfill writes the two buckets the readings touch');
select is((select (wsum, covered_s, min_value, max_value, last_value, n_samples) from waytara.equipment_rollup_15m where equipment_id = :e1 and key_name = 'raw1' and bucket = (select rb from ctx)),
  row(14500::double precision, 100::double precision, 50::double precision, 200::double precision, 50::double precision, 3),
  'bucket 1: wsum = 100x10 + 200x60 + 50x30, covered 100 s, min 50, max 200, last 50, 3 samples');
select is((select (wsum, covered_s, min_value, max_value, last_value, n_samples) from waytara.equipment_rollup_15m where equipment_id = :e1 and key_name = 'raw1' and bucket = (select rb from ctx) + interval '15 minutes'),
  row(1500::double precision, 30::double precision, 50::double precision, 50::double precision, 50::double precision, 0),
  'bucket 2: the reading that straddled the boundary carries 30 s into it (no samples of its own)');
select waytara.backfill_rollup_15m(:e1, (select rb from ctx), (select rb from ctx) + interval '30 minutes');
select is((select count(*)::int from waytara.equipment_rollup_15m where equipment_id = :e1 and key_name = 'raw1'), 2, 'running the backfill again does not duplicate');

-- ---------- 6. retention ----------
select waytara.ensure_rollup_15m_partition(now() - interval '20 days');
select ok(to_regclass('waytara.equipment_rollup_15m_p' || to_char((now() - interval '20 days') at time zone 'Asia/Kolkata', 'YYYYMMDD')) is not null, 'an old partition exists before retention runs');
select ok(waytara.drop_old_rollup_15m_partitions(8) >= 1, 'retention drops partitions older than 8 days');
select ok(to_regclass('waytara.equipment_rollup_15m_p' || to_char((now() - interval '20 days') at time zone 'Asia/Kolkata', 'YYYYMMDD')) is null, 'the old partition is gone');
select ok(to_regclass('waytara.equipment_rollup_15m_p' || to_char(now() at time zone 'Asia/Kolkata', 'YYYYMMDD')) is not null, 'today''s partition is kept');

select ok((select first_day <= last_day and first_day is not null from waytara.device_data_range(:e1)), 'device_data_range reports the first and last day with data');

-- ---------- 7. access ----------
insert into waytara.equipment_rollup_15m (equipment_id, key_name, bucket, wsum, covered_s)
values (:e2, 'p', (select h0 from ctx), 900, 900);

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select ok((select count(*) from waytara.equipment_rollup_15m where equipment_id = 'e1000000-0000-0000-0000-000000000001') > 0, 'a customer reads their own device''s rollups');
select is((select count(*)::int from waytara.equipment_rollup_15m where equipment_id = 'e2000000-0000-0000-0000-000000000002'), 0, 'but not another customer''s');
select is((select count(*)::int from waytara.telemetry_series('e2000000-0000-0000-0000-000000000002', array['p'], (select h0 from ctx), (select h0 from ctx) + interval '1 hour', 15)), 0, 'telemetry_series respects RLS');
select ok(waytara.can_view_equipment('e1000000-0000-0000-0000-000000000001') and not waytara.can_view_equipment('e2000000-0000-0000-0000-000000000002'), 'can_view_equipment: own device yes, other no');
select throws_ok($$ select waytara.ingest_tick('e1000000-0000-0000-0000-000000000001', now()) $$, '42501', null, 'a customer cannot call ingest_tick');
select throws_ok($$ insert into waytara.equipment_rollup_15m (equipment_id, key_name, bucket, wsum, covered_s) values ('e1000000-0000-0000-0000-000000000001', 'x', now(), 1, 1) $$, '42501', null, 'a customer cannot write rollups');
reset role;

set local role anon;
select throws_ok($$ select count(*) from waytara.equipment_rollup_15m $$, '42501', null, 'anon cannot read rollups');
reset role;

select ok(exists (select 1 from storage.buckets where id = 'live-snapshots' and not public), 'the live-snapshots bucket exists and is private');

-- partitions are internal: a customer must not reach them directly (RLS on the parent does not cover that)
select waytara.ensure_rollup_15m_partition(timestamptz '2031-03-04 12:00:00+05:30');
select waytara.ensure_rollup_1h_partition(timestamptz '2031-03-04 12:00:00+05:30');
select is(
  (select count(*)::int from pg_inherits i join pg_class c on c.oid = i.inhrelid
    where i.inhparent in ('waytara.equipment_rollup_15m'::regclass, 'waytara.equipment_rollup_1h'::regclass) and not c.relrowsecurity),
  0, 'every rollup partition (including new ones) has row-level security enabled');
select is(
  (select count(*)::int from pg_inherits i
    where i.inhparent in ('waytara.equipment_rollup_15m'::regclass, 'waytara.equipment_rollup_1h'::regclass)
      and (has_table_privilege('authenticated', i.inhrelid, 'select') or has_table_privilege('authenticated', i.inhrelid, 'insert') or has_table_privilege('anon', i.inhrelid, 'select'))),
  0, 'no rollup partition is readable or writable by anon / authenticated');
set local role authenticated;
select throws_ok($$ select count(*) from waytara.equipment_rollup_15m_p20310304 $$, '42501', null, 'a signed-in role cannot read a partition directly');
reset role;

select * from finish();
rollback;
