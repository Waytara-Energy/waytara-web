-- The agent's own check-in rhythm (heartbeat_s) is stored, kept when a later upload does not repeat it, and a
-- check-in with no values moves last_seen without touching the live values. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(6);

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

select waytara.ingest_tick(:e1, now(), '{"p": 5}', '{}', '[]', '{"interval_s": 900, "heartbeat_s": 60, "device_online": true}');
select is((select heartbeat_s from waytara.equipment_heartbeat where equipment_id = :e1), 60, 'the check-in rhythm is stored');
select is((select upload_interval_s from waytara.equipment_heartbeat where equipment_id = :e1), 900, 'next to the upload interval');

-- a check-in: no values, only the agent's state
update waytara.equipment_heartbeat set last_seen = now() - interval '5 minutes' where equipment_id = :e1;
select waytara.ingest_tick(:e1, now(), '{}', '{}', '[]', '{"heartbeat_s": 60, "device_online": false, "device_error": "no route"}');
select ok((select last_seen from waytara.equipment_heartbeat where equipment_id = :e1) > now() - interval '1 minute', 'a check-in moves last_seen');
select is((select value from waytara.equipment_latest where equipment_id = :e1 and key_name = 'p'), 5::numeric, 'and leaves the live values alone');
select is((select upload_interval_s from waytara.equipment_heartbeat where equipment_id = :e1), 900, 'and does not erase the upload interval');

select waytara.ingest_tick(:e1, now(), '{}', '{}', '[]', '{"device_online": true}');
select is((select heartbeat_s from waytara.equipment_heartbeat where equipment_id = :e1), 60, 'a message that does not repeat the rhythm keeps it');

select * from finish();
rollback;
