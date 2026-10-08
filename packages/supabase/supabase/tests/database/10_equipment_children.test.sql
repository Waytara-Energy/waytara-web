-- Parent / child equipment: the rules, and the staff-only allocation that takes units off the stock. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(16);

\set c1 '''11111111-1111-1111-1111-111111111111'''
\set adm '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
\set s1 '''51000000-0000-0000-0000-000000000001'''
\set s2 '''51000000-0000-0000-0000-000000000002'''
\set inv1 '''e1000000-0000-0000-0000-000000000001'''
\set inv2 '''e2000000-0000-0000-0000-000000000002'''

insert into auth.users (id, instance_id, aud, role, email) values
  (:c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  (:adm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm@test.local');
insert into waytara.profiles (id, email, role, full_name) values (:c1, 'c1@test.local', 'customer', 'C1'), (:adm, 'adm@test.local', 'admin', 'Adm');
insert into waytara.customers (id) values (:c1);
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  (:s1, :c1, 'S1', 'residential_independent_villas', 'hybrid'), (:s2, :c1, 'S2', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category, quantity) values
  ('99000000-0000-0000-0000-000000000001', 'Inverter', 'solar_inverter', 5),
  ('99000000-0000-0000-0000-000000000002', 'Panel 550W', 'Solar Panels', 24),
  ('99000000-0000-0000-0000-000000000003', 'Battery', 'Batteries', 1);
insert into waytara.equipment (id, site_id, stock_id) values
  (:inv1, :s1, '99000000-0000-0000-0000-000000000001'),
  (:inv2, :s2, '99000000-0000-0000-0000-000000000001');

-- the inverter's lifetime discharge counter, which a battery's cycles count from
insert into waytara.equipment_latest (equipment_id, key_name, value, ts) values (:inv1, 'total_battery_discharge_energy_kwh', 40, now());

-- the rules (as the database owner, so only the trigger decides)
select lives_ok($$ insert into waytara.equipment (id, site_id, stock_id, parent_id, quantity) values ('c0000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 12) $$, 'panels can be a child of the inverter at the same site');
select throws_ok($$ insert into waytara.equipment (site_id, stock_id, parent_id) values ('51000000-0000-0000-0000-000000000002', '99000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001') $$, '23514', null, 'but not under an inverter at another site');
select throws_ok($$ insert into waytara.equipment (site_id, stock_id, parent_id) values ('51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001') $$, '23514', null, 'a child cannot have children');
select throws_ok($$ insert into waytara.equipment (site_id, stock_id, parent_id) values ('51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001') $$, '23514', null, 'an inverter cannot be a child');
select is((select quantity from waytara.equipment where id = 'c0000000-0000-0000-0000-000000000001'), 12, 'one row stands for all 12 panels');
select throws_ok($$ update waytara.equipment set discharged_baseline_kwh = -1 where id = 'c0000000-0000-0000-0000-000000000001' $$, '23514', null, 'a discharge baseline cannot be negative');

-- the allocation function
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :c1, 'role', 'authenticated')::text, true);
select throws_ok($$ select waytara.assign_child_equipment('e1000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000002', 1) $$, '42501', null, 'a customer cannot allocate equipment');

select set_config('request.jwt.claims', json_build_object('sub', :adm, 'role', 'authenticated')::text, true);
select lives_ok($$ select waytara.assign_child_equipment('e1000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000002', 10, 'Roof panels') $$, 'staff can allocate 10 panels');
select is((select quantity from waytara.equipment_inventory where id = '99000000-0000-0000-0000-000000000002'), 14, 'and they come off the stock');
select is((select parent_id::text from waytara.equipment where label = 'Roof panels'), 'e1000000-0000-0000-0000-000000000001', 'under that inverter');
select throws_ok($$ select waytara.assign_child_equipment('e1000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000002', 15) $$, '22023', null, 'more than is in stock is refused');
select throws_ok($$ select waytara.assign_child_equipment('e1000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000001', 1) $$, '22023', null, 'an inverter is added as a device, not as child equipment');
select lives_ok($$ select waytara.assign_child_equipment('e1000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000003', 1) $$, 'the last battery can be allocated');
select is((select status::text from waytara.equipment_inventory where id = '99000000-0000-0000-0000-000000000003'), 'allocated', 'and the stock item then shows as allocated');
select is((select discharged_baseline_kwh from waytara.equipment where stock_id = '99000000-0000-0000-0000-000000000003'), 40::numeric, 'a battery remembers the inverter''s discharge counter from the day it was allocated');
select is((select discharged_baseline_kwh from waytara.equipment where label = 'Roof panels'), null, 'panels have no baseline');

select * from finish();
rollback;
