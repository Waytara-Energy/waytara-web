-- The push interval functions: only the backend identity, only people who manage the unit, only the allowed values, logged. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(10);

insert into auth.users (id, instance_id, aud, role, email) values
  ('50000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'backend7@test.local'),
  ('a0000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin7@test.local'),
  ('c1000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust7@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-0000000000b7', 'admin7@test.local', 'admin', 'Admin Seven'),
  ('c1000000-0000-0000-0000-0000000000b7', 'cust7@test.local', 'customer', 'Customer Seven');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000b7');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000b7', 'c1000000-0000-0000-0000-0000000000b7', 'Site', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-0000000000b7', 'Inverter', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id, label, device_status) values
  ('e1000000-0000-0000-0000-0000000000b7', '51000000-0000-0000-0000-0000000000b7', '99000000-0000-0000-0000-0000000000b7', 'Unit', 'active');
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000b7', 'test backend');

-- not the backend: refused
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000b7","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_set_push_interval('e1000000-0000-0000-0000-0000000000b7', 'a0000000-0000-0000-0000-0000000000b7', 300)$$, '42501', null, 'a signed-in person cannot call it directly, only the backend identity');
select throws_ok($$select waytara.gw_get_push_interval('a0000000-0000-0000-0000-0000000000b7', 'e1000000-0000-0000-0000-0000000000b7')$$, '42501', null, 'nor read it');

-- the backend identity
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000b7","role":"authenticated"}', true);
select is(waytara.gw_get_push_interval('a0000000-0000-0000-0000-0000000000b7', 'e1000000-0000-0000-0000-0000000000b7'), 900, 'a unit starts at the default of 15 minutes');
select is(waytara.gw_get_push_interval('c1000000-0000-0000-0000-0000000000b7', 'e1000000-0000-0000-0000-0000000000b7'), null, 'a customer is not given it (staff only)');
select is(waytara.gw_set_push_interval('e1000000-0000-0000-0000-0000000000b7', 'a0000000-0000-0000-0000-0000000000b7', 300) ->> 'previous', '900', 'an admin changes it, and gets the previous value back');
select is(waytara.gw_get_push_interval('a0000000-0000-0000-0000-0000000000b7', 'e1000000-0000-0000-0000-0000000000b7'), 300, 'the new value is stored');
select throws_ok($$select waytara.gw_set_push_interval('e1000000-0000-0000-0000-0000000000b7', 'a0000000-0000-0000-0000-0000000000b7', 45)$$, '22023', null, 'a value outside the list is refused');
select throws_ok($$select waytara.gw_set_push_interval('e1000000-0000-0000-0000-0000000000b7', 'c1000000-0000-0000-0000-0000000000b7', 600)$$, '42501', null, 'a customer cannot change it');
reset role;

select is((select count(*)::int from waytara.device_activity where action = 'push_interval_changed' and (details ->> 'to_s') = '300' and (details ->> 'from_s') = '900'), 1, 'the change is in the activity log with the old and new values');
select is((select summary from waytara.device_activity where action = 'push_interval_changed'), 'The push interval was changed to 5 minutes', 'in plain words');

select * from finish();
rollback;
