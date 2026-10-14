-- Go Live for the ESP32: only someone who can see the device can ask for it, the unit's ticks are token-checked and only go out
-- while someone is watching, and the check-in answer says whether to stream. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(9);

\set c1 '''11111111-1111-1111-1111-111111111111'''
\set c2 '''22222222-2222-2222-2222-222222222222'''
\set e1 '''e1000000-0000-0000-0000-000000000001'''

insert into auth.users (id, instance_id, aud, role, email) values
  (:c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  (:c2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@test.local');
insert into waytara.profiles (id, email, role, full_name) values (:c1, 'c1@test.local', 'customer', 'C1'), (:c2, 'c2@test.local', 'customer', 'C2');
insert into waytara.customers (id) values (:c1), (:c2);
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', :c1, 'S1', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-000000000009', 'Inv', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id) values (:e1, '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009');
insert into waytara.equipment_ingest_tokens (equipment_id, token_hash)
values (:e1, encode(sha256(convert_to('a-long-device-secret-1', 'utf8')), 'hex'));

-- nobody is watching yet
set local role anon;
select is(
  waytara.device_live_tick('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1', 1000, '{"pv1_power_w": 5}') ->> 'live',
  'false', 'no viewer: the unit is told to stop streaming');
select throws_ok(
  $$select waytara.device_live_tick('e1000000-0000-0000-0000-000000000001', 'wrong-wrong-wrong-wrong', 1000, '{"pv1_power_w": 5}')$$,
  '28000', null, 'a wrong token is refused');
select is(
  waytara.ingest_device_tick('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1') ->> 'live',
  'false', 'the check-in answer says nobody is watching');
reset role;

-- another customer cannot ask for this device's stream
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok(
  $$select waytara.request_live('e1000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'a customer who does not own the device cannot request live');

-- the owner can
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select ok(waytara.request_live('e1000000-0000-0000-0000-000000000001') > now(), 'the owner switches live on until a time in the future');
reset role;

set local role anon;
select is(
  waytara.ingest_device_tick('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1') ->> 'live',
  'true', 'now the check-in answer says to stream');
select is(
  waytara.device_live_tick('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1', 1000, '{"pv1_power_w": 5}') ->> 'live',
  'true', 'a tick is accepted while someone is watching');
select throws_ok(
  $$select waytara.device_live_tick('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1', 1000, '[1,2]')$$,
  '22023', null, 'a tick must be an object of readings');
select throws_ok(
  $$select * from waytara.equipment_live_requests$$,
  '42501', null, 'anon cannot read the live requests table');
reset role;

select * from finish();
rollback;
