-- Renaming a device: the owner, assigned staff and admins may; nobody else; the name is tidied and limited; each change is in the activity log.
-- Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(10);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust8@test.local'),
  ('c1000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'custo8@test.local'),
  ('e0000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp8@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('c1000000-0000-0000-0000-0000000000f8', 'cust8@test.local', 'customer', 'Customer Eight'),
  ('c1000000-0000-0000-0000-0000000000f9', 'custo8@test.local', 'customer', 'Customer Other'),
  ('e0000000-0000-0000-0000-0000000000f8', 'emp8@test.local', 'employee', 'Employee Eight');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000f8'), ('c1000000-0000-0000-0000-0000000000f9');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000f8', 'c1000000-0000-0000-0000-0000000000f8', 'Site Eight', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-0000000000f8', 'Inverter', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id, label, device_status) values
  ('e1000000-0000-0000-0000-0000000000f8', '51000000-0000-0000-0000-0000000000f8', '99000000-0000-0000-0000-0000000000f8', 'Old name', 'active');
insert into waytara.site_staff (site_id, staff_id, granted_by) values ('51000000-0000-0000-0000-0000000000f8', 'e0000000-0000-0000-0000-0000000000f8', 'c1000000-0000-0000-0000-0000000000f8');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000f8","role":"authenticated"}', true);
select is(waytara.rename_device('e1000000-0000-0000-0000-0000000000f8', '  Roof   inverter  '), 'Roof inverter', 'the owner renames it; spaces are tidied');
select is((select label from waytara.equipment where id = 'e1000000-0000-0000-0000-0000000000f8'), 'Roof inverter', 'and the new name is stored');
select throws_ok($$select waytara.rename_device('e1000000-0000-0000-0000-0000000000f8', '   ')$$, '22023', null, 'an empty name is refused');
select throws_ok($$select waytara.rename_device('e1000000-0000-0000-0000-0000000000f8', repeat('x', 61))$$, '22023', null, 'so is one over 60 characters');
select is(waytara.rename_device('e1000000-0000-0000-0000-0000000000f8', 'Roof inverter'), 'Roof inverter', 'the same name again is accepted');
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-0000000000f8","role":"authenticated"}', true);
select is(waytara.rename_device('e1000000-0000-0000-0000-0000000000f8', 'Main inverter'), 'Main inverter', 'staff assigned to the site rename it');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000f9","role":"authenticated"}', true);
select throws_ok($$select waytara.rename_device('e1000000-0000-0000-0000-0000000000f8', 'Mine now')$$, '42501', null, 'another customer cannot');
reset role;
select is((select label from waytara.equipment where id = 'e1000000-0000-0000-0000-0000000000f8'), 'Main inverter', 'and nothing changed');
select is((select count(*)::int from waytara.device_activity where equipment_id = 'e1000000-0000-0000-0000-0000000000f8' and action = 'device_renamed'), 2, 'each real change is in the activity log (not the repeat)');
select is((select summary from waytara.device_activity where equipment_id = 'e1000000-0000-0000-0000-0000000000f8' and action = 'device_renamed' order by id desc limit 1), 'The device was renamed from "Roof inverter" to "Main inverter"', 'in plain words');

select * from finish();
rollback;
