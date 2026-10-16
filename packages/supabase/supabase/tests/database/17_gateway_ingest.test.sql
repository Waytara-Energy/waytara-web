-- Task A4c: what the backend's data intake reads and writes (catalogue profile, register maps, summaries that replace each other,
-- live values, check-ins and the status they produce). Rolled back at the end.
-- (Same rule as 15_*.test.sql: every assertion is one statement starting with "select <assertion>(" at the start of a line.)

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(53);

insert into auth.users (id, instance_id, aud, role, email) values
  ('e1000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e1@test.local'),
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  ('50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'svc@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('c1000000-0000-0000-0000-000000000001', 'c1@test.local', 'customer', 'C1'),
  ('e1000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'employee', 'E1');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-000000000001');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'S1', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category, technical_specs) values
  ('99000000-0000-0000-0000-000000000009', 'Inv', 'solar_inverter', '{"mppt_count": 2, "phase": 1}');
insert into waytara.equipment (id, site_id, stock_id, label) values
  ('91000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009', 'Unit one'),
  ('92000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009', 'Unit two');
insert into waytara.equipment_templates (category, dashboard_section, device_category, key_name, display_name, direction, value_kind)
  values ('Test', 'Monitoring', 'solar', 'raw1', 'Raw one', 'read', 'number');
insert into waytara.equipment_metrics (equipment_id, key_name, category, device_category, direction, address, decode, cadence_seconds, show_for_user)
  values ('91000000-0000-0000-0000-000000000001', 'raw1', 'Test', 'solar', 'read', '{"registers": [100]}', '{"scale": 0.1}', 10, true);
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000a0', 'test backend');
insert into waytara.gateway_devices (equipment_id, hardware_id) values ('91000000-0000-0000-0000-000000000001', 'AABBCCDDEEFF');

create temp table _t (b0 timestamptz);
grant all on _t to authenticated;
insert into _t select date_bin(interval '15 minutes', now() - interval '1 hour', timestamptz '2000-01-01 00:00:00+05:30');

-- ---- not for browsers
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001')$$, '42501', null, 'a staff member cannot read the catalogue through the backend functions');
select throws_ok($$select waytara.gw_store_map('91000000-0000-0000-0000-000000000001', 'abcdef0123456789', '{}'::jsonb)$$, '42501', null, 'a staff member cannot store a register map');
select throws_ok($$select waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001', '[]'::jsonb, '[]'::jsonb)$$, '42501', null, 'a staff member cannot write summaries');
select throws_ok($$select waytara.gw_report_heartbeat('91000000-0000-0000-0000-000000000001')$$, '42501', null, 'a staff member cannot report a check-in');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001', '[]'::jsonb, '[]'::jsonb)$$, '42501', null, 'neither can the owner of the equipment');
reset role;

-- ---- the backend identity
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);

-- the catalogue of a unit
select is((select (waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001') ->> 'mppt_count')::int), 2, 'the profile carries the PV inputs from the stock specs');
select is((select jsonb_array_length(waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001') -> 'metrics')), 1, 'and one entry per metric of the unit');
select is((select waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001') #>> '{metrics,0,key}'), 'raw1', 'with its key');
select is((select waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001') #> '{metrics,0,registers}'), '[100]'::jsonb, 'its registers');
select is((select waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001') #> '{metrics,0,decode}'), '{"scale": 0.1}'::jsonb, 'its decoding rule');
select is((select waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001') #>> '{metrics,0,value_kind}'), 'number', 'the kind of value from the template');
select is((select (waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001') ->> 'upload_interval_s')::int), 900, 'the upload interval defaults to 15 minutes');
select is((select waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001') -> 'unreadable_registers'), '[]'::jsonb, 'and no register is known to be silent');
select is((select waytara.gw_equipment_profile('99999999-0000-0000-0000-000000000000')), null::jsonb, 'unknown equipment has no profile');
select ok((select waytara.gw_equipment_profile('92000000-0000-0000-0000-000000000002') -> 'mppt_count') is not null and (select jsonb_array_length(waytara.gw_equipment_profile('92000000-0000-0000-0000-000000000002') -> 'metrics')) = 0, 'a unit with no metrics gets an empty catalogue');

-- register maps
select is((select waytara.gw_store_map('91000000-0000-0000-0000-000000000001', 'aaaaaaaaaaaaaaaa', '{"ver": 1}'::jsonb)), 1, 'the first register map is version 1');
select is((select waytara.gw_store_map('91000000-0000-0000-0000-000000000001', 'aaaaaaaaaaaaaaaa', '{"ver": 1}'::jsonb)), 1, 'the same map again is still version 1');
select is((select waytara.gw_store_map('91000000-0000-0000-0000-000000000001', 'bbbbbbbbbbbbbbbb', '{"ver": 2}'::jsonb)), 2, 'a different map is version 2');
select is((select waytara.gw_store_map('92000000-0000-0000-0000-000000000002', 'aaaaaaaaaaaaaaaa', '{"ver": 1}'::jsonb)), 1, 'versions count per equipment');
select throws_ok($$select waytara.gw_store_map('91000000-0000-0000-0000-000000000001', 'short', '{}'::jsonb)$$, '22023', null, 'a malformed hash is refused');
select throws_ok($$select waytara.gw_store_map('99999999-0000-0000-0000-000000000000', 'aaaaaaaaaaaaaaaa', '{}'::jsonb)$$, 'P0002', null, 'a map for unknown equipment is refused');

-- summaries
select is(
  (select (waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001',
     (select jsonb_build_array(
        jsonb_build_object('k', 'raw1', 'b', b0, 'w', 100, 'c', 900, 'mn', 1, 'mx', 2, 'l', 2, 'n', 10),
        jsonb_build_object('k', 'raw1', 'b', b0 + interval '15 minutes', 'w', 50, 'c', 500, 'mn', 1, 'mx', 1, 'l', 1, 'n', 5)) from _t),
     '[]'::jsonb) ->> 'buckets_written')::int), 2, 'two summaries are written');
reset role;
select is((select wsum from waytara.equipment_rollup_15m where equipment_id = '91000000-0000-0000-0000-000000000001' and bucket = (select b0 from _t)), 100::double precision, 'the first is stored as sent');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is(
  (select (waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001',
     (select jsonb_build_array(jsonb_build_object('k', 'raw1', 'b', b0, 'w', 80, 'c', 880, 'mn', 1, 'mx', 2, 'l', 2, 'n', 11)) from _t),
     '[]'::jsonb) ->> 'buckets_written')::int), 1, 'a bucket sent again is accepted');
reset role;
select is((select wsum from waytara.equipment_rollup_15m where equipment_id = '91000000-0000-0000-0000-000000000001' and bucket = (select b0 from _t)), 80::double precision, 'and REPLACES the stored one, even when it covers less');
select is((select count(*)::int from waytara.equipment_rollup_15m where equipment_id = '91000000-0000-0000-0000-000000000001'), 2, 'without adding a row');
select is((select n_samples from waytara.equipment_rollup_15m where equipment_id = '91000000-0000-0000-0000-000000000001' and bucket = (select b0 from _t)), 11, 'the other figures follow');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is(
  (select (waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001',
     (select jsonb_build_array(
        jsonb_build_object('k', 'raw1', 'b', b0 + interval '1 minute', 'w', 1, 'c', 60),
        jsonb_build_object('k', 'raw1', 'b', b0 + interval '3 days', 'w', 1, 'c', 60),
        jsonb_build_object('k', 'raw1', 'b', b0 - interval '10 days', 'w', 1, 'c', 60),
        jsonb_build_object('k', 'raw1', 'b', b0 + interval '30 minutes', 'w', 1, 'c', 0),
        jsonb_build_object('k', 'raw1', 'b', b0 + interval '45 minutes', 'w', 1, 'c', 5000)) from _t),
     '[]'::jsonb)) ->> 'buckets_rejected')::int, 5, 'unaligned, future, too old, empty and over-long buckets are all rejected');
reset role;
select is((select count(*)::int from waytara.equipment_rollup_15m where equipment_id = '91000000-0000-0000-0000-000000000001'), 2, 'and nothing of them is stored');
select is((select count(*)::int from waytara.equipment_rollup_15m where equipment_id = '91000000-0000-0000-0000-000000000001' and is_test), 0, 'no summary is marked as a test');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001', '{"a": 1}'::jsonb, '[]'::jsonb)$$, '22023', null, 'summaries must be an array');
select throws_ok($$select waytara.gw_ingest_summaries('99999999-0000-0000-0000-000000000000', '[]'::jsonb, '[]'::jsonb)$$, 'P0002', null, 'summaries for unknown equipment are refused');

-- live values
select is((select (waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001', '[]'::jsonb, jsonb_build_array(jsonb_build_object('k', 'raw1', 'v', 5, 't', extract(epoch from now()) - 60))) ->> 'latest_updated')::int), 1, 'a live value is stored');
reset role;
select is((select value from waytara.equipment_latest where equipment_id = '91000000-0000-0000-0000-000000000001' and key_name = 'raw1'), 5::numeric, 'as sent');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is((select (waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001', '[]'::jsonb, jsonb_build_array(jsonb_build_object('k', 'raw1', 'v', 9, 't', extract(epoch from now()) - 120))) ->> 'latest_updated')::int), 0, 'an older value does not replace a newer one');
select is((select (waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001', '[]'::jsonb, jsonb_build_array(jsonb_build_object('k', 'raw1', 'v', 7, 't', extract(epoch from now()) - 10))) ->> 'latest_updated')::int), 1, 'a newer one does');
select is((select (waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001', '[]'::jsonb, jsonb_build_array(jsonb_build_object('k', 'raw1', 'v', 8, 't', extract(epoch from now()) + 100000))) ->> 'latest_updated')::int), 1, 'a value stamped in the future is accepted');
reset role;
select ok((select ts from waytara.equipment_latest where equipment_id = '91000000-0000-0000-0000-000000000001' and key_name = 'raw1') <= now(), 'but its time is capped at now');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is((select (waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001', '[]'::jsonb, jsonb_build_array(jsonb_build_object('k', 'raw1', 'v', 'text', 't', 1))) ->> 'latest_updated')::int), 0, 'a value that is not a number is ignored');

-- the open bucket
select is(
  (select (waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001', '[]'::jsonb, '[]'::jsonb,
     jsonb_build_array(jsonb_build_object('k', 'raw1', 'b', date_bin(interval '15 minutes', now(), timestamptz '2000-01-01 00:00:00+05:30'), 'w', 30, 'c', 300, 'mn', 1, 'mx', 1, 'l', 1, 'n', 3))) ->> 'open_updated')::int), 1, 'the running figures of the open bucket are stored');
select is(
  (select (waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001', '[]'::jsonb, '[]'::jsonb,
     jsonb_build_array(jsonb_build_object('k', 'raw1', 'b', date_bin(interval '15 minutes', now(), timestamptz '2000-01-01 00:00:00+05:30') - interval '15 minutes', 'w', 99, 'c', 900))) ->> 'open_updated')::int), 0, 'an older bucket does not replace the open one');
select is(
  (select (waytara.gw_ingest_summaries('91000000-0000-0000-0000-000000000001', '[]'::jsonb, '[]'::jsonb,
     jsonb_build_array(jsonb_build_object('k', 'raw1', 'b', date_bin(interval '15 minutes', now(), timestamptz '2000-01-01 00:00:00+05:30') + interval '1 minute', 'w', 99, 'c', 60))) ->> 'open_updated')::int), 0, 'an unaligned open bucket is ignored');
reset role;
select is((select wsum from waytara.equipment_open_bucket where equipment_id = '91000000-0000-0000-0000-000000000001' and key_name = 'raw1'), 30::double precision, 'only the good one is kept');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);

-- check-ins
select lives_ok($$select waytara.gw_report_heartbeat('91000000-0000-0000-0000-000000000001', 120, true, 4, '2.0.1', 2, 'power_on', 0.5, 900)$$, 'a check-in is accepted');
reset role;
select is((select status from waytara.equipment_heartbeat where equipment_id = '91000000-0000-0000-0000-000000000001'), 'online', 'it makes the unit online');
select is((select heartbeat_s from waytara.equipment_heartbeat where equipment_id = '91000000-0000-0000-0000-000000000001'), 10, 'with a 10 second check-in');
select is((select fw_version from waytara.gateway_devices where equipment_id = '91000000-0000-0000-0000-000000000001'), '2.0.1', 'and the firmware is remembered');
select is((select map_version from waytara.gateway_devices where equipment_id = '91000000-0000-0000-0000-000000000001'), 2, 'and the register map it runs');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select waytara.gw_report_heartbeat('91000000-0000-0000-0000-000000000001', 130, false, 60);
select waytara.gw_report_heartbeat('91000000-0000-0000-0000-000000000001', 140, false, 70);
select waytara.gw_report_heartbeat('91000000-0000-0000-0000-000000000001', 150, false, 80);
reset role;
select is((select status from waytara.equipment_heartbeat where equipment_id = '91000000-0000-0000-0000-000000000001'), 'device_unreachable', 'three check-ins in a row without an answer from the inverter make it unreachable');
select ok((select device_error from waytara.equipment_heartbeat where equipment_id = '91000000-0000-0000-0000-000000000001') is not null, 'and say why');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select waytara.gw_report_heartbeat('91000000-0000-0000-0000-000000000001', 160, true, 2);
reset role;
select is((select status from waytara.equipment_heartbeat where equipment_id = '91000000-0000-0000-0000-000000000001'), 'online', 'it is online again as soon as the inverter answers');
select ok((select device_error from waytara.equipment_heartbeat where equipment_id = '91000000-0000-0000-0000-000000000001') is null, 'and the error is gone');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_report_heartbeat('99999999-0000-0000-0000-000000000000')$$, 'P0002', null, 'a check-in for unknown equipment is refused');
reset role;

select * from finish();
rollback;
