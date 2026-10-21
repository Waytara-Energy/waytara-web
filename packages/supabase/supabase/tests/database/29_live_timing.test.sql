-- Go Live timing: only the backend identity writes it, one row per unit that the next session replaces, staff and admins read it, customers do not.
-- Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email) values
  ('50000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'backend9@test.local'),
  ('a0000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin9@test.local'),
  ('c1000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust9@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-0000000000e9', 'admin9@test.local', 'admin', 'Admin Nine'),
  ('c1000000-0000-0000-0000-0000000000e9', 'cust9@test.local', 'customer', 'Customer Nine');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000e9');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000e9', 'c1000000-0000-0000-0000-0000000000e9', 'Site', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-0000000000e9', 'Inverter', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id, label, device_status) values
  ('e1000000-0000-0000-0000-0000000000e9', '51000000-0000-0000-0000-0000000000e9', '99000000-0000-0000-0000-0000000000e9', 'Unit', 'active');
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000e9', 'test backend');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000e9","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_record_live_timing('e1000000-0000-0000-0000-0000000000e9', now(), 100, 200, 10, 310, 1, null, null)$$, '42501', null, 'a person cannot write the timing, only the backend identity');
select throws_ok($$select waytara.gw_live_until('e1000000-0000-0000-0000-0000000000e9')$$, '42501', null, 'nor ask who is watching');

select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000e9","role":"authenticated"}', true);
select is(waytara.gw_live_until('e1000000-0000-0000-0000-0000000000e9'), null::timestamptz, 'nobody is watching: no end time');
select lives_ok($$select waytara.gw_record_live_timing('e1000000-0000-0000-0000-0000000000e9', now(), 100, 2500, 40, 2640, 1, null, null)$$, 'the backend records how a session started');
select lives_ok($$select waytara.gw_record_live_timing('e1000000-0000-0000-0000-0000000000e9', now(), 100, 2500, 40, 2640, 30, 1500, 4000)$$, 'and updates it as the session runs');
reset role;
select is((select ticks from waytara.equipment_live_timing where equipment_id = 'e1000000-0000-0000-0000-0000000000e9'), 30, 'one row per unit, replaced by the update');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000e9","role":"authenticated"}', true);
select is((select request_to_first_tick_ms from waytara.equipment_live_timing), 2640, 'an admin reads it');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000e9","role":"authenticated"}', true);
select is((select count(*)::int from waytara.equipment_live_timing), 0, 'a customer does not');
reset role;

select * from finish();
rollback;
