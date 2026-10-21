-- Bluetooth access: which level each kind of person gets for a unit, nobody else gets one, only the backend identity asks, and every request is
-- written to the activity log. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('50000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'backendf1@test.local'),
  ('a0000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adminf1@test.local'),
  ('e0000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stafff1@test.local'),
  ('e0000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staffother@test.local'),
  ('c1000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'custf1@test.local'),
  ('c1000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'custother@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-0000000000f1', 'adminf1@test.local', 'admin', 'Admin F'),
  ('e0000000-0000-0000-0000-0000000000f1', 'stafff1@test.local', 'employee', 'Staff F'),
  ('e0000000-0000-0000-0000-0000000000f2', 'staffother@test.local', 'employee', 'Staff Other'),
  ('c1000000-0000-0000-0000-0000000000f1', 'custf1@test.local', 'customer', 'Customer F'),
  ('c1000000-0000-0000-0000-0000000000f2', 'custother@test.local', 'customer', 'Customer Other');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000f1'), ('c1000000-0000-0000-0000-0000000000f2');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000f1', 'c1000000-0000-0000-0000-0000000000f1', 'Site F', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-0000000000f1', 'Inverter', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id, label, device_status) values
  ('e1000000-0000-0000-0000-0000000000f1', '51000000-0000-0000-0000-0000000000f1', '99000000-0000-0000-0000-0000000000f1', 'Unit', 'active');
insert into waytara.site_staff (site_id, staff_id) values ('51000000-0000-0000-0000-0000000000f1', 'e0000000-0000-0000-0000-0000000000f1');
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000f1', 'test backend');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_ble_access('a0000000-0000-0000-0000-0000000000f1', 'e1000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'a person cannot ask for a grant level, only the backend identity');

select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is(waytara.gw_ble_access('a0000000-0000-0000-0000-0000000000f1', 'e1000000-0000-0000-0000-0000000000f1'), 'admin', 'an admin gets the admin level');
select is(waytara.gw_ble_access('e0000000-0000-0000-0000-0000000000f1', 'e1000000-0000-0000-0000-0000000000f1'), 'service', 'staff assigned to the site get the service level');
select is(waytara.gw_ble_access('c1000000-0000-0000-0000-0000000000f1', 'e1000000-0000-0000-0000-0000000000f1'), 'network', 'the customer who owns the site gets the network level');
select is(waytara.gw_ble_access('e0000000-0000-0000-0000-0000000000f2', 'e1000000-0000-0000-0000-0000000000f1'), null, 'staff not assigned to the site get nothing');
select is(waytara.gw_ble_access('c1000000-0000-0000-0000-0000000000f2', 'e1000000-0000-0000-0000-0000000000f1'), null, 'another customer gets nothing');
select is(waytara.gw_ble_access('a0000000-0000-0000-0000-0000000000f1', 'e1000000-0000-0000-0000-0000000000ff'), null, 'a unit that does not exist gives nothing');
reset role;
select is((select count(*)::int from waytara.device_activity where equipment_id = 'e1000000-0000-0000-0000-0000000000f1' and action = 'bluetooth_access'), 3, 'each granted request is in the activity log, refused ones are not');
select is((select details ->> 'level' from waytara.device_activity where actor_id = 'e0000000-0000-0000-0000-0000000000f1' and action = 'bluetooth_access'), 'service', 'with the level that was given');

select * from finish();
rollback;
