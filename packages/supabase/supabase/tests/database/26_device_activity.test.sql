-- The activity log: filled by triggers on key events, site access, offline alerts and setting changes, and by log_device_activity() for
-- what only the setup page knows; seen by the owner, the staff assigned to the site and admins; technical detail hidden from customers.
-- Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(22);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin6@test.local'),
  ('c1000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust1-6@test.local'),
  ('c2000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust2-6@test.local'),
  ('e1000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp1-6@test.local'),
  ('e2000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp2-6@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-0000000000a6', 'admin6@test.local', 'admin', 'Admin Six'),
  ('c1000000-0000-0000-0000-0000000000a6', 'cust1-6@test.local', 'customer', 'Customer One'),
  ('c2000000-0000-0000-0000-0000000000a6', 'cust2-6@test.local', 'customer', 'Customer Two'),
  ('e1000000-0000-0000-0000-0000000000a6', 'emp1-6@test.local', 'employee', 'Employee One'),
  ('e2000000-0000-0000-0000-0000000000a6', 'emp2-6@test.local', 'employee', 'Employee Two');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000a6'), ('c2000000-0000-0000-0000-0000000000a6');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000a6', 'c1000000-0000-0000-0000-0000000000a6', 'Site A', 'residential_independent_villas', 'hybrid'),
  ('52000000-0000-0000-0000-0000000000a6', 'c2000000-0000-0000-0000-0000000000a6', 'Site B', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-0000000000a6', 'Inverter', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id, label, device_status) values
  ('e1000000-0000-0000-0000-0000000000b6', '51000000-0000-0000-0000-0000000000a6', '99000000-0000-0000-0000-0000000000a6', 'Unit A', 'active'),
  ('e2000000-0000-0000-0000-0000000000b6', '52000000-0000-0000-0000-0000000000a6', '99000000-0000-0000-0000-0000000000a6', 'Unit B', 'active');

create or replace function pg_temp.n(p_action text, p_equipment uuid default null) returns int language sql as $$
  select count(*)::int from waytara.device_activity where action = p_action and (p_equipment is null or equipment_id = p_equipment)
$$;

-- ---- triggers ---------------------------------------------------------------------------------------------------------------------

insert into waytara.equipment_key_events (equipment_id, event, actor, detail) values
  ('e1000000-0000-0000-0000-0000000000b6', 'claimed', 'e1000000-0000-0000-0000-0000000000a6', '{}'),
  ('e1000000-0000-0000-0000-0000000000b6', 'rotated', 'a0000000-0000-0000-0000-0000000000a6', '{}'),
  ('e1000000-0000-0000-0000-0000000000b6', 'revoked', 'a0000000-0000-0000-0000-0000000000a6', '{"reason":"released"}'),
  ('e1000000-0000-0000-0000-0000000000b6', 'revoked', 'a0000000-0000-0000-0000-0000000000a6', '{"reason":"lost board"}'),
  ('e1000000-0000-0000-0000-0000000000b6', 'auth_failed', null, '{}');
select is(pg_temp.n('unit_claimed'), 1, 'a claim is logged');
select is((select actor_name from waytara.device_activity where action = 'unit_claimed'), 'Employee One', 'with the name of the person, kept as text');
select is(pg_temp.n('key_rotated'), 1, 'a key replacement is logged');
select is(pg_temp.n('unit_released') * 10 + pg_temp.n('key_revoked'), 11, 'a release and a plain revoke are told apart');
select is((select count(*)::int from waytara.device_activity where equipment_id = 'e1000000-0000-0000-0000-0000000000b6'), 4, 'a failed key attempt is not an activity');

insert into waytara.site_staff (site_id, staff_id, granted_by, expires_at) values
  ('51000000-0000-0000-0000-0000000000a6', 'e1000000-0000-0000-0000-0000000000a6', 'a0000000-0000-0000-0000-0000000000a6', now() + interval '30 days');
select is(pg_temp.n('access_granted'), 1, 'giving a staff member access to a site is logged, with its end date');
update waytara.site_staff set removed_at = now() where staff_id = 'e1000000-0000-0000-0000-0000000000a6';
select is(pg_temp.n('access_removed'), 1, 'and removing it is logged');
-- (put the assignment back for the visibility checks)
insert into waytara.site_staff (site_id, staff_id, granted_by) values
  ('51000000-0000-0000-0000-0000000000a6', 'e1000000-0000-0000-0000-0000000000a6', 'a0000000-0000-0000-0000-0000000000a6');

insert into waytara.alerts (device_id, severity, message) values ('e1000000-0000-0000-0000-0000000000b6', 'critical', 'Device offline: Unit A has stopped reporting');
select is(pg_temp.n('device_offline', 'e1000000-0000-0000-0000-0000000000b6'), 1, 'an offline alert is logged');
update waytara.alerts set resolved_at = now() where device_id = 'e1000000-0000-0000-0000-0000000000b6';
select is(pg_temp.n('device_online', 'e1000000-0000-0000-0000-0000000000b6'), 1, 'and so is its return');
insert into waytara.alerts (device_id, severity, message) values ('e1000000-0000-0000-0000-0000000000b6', 'warning', 'Device fault: something');
select is(pg_temp.n('device_offline', 'e1000000-0000-0000-0000-0000000000b6'), 1, 'a fault alert is not an offline event');

insert into waytara.equipment_configs (equipment_id, setting_category, key_name, setting_value, source, written_by) values
  ('e1000000-0000-0000-0000-0000000000b6', 'x', 'grid_charge_enabled', 'true', 'customer_dashboard', 'c1000000-0000-0000-0000-0000000000a6'),
  ('e1000000-0000-0000-0000-0000000000b6', 'x', 'grid_charge_enabled', 'true', 'agent_write_ok', null),
  ('e1000000-0000-0000-0000-0000000000b6', 'x', 'grid_charge_enabled', 'true', 'agent_initial_read', null);
select is(pg_temp.n('setting_requested') * 100 + pg_temp.n('setting_confirmed') * 10 + pg_temp.n('setting_failed'), 110, 'a requested change and the inverter''s confirmation are logged; a plain read is not');

-- ---- what the setup page may log -----------------------------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
select lives_ok($$select waytara.log_device_activity('e1000000-0000-0000-0000-0000000000b6', 'wifi_changed', 'Wi-Fi network changed to Home', '{"ssid":"Home"}', 'bluetooth')$$, 'a customer can log a Wi-Fi change on their own unit');
select throws_ok($$select waytara.log_device_activity('e2000000-0000-0000-0000-0000000000b6', 'wifi_changed', 'x', '{}', 'bluetooth')$$, '42501', null, 'but not on someone else''s unit');
select throws_ok($$select waytara.log_device_activity('e1000000-0000-0000-0000-0000000000b6', 'push_interval_changed', 'x', '{}', 'setup_page')$$, '42501', null, 'a customer cannot log a push-interval change');
select throws_ok($$select waytara.log_device_activity('e1000000-0000-0000-0000-0000000000b6', 'unit_claimed', 'x', '{}', 'setup_page')$$, '22023', null, 'the setup page cannot log a claim itself (the trigger does)');
select throws_ok($$select waytara.log_device_activity('e1000000-0000-0000-0000-0000000000b6', 'wifi_changed', 'x', '{"password":"hunter2"}', 'bluetooth')$$, '22023', null, 'a password in the details is refused');

-- ---- who sees what -------------------------------------------------------------------------------------------------------------------

select is((select count(*)::int from waytara.device_activity where site_id = '52000000-0000-0000-0000-0000000000a6'), 0, 'the owner sees nothing of another customer''s site');
select ok((select count(*)::int from waytara.device_activity_log where equipment_id = 'e1000000-0000-0000-0000-0000000000b6') > 5, 'the owner sees their own unit''s history');
select is((select count(*)::int from waytara.device_activity_log where details is not null), 0, 'and the technical detail is hidden from them');

select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
select ok((select count(*)::int from waytara.device_activity_log where details is not null) > 0, 'assigned staff see the technical detail');
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
select is((select count(*)::int from waytara.device_activity), 0, 'staff who are not assigned to the site see nothing');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
select ok((select count(*)::int from waytara.device_activity) > 5, 'an admin sees it all');
reset role;

select * from finish();
rollback;
