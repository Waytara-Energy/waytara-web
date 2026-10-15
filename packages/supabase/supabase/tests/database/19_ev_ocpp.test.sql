-- Part B: the EV charger database layer (sessions, samples, events, site figures, access). Rolled back at the end.
-- (Same rule as 15_*.test.sql: every assertion is one statement starting with "select <assertion>(" at the start of a line.)

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(34);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local'),
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  ('c2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@test.local'),
  ('e1000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e1@test.local'),
  ('e2000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e2@test.local'),
  ('50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'svc@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.local', 'admin', 'Admin'),
  ('c1000000-0000-0000-0000-000000000001', 'c1@test.local', 'customer', 'C1'),
  ('c2000000-0000-0000-0000-000000000002', 'c2@test.local', 'customer', 'C2'),
  ('e1000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'employee', 'E1'),
  ('e2000000-0000-0000-0000-0000000000e2', 'e2@test.local', 'employee', 'E2');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-000000000001'), ('c2000000-0000-0000-0000-000000000002');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'S1', 'residential_independent_villas', 'hybrid'),
  ('52000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'S2', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values
  ('99000000-0000-0000-0000-000000000009', 'Inverter', 'solar_inverter'),
  ('99000000-0000-0000-0000-00000000000a', 'Charger', 'ev_charger');
insert into waytara.equipment (id, site_id, stock_id, label) values
  ('91000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009', 'Inverter 1'),
  ('92000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-00000000000a', 'Charger 1'),
  ('93000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000002', '99000000-0000-0000-0000-00000000000a', 'Charger 2');
insert into waytara.site_staff (site_id, staff_id) values ('51000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000e1');
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000a0', 'test backend');
insert into waytara.equipment_keys (id, equipment_id, kind, label, key_ciphertext, key_fingerprint) values
  ('b1000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002', 'charger', 'WT_TEST_1', decode(repeat('ab', 40), 'hex'), 'abcdef012345'),
  ('b2000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000003', 'charger', 'WT_TEST_2', decode(repeat('cd', 40), 'hex'), 'abcdef012346');
update waytara.equipment_keys set revoked_at = now() where id = 'b2000000-0000-0000-0000-000000000002';
insert into waytara.equipment_latest (equipment_id, key_name, value, ts) values
  ('91000000-0000-0000-0000-000000000001', 'pv1_power_w', 2000, now() - interval '5 seconds'),
  ('91000000-0000-0000-0000-000000000001', 'pv2_power_w', 500, now() - interval '5 seconds'),
  ('91000000-0000-0000-0000-000000000001', 'battery_power_w', 300, now() - interval '5 seconds'),
  ('91000000-0000-0000-0000-000000000001', 'grid_total_power_w', -100, now() - interval '5 seconds'),
  ('91000000-0000-0000-0000-000000000001', 'load_total_power_w', 2700, now() - interval '5 seconds');

-- ---- not for browsers
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_ev_next_transaction()$$, '42501', null, 'a staff member cannot take a transaction number');
select throws_ok($$select * from waytara.gw_charger_keys()$$, '42501', null, 'a staff member cannot list charger secrets');
select throws_ok($$select waytara.gw_ev_access('e1000000-0000-0000-0000-0000000000e1', '92000000-0000-0000-0000-000000000002')$$, '42501', null, 'nor ask the command check directly');
reset role;

-- ---- the backend identity
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);

select is((select count(*)::int from waytara.gw_charger_keys()), 1, 'only the active charger secret is listed (a revoked one is not)');
select is((select label from waytara.gw_charger_keys()), 'WT_TEST_1', 'with the charger name it was made for');
select ok((select waytara.gw_ev_next_transaction()) < (select waytara.gw_ev_next_transaction()), 'transaction numbers only grow');

select is(waytara.gw_ev_access('c1000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002'), 'owner', 'the site owner may command their charger');
select is(waytara.gw_ev_access('e1000000-0000-0000-0000-0000000000e1', '92000000-0000-0000-0000-000000000002'), 'staff', 'assigned staff may');
select is(waytara.gw_ev_access('a0000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002'), 'staff', 'an admin may');
select is(waytara.gw_ev_access('e2000000-0000-0000-0000-0000000000e2', '92000000-0000-0000-0000-000000000002'), null::text, 'unassigned staff may not');
select is(waytara.gw_ev_access('c2000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002'), null::text, 'another customer may not');
select is(waytara.gw_ev_access('c1000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001'), null::text, 'an inverter is not something to send charger commands to');

-- the site figures from the inverter at the same site
select is((waytara.gw_ev_site_figures('92000000-0000-0000-0000-000000000002') ->> 'pv_w')::numeric, 2500::numeric, 'PV power is the sum of the inputs');
select is((waytara.gw_ev_site_figures('92000000-0000-0000-0000-000000000002') ->> 'load_w')::numeric, 2700::numeric, 'with the house load');
select is((waytara.gw_ev_site_figures('92000000-0000-0000-0000-000000000002') ->> 'battery_w')::numeric, 300::numeric, 'the battery (above zero = discharging)');
select ok((waytara.gw_ev_site_figures('92000000-0000-0000-0000-000000000002') ->> 'age_s')::numeric < 60, 'and how old the readings are');
select is(waytara.gw_ev_site_figures('93000000-0000-0000-0000-000000000003'), null::jsonb, 'a site with no inverter has no figures');

-- a session
create temp table _s (id uuid);
grant all on _s to authenticated;
insert into _s select waytara.gw_ev_session_start('92000000-0000-0000-0000-000000000002', 1, 1001, now() - interval '10 minutes', 52873, 'tagtaghash', 'WT_TEST_1');
select ok((select id from _s) is not null, 'a session starts');
select is(waytara.gw_ev_session_start('92000000-0000-0000-0000-000000000002', 1, 1001, now(), 99999, 'x', 'WT_TEST_1'), (select id from _s), 'the same transaction again gives the same session');
select is((select meter_start_wh from waytara.gw_ev_session_by_transaction('92000000-0000-0000-0000-000000000002', 1001)), 52873::numeric, 'and the start meter of the first is kept');
select throws_ok($$select waytara.gw_ev_session_start('92000000-0000-0000-0000-000000000002', 1, 1002, now(), 1, 'x', 'WT', 'inferred')$$, '22023', null, 'only a charger or a test can be the source');

select lives_ok($$select waytara.gw_ev_sample((select id from _s), now() - interval '9 minutes', '{"energy_kwh": 52.9, "power_kw": 7.2, "voltage_v_l1": 237.5, "pv_w": 2500, "ev_from_solar_w": 2500, "ev_from_grid_w": 4700}'::jsonb)$$, 'a sample is stored');
select lives_ok($$select waytara.gw_ev_sample((select id from _s), now() - interval '9 minutes', '{"energy_kwh": 52.95, "power_kw": 7.3}'::jsonb)$$, 'the same time again replaces it');
reset role;
select is((select count(*)::int from waytara.ev_session_samples), 1, 'so there is one sample');
select is((select power_kw from waytara.ev_session_samples), 7.3::numeric, 'with the newer figures');
select ok((select pv_w from waytara.ev_session_samples) is null, 'and what was not reported is empty, not zero');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);

select is(jsonb_array_length(waytara.gw_ev_session_samples((select id from _s))), 1, 'the samples of a session can be read back for its summary');
select lives_ok($$select waytara.gw_ev_event('92000000-0000-0000-0000-000000000002', (select id from _s), now(), 'status', '{"status": "Charging"}'::jsonb)$$, 'an event is stored');
select lives_ok($$select waytara.gw_ev_session_stop((select id from _s), now(), 60873, 'Local', '{"status": "completed", "peak_power_kw": 7.4, "solar_share_pct": 31.5}'::jsonb)$$, 'the session ends');
reset role;
select is((select status || ':' || round(end_energy_kwh - start_energy_kwh, 3)::text from waytara.ev_sessions where id = (select id from _s)), 'completed:8.000', 'with its energy in kWh');

-- ---- who can read what
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from waytara.ev_session_samples), 1, 'the owner reads the samples of their charger');
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from waytara.ev_session_samples) + (select count(*)::int from waytara.ev_events) + (select count(*)::int from waytara.ev_sessions), 0, 'another customer reads nothing of it');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from waytara.ev_events), 1, 'assigned staff read the events');
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
select is((select count(*)::int from waytara.ev_events), 0, 'unassigned staff read nothing');
reset role;

select * from finish();
rollback;
