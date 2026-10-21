-- The one heartbeat: offline alerts open after 2 minutes, not while the hub is down or just started, the e-mails queue once per event, reminders
-- come every 3 hours, "back online" only for a customer who was told, and the hub's own messages go to admins. Rolled back at the end.
-- The tick runs with p_io = false (no call to the hub or the mailer); the hub's state is set by hand.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(20);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f1@test.local'),
  ('c2000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f2@test.local');
insert into waytara.profiles (id, email, role, full_name, notification_preferences) values
  ('c1000000-0000-0000-0000-0000000000f1', 'f1@test.local', 'customer', 'F1', '{}'::jsonb),
  ('c2000000-0000-0000-0000-0000000000f2', 'f2@test.local', 'customer', 'F2', '{"email_alerts": false}'::jsonb);
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000f1'), ('c2000000-0000-0000-0000-0000000000f2');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000f1', 'c1000000-0000-0000-0000-0000000000f1', 'Site one', 'residential_independent_villas', 'hybrid'),
  ('52000000-0000-0000-0000-0000000000f2', 'c2000000-0000-0000-0000-0000000000f2', 'Site two', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values
  ('99000000-0000-0000-0000-0000000000f1', 'Inverter', 'solar_inverter'),
  ('99000000-0000-0000-0000-0000000000f2', 'Battery', 'battery');
insert into waytara.equipment (id, site_id, stock_id, label, device_status) values
  ('e1000000-0000-0000-0000-0000000000f1', '51000000-0000-0000-0000-0000000000f1', '99000000-0000-0000-0000-0000000000f1', 'E1', 'active'),
  ('e2000000-0000-0000-0000-0000000000f2', '51000000-0000-0000-0000-0000000000f1', '99000000-0000-0000-0000-0000000000f1', 'E2', 'active'),
  ('e3000000-0000-0000-0000-0000000000f3', '52000000-0000-0000-0000-0000000000f2', '99000000-0000-0000-0000-0000000000f1', 'E3', 'active'),
  ('e5000000-0000-0000-0000-0000000000f5', '51000000-0000-0000-0000-0000000000f1', '99000000-0000-0000-0000-0000000000f1', 'E5', 'active'),
  ('e4000000-0000-0000-0000-0000000000f4', '51000000-0000-0000-0000-0000000000f1', '99000000-0000-0000-0000-0000000000f2', 'E4 child', 'active');

-- E1, E2, E3, E5 check in (E4 is child equipment and has no heartbeat)
insert into waytara.equipment_heartbeat (equipment_id, last_seen, device_online, heartbeat_s, upload_interval_s, last_read_at)
select id, now(), true, 10, 900, now() from waytara.equipment where label in ('E1', 'E2', 'E3', 'E5');

-- a settled, healthy hub
update waytara.hub_health set hub_up = true, down_since = null, last_down_since = null, hub_uptime_s = 3600, consecutive_failures = 0;

create or replace function pg_temp.silent(p_label text, p_minutes int) returns void language sql as $$
  update waytara.equipment_heartbeat h set last_seen = now() - interval '10 minutes' where h.equipment_id = (select id from waytara.equipment where label = p_label);
  update waytara.equipment_heartbeat h set status_since = now() - make_interval(mins => p_minutes) where h.equipment_id = (select id from waytara.equipment where label = p_label);
$$;
create or replace function pg_temp.open_alerts(p_label text) returns int language sql as $$
  select count(*)::int from waytara.alerts a join waytara.equipment e on e.id = a.device_id where e.label = p_label and a.resolved_at is null and a.message like 'Device offline%'
$$;
create or replace function pg_temp.outbox(p_label text, p_kind text) returns int language sql as $$
  select count(*)::int from waytara.notification_outbox o join waytara.equipment e on e.id = o.device_id where e.label = p_label and o.kind = p_kind
$$;

-- 1. everything online: nothing happens
select waytara.fleet_tick(now(), false);
select is((select count(*)::int from waytara.alerts a join waytara.equipment e on e.id = a.device_id where e.label in ('E1', 'E2', 'E3', 'E5', 'E4 child') and a.message like 'Device offline%'), 0, 'devices that check in get no alert');
select is((select count(*)::int from waytara.notification_outbox where customer_id in ('c1000000-0000-0000-0000-0000000000f1', 'c2000000-0000-0000-0000-0000000000f2')), 0, 'and no e-mail is queued');

-- 2. silent for 1 minute: offline on the dashboard, but not an alert yet
select pg_temp.silent('E1', 1);
select waytara.fleet_tick(now(), false);
select is((select status from waytara.equipment_heartbeat where equipment_id = 'e1000000-0000-0000-0000-0000000000f1'), 'offline', 'a silent device is offline at once');
select is(pg_temp.open_alerts('E1'), 0, 'but a one-minute silence opens no alert');

-- 3. silent for 3 minutes: the alert and the first e-mail
select pg_temp.silent('E1', 3);
select waytara.fleet_tick(now(), false);
select is(pg_temp.open_alerts('E1'), 1, 'after 2 minutes offline an alert opens');
select is(pg_temp.outbox('E1', 'offline'), 1, 'and one e-mail is queued for the customer');
select is((select offline_since is not null from waytara.alerts a join waytara.equipment e on e.id = a.device_id where e.label = 'E1' and a.resolved_at is null), true, 'the alert remembers when the device went quiet');

-- 4. again: no second alert, no second e-mail
select waytara.fleet_tick(now(), false);
select is(pg_temp.open_alerts('E1') + pg_temp.outbox('E1', 'offline'), 2, 'running the tick again changes nothing');

-- 5. hub down, then just started, then settled
select pg_temp.silent('E2', 3);
update waytara.hub_health set hub_up = false, down_since = now() - interval '30 seconds', last_down_since = now() - interval '30 seconds';
select waytara.fleet_tick(now(), false);
select is(pg_temp.open_alerts('E2'), 0, 'no offline alert while the hub is down (the boards cannot reach it)');
update waytara.hub_health set hub_up = true, hub_uptime_s = 30, down_since = null;
select waytara.fleet_tick(now(), false);
select is(pg_temp.open_alerts('E2'), 0, 'nor in the hub''s first two minutes');
update waytara.hub_health set hub_uptime_s = 600;
select waytara.fleet_tick(now(), false);
select is(pg_temp.open_alerts('E2'), 1, 'then the alert opens');

-- 6. a customer who switched alert e-mails off: the alert exists, no e-mail
select pg_temp.silent('E3', 3);
select waytara.fleet_tick(now(), false);
select is(pg_temp.open_alerts('E3') * 10 + pg_temp.outbox('E3', 'offline'), 10, 'an alert opens for a customer with e-mails off, but nothing is queued');

-- 7. reminders: not before 3 hours, once, not when acknowledged
update waytara.alerts set notified_count = 1, last_notified_at = now() - interval '2 hours' where device_id = 'e1000000-0000-0000-0000-0000000000f1' and resolved_at is null;
select waytara.fleet_tick(now(), false);
select is(pg_temp.outbox('E1', 'still_offline'), 0, 'no reminder 2 hours after the last e-mail');
update waytara.alerts set last_notified_at = now() - interval '4 hours' where device_id = 'e1000000-0000-0000-0000-0000000000f1' and resolved_at is null;
select waytara.fleet_tick(now(), false);
select waytara.fleet_tick(now(), false);
select is(pg_temp.outbox('E1', 'still_offline'), 1, 'a reminder after 3 hours, queued once even if the tick runs twice');
update waytara.alerts set notified_count = 1, last_notified_at = now() - interval '4 hours', acknowledged_at = now() where device_id = 'e2000000-0000-0000-0000-0000000000f2' and resolved_at is null;
select waytara.fleet_tick(now(), false);
select is(pg_temp.outbox('E2', 'still_offline'), 0, 'an acknowledged alert gets no reminder');

-- 8. back online: told customer gets one message with the time down; a customer never told gets none
update waytara.equipment_heartbeat set last_seen = now(), device_online = true where equipment_id = 'e1000000-0000-0000-0000-0000000000f1';
select waytara.fleet_tick(now(), false);
select is(pg_temp.open_alerts('E1') * 10 + pg_temp.outbox('E1', 'back_online'), 10, 'a recovery that has held for less than a minute does not close the alert or send "back online"');
update waytara.equipment_heartbeat set status_since = now() - interval '2 minutes' where equipment_id = 'e1000000-0000-0000-0000-0000000000f1';
select waytara.fleet_tick(now(), false);
select is(pg_temp.open_alerts('E1') * 10 + pg_temp.outbox('E1', 'back_online'), 1, 'when the device is back the alert closes and one "back online" e-mail is queued');
select pg_temp.silent('E5', 3);
select waytara.fleet_tick(now(), false);
update waytara.equipment_heartbeat set last_seen = now(), device_online = true where equipment_id = 'e5000000-0000-0000-0000-0000000000f5';
update waytara.equipment_heartbeat set status_since = now() - interval '2 minutes' where equipment_id = 'e5000000-0000-0000-0000-0000000000f5';
select waytara.fleet_tick(now(), false);
select is(pg_temp.open_alerts('E5') * 10 + pg_temp.outbox('E5', 'back_online'), 0, 'a customer who was never e-mailed gets no "back online" e-mail');

-- 9. the hub's own messages go to admins
update waytara.hub_health set hub_up = false, down_since = now() - interval '3 minutes', last_down_since = now() - interval '3 minutes';
select waytara.fleet_tick(now(), false);
select is((select count(*)::int from waytara.notification_outbox where kind = 'hub_down' and audience = 'admin' and created_at >= now() - interval '1 minute'), 1, 'a hub that stays down for 2 minutes is announced to admins once');
update waytara.hub_health set hub_up = true, down_since = null;
select waytara.fleet_tick(now(), false);
select waytara.fleet_tick(now(), false);
select is((select count(*)::int from waytara.notification_outbox where kind = 'hub_back'), 1, 'and its return is announced once');

select * from finish();
rollback;
