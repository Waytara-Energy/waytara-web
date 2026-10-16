-- Setting changes for the ESP32: the pending requests, the device token check, the report of what was done, and that the
-- broadcast trigger never breaks a save. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(10);

\set c1 '''11111111-1111-1111-1111-111111111111'''
\set e1 '''e1000000-0000-0000-0000-000000000001'''

insert into auth.users (id, instance_id, aud, role, email) values
  (:c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local');
insert into waytara.profiles (id, email, role, full_name) values (:c1, 'c1@test.local', 'customer', 'C1');
insert into waytara.customers (id) values (:c1);
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', :c1, 'S1', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-000000000009', 'Inv', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id) values (:e1, '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009');
insert into waytara.equipment_ingest_tokens (equipment_id, token_hash)
values (:e1, encode(sha256(convert_to('a-long-device-secret-1', 'utf8')), 'hex'));

-- the metric templates the rows below point at (a fresh database does not carry the live ones)
insert into waytara.equipment_templates (category, dashboard_section, device_category, key_name, display_name, direction) values
  ('My Settings', 'Settings', 'solar', 'battery_low_soc_pct', 'Battery low SOC', 'write'),
  ('Solar', 'Monitoring', 'solar', 'pv1_power_w', 'PV1 power', 'read')
on conflict do nothing;
insert into waytara.equipment_metrics (equipment_id, key_name, category, device_category, direction, address, show_for_user) values
  (:e1, 'battery_low_soc_pct', 'My Settings', 'solar', 'write', '{"registers":[219]}', true),
  (:e1, 'pv1_power_w', 'Solar', 'solar', 'read', '{"registers":[186]}', true);

-- saving a request must work (the trigger broadcasts, and never fails the insert)
select lives_ok(
  $$insert into waytara.equipment_configs (equipment_id, setting_category, key_name, setting_value, source, written_by)
    values ('e1000000-0000-0000-0000-000000000001', 'My Settings', 'battery_low_soc_pct', '20', 'customer_dashboard', '11111111-1111-1111-1111-111111111111')$$,
  'a setting change from the app can be saved (the broadcast trigger does not get in the way)');

set local role anon;

select throws_ok(
  $$select waytara.device_pending_writes('e1000000-0000-0000-0000-000000000001', 'wrong-wrong-wrong-wrong')$$,
  '28000', null, 'pending requests are refused without the device token');
select is(
  jsonb_array_length(waytara.device_pending_writes('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1')),
  1, 'the right token gets the pending request');
select is(
  waytara.device_pending_writes('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1') -> 0 ->> 'value',
  '20', 'with the value that was asked for');
select is(
  jsonb_array_length(waytara.ingest_device_tick('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1') -> 'pending_writes'),
  1, 'the check-in answer carries it too (fallback when the WebSocket is down)');

select throws_ok(
  $$select waytara.device_report_configs('e1000000-0000-0000-0000-000000000001', 'wrong-wrong-wrong-wrong', '[]')$$,
  '28000', null, 'reporting needs the token too');
select is(
  waytara.device_report_configs('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1',
    '[{"key_name":"pv1_power_w","setting_value":"1","source":"agent_write_ok"},{"key_name":"battery_low_soc_pct","setting_value":"20","source":"customer_dashboard"}]'),
  0, 'a read metric, or a source that is not the device''s, is not accepted');
select is(
  waytara.device_report_configs('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1',
    '[{"key_name":"battery_low_soc_pct","setting_value":"20","source":"agent_write_ok","previous_value":"15","notes":"requested 20","unit":"%"}]'),
  1, 'the result of a write is recorded');
select is(
  jsonb_array_length(waytara.device_pending_writes('e1000000-0000-0000-0000-000000000001', 'a-long-device-secret-1')),
  0, 'and the request is no longer pending');

reset role;

select is((select source from waytara.equipment_configs where equipment_id = :e1 order by id desc limit 1), 'agent_write_ok', 'the app sees the device''s answer as the newest row');

select * from finish();
rollback;
