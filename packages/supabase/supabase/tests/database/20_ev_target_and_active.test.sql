-- Part B: target units and the sessions still open (picked up after a restart, closed when no stop ever came). Rolled back at the end.
-- (Same rule as 15_*.test.sql: every assertion is one statement starting with "select <assertion>(" at the start of a line.)

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(12);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  ('50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'svc@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('c1000000-0000-0000-0000-000000000001', 'c1@test.local', 'customer', 'C1');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-000000000001');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'S1', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-00000000000a', 'Charger', 'ev_charger');
insert into waytara.equipment (id, site_id, stock_id, label) values
  ('92000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-00000000000a', 'Charger 1'),
  ('93000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-00000000000a', 'Charger 2');
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000a0', 'test backend');

-- ---- not for browsers
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_ev_active_sessions('92000000-0000-0000-0000-000000000002')$$, '42501', null, 'a customer cannot list open sessions through the backend function');
select throws_ok($$select waytara.gw_ev_session_set_target(gen_random_uuid(), 5)$$, '42501', null, 'nor set a target through it');
reset role;

-- ---- the backend identity
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);

create temp table _s (id uuid);
grant all on _s to authenticated;
insert into _s select waytara.gw_ev_session_start('92000000-0000-0000-0000-000000000002', 1, 2001, now() - interval '5 minutes', 1000, 'taghash', 'WT_TEST_1');
select lives_ok($$select waytara.gw_ev_session_set_target((select id from _s), 10)$$, 'a target is set on a session');
select is((select (waytara.gw_ev_active_sessions('92000000-0000-0000-0000-000000000002') -> 0 ->> 'target_kwh')::numeric), 10::numeric, 'and read back with the open session');
select is((select waytara.gw_ev_active_sessions('92000000-0000-0000-0000-000000000002') -> 0 ->> 'transaction'), '2001', 'with its transaction number');
select is((select (waytara.gw_ev_active_sessions('92000000-0000-0000-0000-000000000002') -> 0 ->> 'meter_start_wh')::numeric), 1000::numeric, 'and where the meter started');
select is(waytara.gw_ev_active_sessions('93000000-0000-0000-0000-000000000003'), '[]'::jsonb, 'another charger has no open sessions');
select throws_ok($$select waytara.gw_ev_session_set_target((select id from _s), 0)$$, '22023', null, 'a target of zero is refused');
select throws_ok($$select waytara.gw_ev_session_set_target((select id from _s), 5000)$$, '22023', null, 'and one above 1000 kWh');
select throws_ok($$select waytara.gw_ev_session_set_target(gen_random_uuid(), 5)$$, 'P0002', null, 'a session that does not exist is reported');
select lives_ok($$select waytara.gw_ev_session_stop((select id from _s), now(), 3000, 'MissingStop', '{"status": "aborted"}'::jsonb)$$, 'a session is closed without a stop from the charger');
select is(waytara.gw_ev_active_sessions('92000000-0000-0000-0000-000000000002'), '[]'::jsonb, 'and is no longer listed as open');
reset role;

select * from finish();
rollback;
