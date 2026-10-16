-- Task A9: the database side of the settings write-back (gw_pending_writes, gw_report_settings, gw_last_settings). Rolled back at the end.
-- (Same rule as 15_*.test.sql: every assertion is one statement starting with "select <assertion>(" at the start of a line.)

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(17);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local'),
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  ('e1000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e1@test.local'),
  ('50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'svc@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.local', 'admin', 'Admin'),
  ('c1000000-0000-0000-0000-000000000001', 'c1@test.local', 'customer', 'C1'),
  ('e1000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'employee', 'E1');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-000000000001');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'S1', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-000000000009', 'Inverter', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id, label) values
  ('91000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009', 'Inverter 1');
insert into waytara.equipment_templates (category, dashboard_section, device_category, key_name, display_name, direction, value_kind) values
  ('Test', 'Settings', 'solar', 'set_a', 'Set A', 'write', 'number'),
  ('Test', 'Settings', 'solar', 'set_b', 'Set B', 'write', 'number'),
  ('Test', 'Settings', 'solar', 'set_hidden', 'Hidden', 'write', 'number'),
  ('Test', 'Monitoring', 'solar', 'read_only', 'Read only', 'read', 'number');
insert into waytara.equipment_metrics (equipment_id, key_name, category, device_category, direction, address, decode, show_for_user, is_verified) values
  ('91000000-0000-0000-0000-000000000001', 'set_a', 'Test', 'solar', 'write', '{"registers": [200]}', '{"scale": 1}', true, true),
  ('91000000-0000-0000-0000-000000000001', 'set_b', 'Test', 'solar', 'write', '{"registers": [201]}', '{"scale": 1}', true, true),
  ('91000000-0000-0000-0000-000000000001', 'set_hidden', 'Test', 'solar', 'write', '{"registers": [202]}', '{"scale": 1}', false, true),
  ('91000000-0000-0000-0000-000000000001', 'read_only', 'Test', 'solar', 'read', '{"registers": [203]}', '{"scale": 1}', true, true);
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000a0', 'test backend');

-- the settings log: a start-up read of both settings, then a person asks for a new value of set_a
insert into waytara.equipment_configs (equipment_id, ts, setting_category, key_name, setting_value, source) values
  ('91000000-0000-0000-0000-000000000001', now() - interval '1 hour', 'Test', 'set_a', '10', 'agent_initial_read'),
  ('91000000-0000-0000-0000-000000000001', now() - interval '1 hour', 'Test', 'set_b', '5', 'agent_initial_read'),
  ('91000000-0000-0000-0000-000000000001', now() - interval '20 seconds', 'Test', 'set_a', '12', 'customer_dashboard');

-- ---- nobody but the backend identity
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_pending_writes('91000000-0000-0000-0000-000000000001')$$, '42501', null, 'a staff member cannot read the pending writes');
select throws_ok($$select waytara.gw_report_settings('91000000-0000-0000-0000-000000000001', '[]'::jsonb)$$, '42501', null, 'nor report settings');
select throws_ok($$select waytara.gw_last_settings('91000000-0000-0000-0000-000000000001')$$, '42501', null, 'nor read the last values');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_pending_writes('91000000-0000-0000-0000-000000000001')$$, '42501', null, 'the owner of the site cannot either');
reset role;

-- ---- the backend identity
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);

select is(jsonb_array_length(waytara.gw_pending_writes('91000000-0000-0000-0000-000000000001')), 1, 'one setting is waiting for the unit');
select is((waytara.gw_pending_writes('91000000-0000-0000-0000-000000000001') -> 0 ->> 'key'), 'set_a', 'it is the one that was asked for');
select is((waytara.gw_pending_writes('91000000-0000-0000-0000-000000000001') -> 0 ->> 'value'), '12', 'with the asked value');
select throws_ok($$select waytara.gw_pending_writes('00000000-0000-0000-0000-00000000dead')$$, 'P0002', null, 'an unknown equipment is refused');

-- a plain read of the setting somebody is waiting for must not be stored: it would hide the request
select is(waytara.gw_report_settings('91000000-0000-0000-0000-000000000001', '[{"key_name":"set_a","setting_value":"10","source":"agent_initial_read"}]'::jsonb), 0, 'a read of a setting somebody is waiting for is not recorded');
select is(jsonb_array_length(waytara.gw_pending_writes('91000000-0000-0000-0000-000000000001')), 1, 'and the request is still waiting');

-- the unit reports: set_a confirmed (read back 12), a hidden setting, a read-only key and a made-up source are all ignored
select is(
  waytara.gw_report_settings('91000000-0000-0000-0000-000000000001', '[
    {"key_name":"set_a","setting_value":"12","source":"agent_write_ok","previous_value":"10"},
    {"key_name":"set_hidden","setting_value":"1","source":"agent_write_ok"},
    {"key_name":"read_only","setting_value":"1","source":"agent_write_ok"},
    {"key_name":"set_b","setting_value":"7","source":"customer_dashboard"}
  ]'::jsonb),
  1, 'only the confirmed write of a visible setting is stored');
select is(jsonb_array_length(waytara.gw_pending_writes('91000000-0000-0000-0000-000000000001')), 0, 'and then nothing is waiting any more');

select is(waytara.gw_report_settings('91000000-0000-0000-0000-000000000001', '[{"key_name":"set_b","setting_value":"6","source":"agent_initial_read"}]'::jsonb), 1, 'a value the unit holds is stored as a read');
select throws_ok($$select waytara.gw_report_settings('91000000-0000-0000-0000-000000000001', '{"not":"an array"}'::jsonb)$$, '22023', null, 'the rows must be an array');

select is((select (x ->> 'value') from jsonb_array_elements(waytara.gw_last_settings('91000000-0000-0000-0000-000000000001')) x where x ->> 'key' = 'set_a'), '12', 'the last value of set_a is the confirmed one');
select is((select (x ->> 'source') from jsonb_array_elements(waytara.gw_last_settings('91000000-0000-0000-0000-000000000001')) x where x ->> 'key' = 'set_b'), 'agent_initial_read', 'and set_b was last heard from the unit');
reset role;

select is((select count(*)::int from waytara.equipment_configs where key_name in ('set_hidden', 'read_only')), 0, 'nothing was stored for the hidden or read-only keys');

select * from finish();
rollback;
