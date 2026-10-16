-- Task A10: the database side of Go Live (gw_live_active, gw_live_tick). Rolled back at the end.
-- (Same rule as 15_*.test.sql: every assertion is one statement starting with "select <assertion>(" at the start of a line.)

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  ('e1000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e1@test.local'),
  ('50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'svc@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('c1000000-0000-0000-0000-000000000001', 'c1@test.local', 'customer', 'C1'),
  ('e1000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'employee', 'E1');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-000000000001');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'S1', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-000000000009', 'Inverter', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id, label) values
  ('91000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009', 'Inverter 1');
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000a0', 'test backend');

-- ---- nobody but the backend identity
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_live_active('91000000-0000-0000-0000-000000000001')$$, '42501', null, 'a staff member cannot ask whether someone is watching');
select throws_ok($$select waytara.gw_live_tick('91000000-0000-0000-0000-000000000001', 1, '{"pv1_power_w": 1}'::jsonb)$$, '42501', null, 'nor publish a tick');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_live_tick('91000000-0000-0000-0000-000000000001', 1, '{"pv1_power_w": 1}'::jsonb)$$, '42501', null, 'the owner of the site cannot either');
reset role;

-- ---- the backend identity
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);

select is(waytara.gw_live_active('91000000-0000-0000-0000-000000000001'), false, 'nobody is watching to begin with');
select is(waytara.gw_live_tick('91000000-0000-0000-0000-000000000001', 1, '{"pv1_power_w": 1}'::jsonb), false, 'so a tick is refused (the stream stops by itself)');
reset role;

-- a viewer asks (what request_live stores)
insert into waytara.equipment_live_requests (equipment_id, until) values ('91000000-0000-0000-0000-000000000001', now() + interval '60 seconds');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is(waytara.gw_live_active('91000000-0000-0000-0000-000000000001'), true, 'someone is watching now');
select throws_ok($$select waytara.gw_live_tick('91000000-0000-0000-0000-000000000001', 1, '[1,2]'::jsonb)$$, '22023', null, 'the readings must be an object');
reset role;

update waytara.equipment_live_requests set until = now() - interval '1 second';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is(waytara.gw_live_active('91000000-0000-0000-0000-000000000001'), false, 'and when the time runs out nobody is');
reset role;

select * from finish();
rollback;
