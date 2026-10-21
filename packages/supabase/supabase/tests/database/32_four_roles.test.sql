-- The four kinds of person (customer, employee, installer = site engineer, admin) against what the setup page and the hub rely on: the Bluetooth
-- level each gets, finding a unit's device, who may manage keys, what the activity log shows (technical detail hidden from the customer), and
-- that an assignment that has ended, or a site that is not theirs, gives nothing. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(22);

insert into auth.users (id, instance_id, aud, role, email) values
  ('50000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'backend5@test.local'),
  ('a0000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin5@test.local'),
  ('e0000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp5@test.local'),
  ('e0000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inst5@test.local'),
  ('e0000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'empended5@test.local'),
  ('c1000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust5@test.local'),
  ('c1000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'custother5@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-0000000000f5', 'admin5@test.local', 'admin', 'Admin Five'),
  ('e0000000-0000-0000-0000-0000000000f5', 'emp5@test.local', 'employee', 'Employee Five'),
  ('e0000000-0000-0000-0000-0000000000f6', 'inst5@test.local', 'site_engineer', 'Installer Five'),
  ('e0000000-0000-0000-0000-0000000000f7', 'empended5@test.local', 'employee', 'Employee Ended'),
  ('c1000000-0000-0000-0000-0000000000f5', 'cust5@test.local', 'customer', 'Customer Five'),
  ('c1000000-0000-0000-0000-0000000000f6', 'custother5@test.local', 'customer', 'Customer Other');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000f5'), ('c1000000-0000-0000-0000-0000000000f6');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000f5', 'c1000000-0000-0000-0000-0000000000f5', 'Site Five', 'residential_independent_villas', 'hybrid'),
  ('52000000-0000-0000-0000-0000000000f5', 'c1000000-0000-0000-0000-0000000000f6', 'Site Other', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-0000000000f5', 'Inverter', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id, label, device_status) values
  ('e1000000-0000-0000-0000-0000000000f5', '51000000-0000-0000-0000-0000000000f5', '99000000-0000-0000-0000-0000000000f5', 'Unit Five', 'active'),
  ('e2000000-0000-0000-0000-0000000000f5', '52000000-0000-0000-0000-0000000000f5', '99000000-0000-0000-0000-0000000000f5', 'Unit Other', 'active');
insert into waytara.gateway_devices (equipment_id, hardware_id) values
  ('e1000000-0000-0000-0000-0000000000f5', 'AABBCC0055F5'),
  ('e2000000-0000-0000-0000-0000000000f5', 'AABBCC0055F6');
-- the employee and the installer are assigned to Site Five; the third staff member's assignment ended yesterday
insert into waytara.site_staff (site_id, staff_id, granted_by, expires_at) values
  ('51000000-0000-0000-0000-0000000000f5', 'e0000000-0000-0000-0000-0000000000f5', 'a0000000-0000-0000-0000-0000000000f5', now() + interval '30 days'),
  ('51000000-0000-0000-0000-0000000000f5', 'e0000000-0000-0000-0000-0000000000f6', 'a0000000-0000-0000-0000-0000000000f5', null),
  ('51000000-0000-0000-0000-0000000000f5', 'e0000000-0000-0000-0000-0000000000f7', 'a0000000-0000-0000-0000-0000000000f5', now() + interval '1 hour');
update waytara.site_staff set granted_at = now() - interval '10 days', expires_at = now() - interval '1 day' where staff_id = 'e0000000-0000-0000-0000-0000000000f7';
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000f5', 'test backend');
-- one row of activity with technical detail
select waytara._record_activity('e1000000-0000-0000-0000-0000000000f5', null, 'a0000000-0000-0000-0000-0000000000f5', 'admin', 'key_rotated', 'The key was replaced', '{"key_id":"secret-looking-detail"}', '10.1.2.3');

-- ---- the hub's view: Bluetooth level and who may manage keys ------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000f5","role":"authenticated"}', true);
select is(waytara.gw_ble_access('c1000000-0000-0000-0000-0000000000f5', 'e1000000-0000-0000-0000-0000000000f5'), 'network', 'customer: view and Wi-Fi');
select is(waytara.gw_ble_access('e0000000-0000-0000-0000-0000000000f5', 'e1000000-0000-0000-0000-0000000000f5'), 'service', 'employee at the site: service');
select is(waytara.gw_ble_access('e0000000-0000-0000-0000-0000000000f6', 'e1000000-0000-0000-0000-0000000000f5'), 'service', 'installer at the site: service');
select is(waytara.gw_ble_access('a0000000-0000-0000-0000-0000000000f5', 'e1000000-0000-0000-0000-0000000000f5'), 'admin', 'admin: everything');
select is(waytara.gw_ble_access('e0000000-0000-0000-0000-0000000000f7', 'e1000000-0000-0000-0000-0000000000f5'), null, 'staff whose assignment has ended: nothing');
select is(waytara.gw_ble_access('c1000000-0000-0000-0000-0000000000f6', 'e1000000-0000-0000-0000-0000000000f5'), null, 'another customer: nothing');
select is(waytara.gw_ble_access('e0000000-0000-0000-0000-0000000000f5', 'e2000000-0000-0000-0000-0000000000f5'), null, 'staff at another site: nothing');
select is(waytara.gw_actor_can_manage_keys('c1000000-0000-0000-0000-0000000000f5', 'e1000000-0000-0000-0000-0000000000f5'), false, 'the customer cannot manage keys (nor the push interval)');
select is(waytara.gw_actor_can_manage_keys('e0000000-0000-0000-0000-0000000000f6', 'e1000000-0000-0000-0000-0000000000f5'), true, 'the installer at the site can');
select is(waytara.gw_actor_can_manage_keys('e0000000-0000-0000-0000-0000000000f7', 'e1000000-0000-0000-0000-0000000000f5'), false, 'staff whose assignment has ended cannot');

-- ---- finding a unit's device from the phone ----------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000f5","role":"authenticated"}', true);
select is((select count(*)::int from waytara.my_unit_by_hardware('AABBCC0055F5')), 1, 'customer: finds their own unit');
select is((select count(*)::int from waytara.my_unit_by_hardware('AABBCC0055F6')), 0, 'customer: the other site''s unit looks unknown');
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-0000000000f6","role":"authenticated"}', true);
select is((select count(*)::int from waytara.my_unit_by_hardware('AABBCC0055F5')), 1, 'installer: finds the unit at the assigned site');
select is((select count(*)::int from waytara.my_unit_by_hardware('AABBCC0055F6')), 0, 'installer: not the other one');
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-0000000000f7","role":"authenticated"}', true);
select is((select count(*)::int from waytara.my_unit_by_hardware('AABBCC0055F5')), 0, 'staff whose assignment ended: nothing');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000f5","role":"authenticated"}', true);
select is((select count(*)::int from waytara.my_unit_by_hardware('AABBCC0055F6')), 1, 'admin: any unit');

-- ---- what each sees of the activity log ----------------------------------------------------------------------------------------------
select is((select details ->> 'key_id' from waytara.device_activity_log where equipment_id = 'e1000000-0000-0000-0000-0000000000f5' and action = 'key_rotated'), 'secret-looking-detail', 'admin sees the technical detail');
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-0000000000f5","role":"authenticated"}', true);
select is((select ip::text from waytara.device_activity_log where equipment_id = 'e1000000-0000-0000-0000-0000000000f5' and action = 'key_rotated'), '10.1.2.3/32', 'employee sees the detail and address too');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000f5","role":"authenticated"}', true);
select is((select summary from waytara.device_activity_log where equipment_id = 'e1000000-0000-0000-0000-0000000000f5' and action = 'key_rotated'), 'The key was replaced', 'customer sees the sentence');
select is((select details is null and ip is null from waytara.device_activity_log where equipment_id = 'e1000000-0000-0000-0000-0000000000f5' and action = 'key_rotated'), true, 'but not the detail or the address');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000f6","role":"authenticated"}', true);
select is((select count(*)::int from waytara.device_activity_log where equipment_id = 'e1000000-0000-0000-0000-0000000000f5'), 0, 'another customer sees nothing of it');
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-0000000000f7","role":"authenticated"}', true);
select is((select count(*)::int from waytara.device_activity_log where equipment_id = 'e1000000-0000-0000-0000-0000000000f5'), 0, 'nor staff whose assignment has ended');
reset role;

select * from finish();
rollback;
