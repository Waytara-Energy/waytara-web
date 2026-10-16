-- Task A5: who may read cadence data, and the labels in the catalogue. Rolled back at the end.
-- (Same rule as 15_*.test.sql: every assertion is one statement starting with "select <assertion>(" at the start of a line.)

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local'),
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  ('c2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@test.local'),
  ('c3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c3@test.local'),
  ('e1000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e1@test.local'),
  ('e2000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e2@test.local'),
  ('50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'svc@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.local', 'admin', 'Admin'),
  ('c1000000-0000-0000-0000-000000000001', 'c1@test.local', 'customer', 'C1'),
  ('c2000000-0000-0000-0000-000000000002', 'c2@test.local', 'customer', 'C2'),
  ('c3000000-0000-0000-0000-000000000003', 'c3@test.local', 'customer', 'C3'),
  ('e1000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'employee', 'E1'),
  ('e2000000-0000-0000-0000-0000000000e2', 'e2@test.local', 'employee', 'E2');
-- the two plans this test needs, with the features it relies on (a fresh database does not carry the seeded plans; on the live one this
-- only changes them inside the rolled-back transaction)
insert into waytara.plans (code, name, max_devices, price_monthly, price_yearly, features, is_active) values
  ('advance', 'Advance', null, 2999, 29990, '{"reports": true}'::jsonb, true),
  ('pro', 'Pro', 10, 1499, 14990, '{"reports": false}'::jsonb, true)
on conflict (code) do update set features = excluded.features;
insert into waytara.customers (id, plan_id) values
  ('c1000000-0000-0000-0000-000000000001', (select id from waytara.plans where code = 'advance')),
  ('c2000000-0000-0000-0000-000000000002', (select id from waytara.plans where code = 'pro')),
  ('c3000000-0000-0000-0000-000000000003', null);
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'S1', 'residential_independent_villas', 'hybrid'),
  ('52000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'S2', 'residential_independent_villas', 'hybrid'),
  ('53000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000003', 'S3', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category, technical_specs) values
  ('99000000-0000-0000-0000-000000000009', 'Inv', 'solar_inverter', '{"mppt_count": 2}');
insert into waytara.equipment (id, site_id, stock_id, label) values
  ('91000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009', 'Advance unit'),
  ('92000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', '99000000-0000-0000-0000-000000000009', 'Pro unit'),
  ('93000000-0000-0000-0000-000000000003', '53000000-0000-0000-0000-000000000003', '99000000-0000-0000-0000-000000000009', 'No plan unit');
insert into waytara.site_staff (site_id, staff_id) values ('51000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000e1');
insert into waytara.equipment_templates (category, dashboard_section, device_category, key_name, display_name, direction, value_kind, unit)
  values ('Test', 'Monitoring', 'solar', 'raw1', 'Raw one', 'read', 'number', 'W');
insert into waytara.equipment_metrics (equipment_id, key_name, category, device_category, direction, address, decode, cadence_seconds)
  values ('91000000-0000-0000-0000-000000000001', 'raw1', 'Power', 'solar', 'read', '{"registers": [100]}', '{"scale": 0.1}', 10);
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000a0', 'test backend');

-- ---- not for browsers
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_cadence_access('e1000000-0000-0000-0000-0000000000e1', '91000000-0000-0000-0000-000000000001')$$, '42501', null, 'a staff member cannot ask the backend function');
reset role;

-- ---- the backend identity
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);

select is(waytara.gw_cadence_access('a0000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002'), 'staff', 'an admin reads every register of any unit');
select is(waytara.gw_cadence_access('e1000000-0000-0000-0000-0000000000e1', '91000000-0000-0000-0000-000000000001'), 'staff', 'an employee assigned to the site reads every register');
select is(waytara.gw_cadence_access('e1000000-0000-0000-0000-0000000000e1', '92000000-0000-0000-0000-000000000002'), null::text, 'but not on a site they are not assigned to');
select is(waytara.gw_cadence_access('e2000000-0000-0000-0000-0000000000e2', '91000000-0000-0000-0000-000000000001'), null, 'and an unassigned employee reads nothing');
select is(waytara.gw_cadence_access('c1000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001'), 'customer', 'a customer on a plan with reports reads their own unit, as a customer');
select is(waytara.gw_cadence_access('c2000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002'), null::text, 'a customer on a plan without reports reads nothing');
select is(waytara.gw_cadence_access('c3000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000003'), null::text, 'neither does a customer with no plan');
select is(waytara.gw_cadence_access('c1000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002'), null::text, 'a customer never reads another customer''s unit');
select is(waytara.gw_cadence_access('a0000000-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000000'), null::text, 'unknown equipment gives nothing, even to an admin');
select is(waytara.gw_cadence_access('99999999-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000001'), null::text, 'and an unknown person gives nothing');

-- an assignment that has ended stops access
reset role;
update waytara.site_staff set removed_at = now() where staff_id = 'e1000000-0000-0000-0000-0000000000e1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is(waytara.gw_cadence_access('e1000000-0000-0000-0000-0000000000e1', '91000000-0000-0000-0000-000000000001'), null::text, 'an ended assignment stops access');

-- the catalogue carries names and units
select is((select waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001') #>> '{metrics,0,label}'), 'Raw one', 'the profile carries the display name');
select is((select waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001') #>> '{metrics,0,unit}'), 'W', 'and the unit');
select is((select waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001') #>> '{metrics,0,category}'), 'Power', 'and the group it belongs to');
select is((select waytara.gw_equipment_profile('91000000-0000-0000-0000-000000000001') #>> '{metrics,0,show_for_user}'), 'true', 'and whether customers see it');
reset role;

select * from finish();
rollback;
