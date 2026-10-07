-- The agent can be alive while the device it reads is off: heartbeat.last_seen = the agent, device_online /
-- last_read_at = the device. The live message carries the second pair. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(10);

\set c1 '''11111111-1111-1111-1111-111111111111'''
\set e1 '''e1000000-0000-0000-0000-000000000001'''

insert into auth.users (id, instance_id, aud, role, email) values
  (:c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local');
insert into waytara.profiles (id, email, role, full_name) values (:c1, 'c1@test.local', 'customer', 'C1');
insert into waytara.customers (id) values (:c1);
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', :c1, 'S1', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-000000000009', 'Inv', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id) values (:e1, '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009');

-- an upload while the device answers
select waytara.ingest_tick(:e1, now(), '{"p": 5}', '{}', '[]',
  jsonb_build_object('interval_s', 900, 'version', 't', 'device_online', true, 'last_read_at', now() - interval '3 seconds'));
select is((select device_online from waytara.equipment_heartbeat where equipment_id = :e1), true, 'the heartbeat records that the device answered');
select ok((select last_read_at from waytara.equipment_heartbeat where equipment_id = :e1) > now() - interval '1 minute',
  'and when it last answered');

-- the device goes off: the agent still uploads, but with no values and the old last_read_at
update waytara.equipment_heartbeat set last_seen = now() - interval '10 minutes' where equipment_id = :e1;   -- as if the last upload was a while ago
create temp table before_off as select last_read_at, last_seen from waytara.equipment_heartbeat where equipment_id = :e1;
grant select on before_off to public;
select waytara.ingest_tick(:e1, now(), '{}', '{}', '[]',
  jsonb_build_object('interval_s', 900, 'version', 't', 'device_online', false, 'last_read_at', (select last_read_at from before_off)));
select is((select device_online from waytara.equipment_heartbeat where equipment_id = :e1), false, 'the heartbeat records that the device stopped answering');
select is((select last_read_at from waytara.equipment_heartbeat where equipment_id = :e1), (select last_read_at from before_off),
  'last_read_at stays at the last real reading');
select ok((select last_seen from waytara.equipment_heartbeat where equipment_id = :e1) > (select last_seen from before_off),
  'last_seen still moves: the agent is alive');
select is((select value from waytara.equipment_latest where equipment_id = :e1 and key_name = 'p'), 5::numeric,
  'the last known value is kept, with its old timestamp');

-- an older last_read_at never moves it backwards; an agent that does not report connectivity changes nothing
select waytara.ingest_tick(:e1, now(), '{}', '{}', '[]', jsonb_build_object('device_online', true, 'last_read_at', now() - interval '2 days'));
select ok((select last_read_at from waytara.equipment_heartbeat where equipment_id = :e1) >= (select last_read_at from before_off), 'last_read_at never goes backwards');
select waytara.ingest_tick(:e1, now(), '{}', '{}', '[]', '{"interval_s": 900}');
select is((select device_online from waytara.equipment_heartbeat where equipment_id = :e1), true, 'an upload without connectivity info leaves it as it was');

-- the live message carries it, even when there are no values
select ok(
  coalesce((select (payload -> 'agent' ->> 'device_online')::boolean from realtime.messages
            where topic = 'device:' || :e1 order by inserted_at desc limit 1), false) is not null
  and exists (select 1 from realtime.messages where topic = 'device:' || :e1 and payload -> 'agent' ? 'last_read_at'),
  'the live message includes the device state and last reading time');
select ok(exists (select 1 from realtime.messages where topic = 'device:' || :e1 and (payload -> 'agent' ->> 'device_online') = 'false'),
  'an upload with no values still sends the "device offline" message');

select * from finish();
rollback;
