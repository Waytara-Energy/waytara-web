-- A device with only the anon key can report for its own equipment with the right token, and nothing else: latest values, the
-- heartbeat and finished 15-minute buckets. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(9);

\set c1 '''11111111-1111-1111-1111-111111111111'''
\set e1 '''e1000000-0000-0000-0000-000000000001'''
\set e2 '''e2000000-0000-0000-0000-000000000002'''

insert into auth.users (id, instance_id, aud, role, email) values
  (:c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local');
insert into waytara.profiles (id, email, role, full_name) values (:c1, 'c1@test.local', 'customer', 'C1');
insert into waytara.customers (id) values (:c1);
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', :c1, 'S1', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-000000000009', 'Inv', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id) values
  (:e1, '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009'),
  (:e2, '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009');

insert into waytara.equipment_ingest_tokens (equipment_id, token_hash)
values (:e1, encode(sha256(convert_to('a-long-device-secret-1', 'utf8')), 'hex'));

set local role anon;

select lives_ok(
  $$select waytara.ingest_device_tick('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1', p_values => '{"p": 7}', p_agent => '{"device_online": true}')$$,
  'the right token is accepted with the anon role');
select throws_ok(
  $$select waytara.ingest_device_tick('e1000000-0000-0000-0000-000000000001', 'wrong-wrong-wrong-wrong', p_values => '{"p": 8}')$$,
  '28000', null, 'a wrong token is refused');
select throws_ok(
  $$select waytara.ingest_device_tick('e2000000-0000-0000-0000-000000000002', 'a-long-device-secret-1', p_values => '{"p": 9}')$$,
  '28000', null, 'one device''s token does not work for another equipment');
select throws_ok(
  $$select waytara.ingest_device_tick('e1000000-0000-0000-0000-000000000001', 'short', p_values => '{"p": 9}')$$,
  '28000', null, 'a short token is refused');
select throws_ok(
  $$select count(*) from waytara.equipment_ingest_tokens$$,
  '42501', null, 'anon cannot read the token table');

-- finished buckets go through the same path as the Python agent's
select is(
  (select (waytara.ingest_device_tick('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1',
     p_closed => jsonb_build_array(jsonb_build_object('k', 'pv1_power_w', 'b', to_timestamp(floor(extract(epoch from now()) / 900) * 900 - 900),
                                                      'w', 900, 'c', 900, 'mn', 1, 'mx', 1, 'l', 1, 'n', 3)))
   ->> 'closed_written')::int),
  1, 'a finished 15-minute bucket is stored');

reset role;

select is((select value from waytara.equipment_latest where equipment_id = :e1 and key_name = 'p'), 7::numeric, 'the accepted value is stored');
select ok((select last_seen from waytara.equipment_heartbeat where equipment_id = :e1) > now() - interval '1 minute', 'and the heartbeat moves');
select is((select count(*)::int from waytara.equipment_rollup_15m where equipment_id = :e1 and key_name = 'pv1_power_w'), 1, 'and the bucket is in the rollup table');

select * from finish();
rollback;
