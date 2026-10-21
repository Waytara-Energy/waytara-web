-- The setup page finds a unit's device by its hardware id: the owner, assigned staff and admins get it, nobody else, and an unknown unit looks the
-- same as somebody else's. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin3@test.local'),
  ('e0000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff3@test.local'),
  ('e0000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staffo3@test.local'),
  ('c1000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust3@test.local'),
  ('c1000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'custo3@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-0000000000f3', 'admin3@test.local', 'admin', 'Admin 3'),
  ('e0000000-0000-0000-0000-0000000000f3', 'staff3@test.local', 'employee', 'Staff 3'),
  ('e0000000-0000-0000-0000-0000000000f4', 'staffo3@test.local', 'employee', 'Staff Other 3'),
  ('c1000000-0000-0000-0000-0000000000f3', 'cust3@test.local', 'customer', 'Customer 3'),
  ('c1000000-0000-0000-0000-0000000000f4', 'custo3@test.local', 'customer', 'Customer Other 3');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000f3'), ('c1000000-0000-0000-0000-0000000000f4');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000f3', 'c1000000-0000-0000-0000-0000000000f3', 'Site Three', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-0000000000f3', 'Inverter', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id, label, device_status) values
  ('e1000000-0000-0000-0000-0000000000f3', '51000000-0000-0000-0000-0000000000f3', '99000000-0000-0000-0000-0000000000f3', 'Roof inverter', 'active');
insert into waytara.gateway_devices (equipment_id, hardware_id, fw_version) values ('e1000000-0000-0000-0000-0000000000f3', 'AABBCC0033F3', 'waytara-gw-0.3.0');
insert into waytara.site_staff (site_id, staff_id) values ('51000000-0000-0000-0000-0000000000f3', 'e0000000-0000-0000-0000-0000000000f3');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);
select is((select label from waytara.my_unit_by_hardware('AABBCC0033F3')), 'Roof inverter', 'the customer who owns the site gets the device');
select is((select site_name from waytara.my_unit_by_hardware('aabbcc0033f3')), 'Site Three', 'with its site, whatever the letter case');
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);
select is((select count(*)::int from waytara.my_unit_by_hardware('AABBCC0033F3')), 1, 'staff assigned to the site get it');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);
select is((select count(*)::int from waytara.my_unit_by_hardware('AABBCC0033F3')), 1, 'an admin gets it');
select is((select count(*)::int from waytara.my_unit_by_hardware('000000000000')), 0, 'an unknown unit gives nothing');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000f4","role":"authenticated"}', true);
select is((select count(*)::int from waytara.my_unit_by_hardware('AABBCC0033F3')), 0, 'another customer gets nothing, the same as for an unknown unit');
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-0000000000f4","role":"authenticated"}', true);
select is((select count(*)::int from waytara.my_unit_by_hardware('AABBCC0033F3')), 0, 'staff not assigned to the site get nothing');
reset role;

select * from finish();
rollback;
