-- Alert reminders and the agent's "why is the device silent" note. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(11);

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

-- device_error: kept while the device is silent, cleared when it answers
select waytara.ingest_tick(:e1, now(), '{"p": 5}', '{}', '[]', '{"interval_s": 900, "device_online": true, "device_error": "ignored while online"}');
select is((select device_error from waytara.equipment_heartbeat where equipment_id = :e1), null, 'no error is stored while the device answers');

select waytara.ingest_tick(:e1, now(), '{}', '{}', '[]', '{"interval_s": 900, "device_online": false, "device_error": "could not open a TCP connection to 192.168.29.200:502"}');
select is((select device_error from waytara.equipment_heartbeat where equipment_id = :e1), 'could not open a TCP connection to 192.168.29.200:502', 'the agent''s reason is stored when the device stops answering');

select waytara.ingest_tick(:e1, now(), '{}', '{}', '[]', '{"interval_s": 900, "device_online": false}');
select is((select device_error from waytara.equipment_heartbeat where equipment_id = :e1), 'could not open a TCP connection to 192.168.29.200:502', 'an upload without a reason keeps the last one');

select waytara.ingest_tick(:e1, now(), '{}', '{}', '[]', '{"interval_s": 900}');
select is((select device_error from waytara.equipment_heartbeat where equipment_id = :e1), 'could not open a TCP connection to 192.168.29.200:502', 'an upload that says nothing about the device keeps it too');

select waytara.ingest_tick(:e1, now(), '{"p": 6}', '{}', '[]', '{"interval_s": 900, "device_online": true}');
select is((select device_error from waytara.equipment_heartbeat where equipment_id = :e1), null, 'the reason is cleared as soon as the device answers again');

select waytara.ingest_tick(:e1, now(), '{}', '{}', '[]', jsonb_build_object('device_online', false, 'device_error', repeat('x', 500)));
select is(length((select device_error from waytara.equipment_heartbeat where equipment_id = :e1)), 300, 'a very long reason is cut to 300 characters');

-- alerts: the new columns
insert into waytara.alerts (id, device_id, severity, message) values ('a1000000-0000-0000-0000-000000000001', :e1, 'critical', 'Device offline: test');
select is((select notified_count from waytara.alerts where id = 'a1000000-0000-0000-0000-000000000001'), 0, 'a new alert starts with no e-mails sent');
select ok((select resolved_at is null and last_notified_at is null from waytara.alerts where id = 'a1000000-0000-0000-0000-000000000001'), 'and is open and un-notified');

-- a customer may acknowledge an alert but not change anything else about it
set local role authenticated;
select lives_ok($$ update waytara.alerts set acknowledged_at = now() where id = 'a1000000-0000-0000-0000-000000000001' $$, 'a signed-in user can acknowledge an alert');
select throws_ok($$ update waytara.alerts set resolved_at = now() where id = 'a1000000-0000-0000-0000-000000000001' $$, '42501', null, 'but cannot mark it resolved');
select throws_ok($$ update waytara.alerts set notified_count = 0 where id = 'a1000000-0000-0000-0000-000000000001' $$, '42501', null, 'or reset its reminder count');
reset role;

select * from finish();
rollback;
