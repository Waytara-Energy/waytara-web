-- Read rates per value: only the backend identity, only people who manage the unit, only the allowed rates, "use the map's rate" puts the
-- original back, a new row remembers the map's rate, every change is logged once. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email) values
  ('50000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'backend8@test.local'),
  ('a0000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin8@test.local'),
  ('c1000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust8@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-0000000000c7', 'admin8@test.local', 'admin', 'Admin Eight'),
  ('c1000000-0000-0000-0000-0000000000c7', 'cust8@test.local', 'customer', 'Customer Eight');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000c7');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000c7', 'c1000000-0000-0000-0000-0000000000c7', 'Site', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-0000000000c7', 'Inverter', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id, label, device_status) values
  ('e1000000-0000-0000-0000-0000000000c7', '51000000-0000-0000-0000-0000000000c7', '99000000-0000-0000-0000-0000000000c7', 'Unit', 'active');
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000c7', 'test backend');
insert into waytara.equipment_templates (category, dashboard_section, device_category, key_name, display_name, unit, direction) values
  ('power', 'power', 'solar', 'zz_test_power', 'Test power', 'W', 'read'),
  ('temperature', 'power', 'solar', 'zz_test_temp', 'Test temperature', 'C', 'read'),
  ('power', 'power', 'solar', 'zz_test_hidden', 'Test hidden', 'W', 'read');
insert into waytara.equipment_metrics (equipment_id, key_name, category, device_category, direction, address, cadence_seconds, show_for_user) values
  ('e1000000-0000-0000-0000-0000000000c7', 'zz_test_power', 'power', 'solar', 'read', '{"registers":[9001]}', 30, true),
  ('e1000000-0000-0000-0000-0000000000c7', 'zz_test_temp', 'temperature', 'solar', 'read', '{"registers":[9002]}', null, true),
  ('e1000000-0000-0000-0000-0000000000c7', 'zz_test_hidden', 'power', 'solar', 'read', '{"registers":[9003]}', 30, false);

select is((select map_cadence_seconds from waytara.equipment_metrics where key_name = 'zz_test_power'), 30, 'a new value remembers the rate the map was made with');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000c7","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_list_cadences('a0000000-0000-0000-0000-0000000000c7', 'e1000000-0000-0000-0000-0000000000c7')$$, '42501', null, 'a signed-in person cannot call it directly, only the backend identity');

select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000c7","role":"authenticated"}', true);
select is(waytara.gw_list_cadences('c1000000-0000-0000-0000-0000000000c7', 'e1000000-0000-0000-0000-0000000000c7'), null, 'a customer is not given the list');
select is(jsonb_array_length(waytara.gw_list_cadences('a0000000-0000-0000-0000-0000000000c7', 'e1000000-0000-0000-0000-0000000000c7') -> 'metrics'), 2, 'staff get the values that are read (not the hidden ones)');
select is((select (e ->> 'seconds')::int from jsonb_array_elements(waytara.gw_list_cadences('a0000000-0000-0000-0000-0000000000c7', 'e1000000-0000-0000-0000-0000000000c7') -> 'metrics') e where e ->> 'key' = 'zz_test_temp'), 30, 'a value with no rate is shown at the standard 30 seconds');

select is(waytara.gw_set_cadences('e1000000-0000-0000-0000-0000000000c7', 'a0000000-0000-0000-0000-0000000000c7', '[{"key":"zz_test_power","seconds":120},{"key":"zz_test_temp","seconds":300}]') ->> 'changed', '2', 'two values are changed');
select is((select cadence_seconds from waytara.equipment_metrics where key_name = 'zz_test_power'), 120, 'the rate in force is the new one');
select is((select map_cadence_seconds from waytara.equipment_metrics where key_name = 'zz_test_power'), 30, 'and the map rate is kept');
select is(waytara.gw_set_cadences('e1000000-0000-0000-0000-0000000000c7', 'a0000000-0000-0000-0000-0000000000c7', '[{"key":"zz_test_power","seconds":null}]') ->> 'changed', '1', 'use the map rate puts it back');
select is((select cadence_seconds from waytara.equipment_metrics where key_name = 'zz_test_power'), 30, 'back at the map rate');
select throws_ok($$select waytara.gw_set_cadences('e1000000-0000-0000-0000-0000000000c7', 'a0000000-0000-0000-0000-0000000000c7', '[{"key":"zz_test_power","seconds":7}]')$$, '22023', null, 'a rate outside the list is refused');
select throws_ok($$select waytara.gw_set_cadences('e1000000-0000-0000-0000-0000000000c7', 'c1000000-0000-0000-0000-0000000000c7', '[{"key":"zz_test_power","seconds":60}]')$$, '42501', null, 'a customer cannot change a rate');

select is((select count(*)::int from waytara.device_activity where action = 'read_rates_changed' and equipment_id = 'e1000000-0000-0000-0000-0000000000c7'), 2, 'each saved batch is one line in the activity log');
select is((select summary from waytara.device_activity where action = 'read_rates_changed' and equipment_id = 'e1000000-0000-0000-0000-0000000000c7' order by id limit 1), 'The read rate of 2 values was changed', 'in plain words');

select * from finish();
rollback;
