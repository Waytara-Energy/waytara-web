-- Offline alerts that know why: the inverter line silent (the unit still checks in) is told apart from the unit silent (power or network); a change
-- of cause while the alert is open is recorded once it has held for 2 minutes (an unsent first e-mail is corrected, a sent one gets a follow-up);
-- running the tick again changes nothing; the back-online record says what the outage was and whether the unit restarted. Rolled back at the end.
-- The tick runs with p_io = false (no call to the hub or the mailer).

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a7@test.local');
insert into waytara.profiles (id, email, role, full_name, notification_preferences) values
  ('c1000000-0000-0000-0000-0000000000a7', 'a7@test.local', 'customer', 'A7', '{}'::jsonb);
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000a7');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000a7', 'c1000000-0000-0000-0000-0000000000a7', 'Site A7', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-0000000000a7', 'Inverter', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id, label, device_status) values
  ('e1000000-0000-0000-0000-0000000000a7', '51000000-0000-0000-0000-0000000000a7', '99000000-0000-0000-0000-0000000000a7', 'P1', 'active'),
  ('e2000000-0000-0000-0000-0000000000a7', '51000000-0000-0000-0000-0000000000a7', '99000000-0000-0000-0000-0000000000a7', 'P2', 'active');
insert into waytara.equipment_heartbeat (equipment_id, last_seen, device_online, heartbeat_s, upload_interval_s, last_read_at)
select id, now(), true, 10, 900, now() from waytara.equipment where label in ('P1', 'P2');
insert into waytara.gateway_devices (equipment_id, hardware_id, last_boot_at) values
  ('e1000000-0000-0000-0000-0000000000a7', 'AABBCC0077A1', now() - interval '10 days'),
  ('e2000000-0000-0000-0000-0000000000a7', 'AABBCC0077A2', now() - interval '10 days');
update waytara.hub_health set hub_up = true, down_since = null, last_down_since = null, hub_uptime_s = 3600, consecutive_failures = 0;

-- the unit checks in but the inverter does not answer (3 check-ins in a row)
create or replace function pg_temp.inverter_silent(p_label text, p_minutes int) returns void language sql as $$
  update waytara.equipment_heartbeat h set last_seen = now(), device_online = false, consecutive_failures = 3, device_error = 'The inverter is not answering the monitoring unit'
   where h.equipment_id = (select id from waytara.equipment where label = p_label);
  update waytara.equipment_heartbeat h set status_since = now() - make_interval(mins => p_minutes) where h.equipment_id = (select id from waytara.equipment where label = p_label);
$$;
-- the unit itself stopped checking in
create or replace function pg_temp.unit_silent(p_label text, p_minutes int) returns void language sql as $$
  update waytara.equipment_heartbeat h set last_seen = now() - interval '10 minutes' where h.equipment_id = (select id from waytara.equipment where label = p_label);
  update waytara.equipment_heartbeat h set status_since = now() - make_interval(mins => p_minutes) where h.equipment_id = (select id from waytara.equipment where label = p_label);
$$;
create or replace function pg_temp.all_good(p_label text) returns void language sql as $$
  update waytara.equipment_heartbeat h set last_seen = now(), device_online = true, consecutive_failures = 0, device_error = null where h.equipment_id = (select id from waytara.equipment where label = p_label);
$$;
create or replace function pg_temp.alert(p_label text) returns waytara.alerts language sql as $$
  select a.* from waytara.alerts a join waytara.equipment e on e.id = a.device_id where e.label = p_label order by a.ts desc limit 1
$$;
create or replace function pg_temp.rows(p_label text, p_kind text) returns int language sql as $$
  select count(*)::int from waytara.notification_outbox o join waytara.equipment e on e.id = o.device_id where e.label = p_label and o.kind = p_kind
$$;

-- ---- P2: the inverter line goes silent, then the unit does, then the unit is back but not the inverter, then all is well ---------------

select pg_temp.inverter_silent('P2', 3);
select waytara.fleet_tick(now(), false);
select ok(((pg_temp.alert('P2')).message) like '%RS485%', 'an inverter that does not answer opens an alert that names the cable');
select is(waytara._offline_cause((pg_temp.alert('P2')).message), 'device_unreachable', 'and the alert reads back as that cause');
select ok(((select summary from waytara.device_activity where equipment_id = 'e2000000-0000-0000-0000-0000000000a7' and action = 'device_offline' order by id limit 1) like '%inverter is not answering%'), 'the activity log says the inverter is not answering');
select is((select payload ->> 'status' from waytara.notification_outbox where device_id = 'e2000000-0000-0000-0000-0000000000a7' and kind = 'offline'), 'device_unreachable', 'and the queued e-mail carries that cause');

-- the unit goes silent as well: not acted on until the new cause has held for 2 minutes
select pg_temp.unit_silent('P2', 1);
select waytara.fleet_tick(now(), false);
select ok(((pg_temp.alert('P2')).message) like '%RS485%', 'a new cause that has held for one minute changes nothing yet');
select pg_temp.unit_silent('P2', 3);
select waytara.fleet_tick(now(), false);
select ok(((pg_temp.alert('P2')).message) like '%has stopped reporting%', 'after 2 minutes the alert says the unit stopped checking in');
select is(pg_temp.rows('P2', 'offline') * 10 + (select (payload ->> 'status' = 'offline')::int from waytara.notification_outbox where device_id = 'e2000000-0000-0000-0000-0000000000a7' and kind = 'offline'), 11,
          'the first e-mail was not sent yet, so it is corrected in place: still one row, now with the new cause');
select is((select count(*)::int from waytara.device_activity where equipment_id = 'e2000000-0000-0000-0000-0000000000a7' and action = 'device_offline'), 2, 'and the activity log has both events');

-- the first e-mail has gone; the unit comes back but the inverter stays silent: a follow-up is queued, once
update waytara.notification_outbox set sent_at = now() where device_id = 'e2000000-0000-0000-0000-0000000000a7' and kind = 'offline';
update waytara.alerts set notified_count = 1, last_notified_at = now() where device_id = 'e2000000-0000-0000-0000-0000000000a7' and resolved_at is null;
select pg_temp.inverter_silent('P2', 3);
select waytara.fleet_tick(now(), false);
select is(pg_temp.rows('P2', 'offline'), 2, 'a change of cause after the customer was told queues one follow-up');
select waytara.fleet_tick(now(), false);
select waytara.fleet_tick(now(), false);
select is(pg_temp.rows('P2', 'offline'), 2, 'running the tick again changes nothing');

-- all is well again
select pg_temp.all_good('P2');
select waytara.fleet_tick(now(), false);
select is((pg_temp.alert('P2')).resolved_at is not null, true, 'the alert closes when the device checks in and answers');
select is((select payload ->> 'was_status' from waytara.notification_outbox where device_id = 'e2000000-0000-0000-0000-0000000000a7' and kind = 'back_online'), 'device_unreachable', 'the back-online record says what the outage was (the last cause)');
select is((select (payload ->> 'restarted')::boolean from waytara.notification_outbox where device_id = 'e2000000-0000-0000-0000-0000000000a7' and kind = 'back_online'), false, 'and that the unit did not restart');

-- ---- P1: the unit goes silent and comes back WITH a new start: power was lost ----------------------------------------------------------

select pg_temp.unit_silent('P1', 3);
select waytara.fleet_tick(now(), false);
update waytara.alerts set notified_count = 1, last_notified_at = now() where device_id = 'e1000000-0000-0000-0000-0000000000a7' and resolved_at is null;
update waytara.gateway_devices set last_boot_at = now() where equipment_id = 'e1000000-0000-0000-0000-0000000000a7';
select pg_temp.all_good('P1');
select waytara.fleet_tick(now(), false);
select is((select (payload ->> 'restarted')::boolean from waytara.notification_outbox where device_id = 'e1000000-0000-0000-0000-0000000000a7' and kind = 'back_online'), true, 'a unit that came back with a new start is reported as restarted (power was lost)');

select * from finish();
rollback;
