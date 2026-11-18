-- Team members: what an invited person can read, change and command, device by device. Rolled back at the end.
-- (Same rule as 15_*.test.sql: every assertion is one statement starting with "select <assertion>(" at the start of a line.)

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(43);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@team.local'),
  ('c2000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@team.local'),
  ('a1000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm1@team.local'),
  ('a2000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm2@team.local'),
  ('a3000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm3@team.local'),
  ('50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'svc@team.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('c1000000-0000-0000-0000-0000000000c1', 'owner@team.local', 'customer', 'Owner'),
  ('c2000000-0000-0000-0000-0000000000c2', 'other@team.local', 'customer', 'Other'),
  ('a1000000-0000-0000-0000-0000000000a1', 'm1@team.local', 'customer', 'Member One'),
  ('a2000000-0000-0000-0000-0000000000a2', 'm2@team.local', 'customer', 'Member Two'),
  ('a3000000-0000-0000-0000-0000000000a3', 'm3@team.local', 'customer', 'Super User');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000c1'), ('c2000000-0000-0000-0000-0000000000c2');
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000a0', 'test backend');

insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-0000000000c1', 'S1', 'residential_independent_villas', 'hybrid'),
  ('52000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-0000000000c2', 'S2', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category, quantity) values
  ('99000000-0000-0000-0000-000000000001', 'Inverter', 'solar_inverter', 5),
  ('99000000-0000-0000-0000-000000000002', 'Panel 550W', 'Solar Panels', 24),
  ('99000000-0000-0000-0000-00000000000a', 'Charger', 'ev_charger', 5);
insert into waytara.equipment (id, site_id, stock_id, label) values
  ('e1000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000001', 'I1'),
  ('e1000000-0000-0000-0000-00000000001b', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000001', 'I1b'),
  ('ec000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-00000000000a', 'C1'),
  ('ec000000-0000-0000-0000-00000000001b', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-00000000000a', 'C1b'),
  ('ec000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', '99000000-0000-0000-0000-00000000000a', 'C2');
insert into waytara.equipment (id, site_id, stock_id, parent_id, quantity) values
  ('ee000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 4);
insert into waytara.equipment_latest (equipment_id, key_name, value, ts) values
  ('e1000000-0000-0000-0000-000000000001', 'pv1_power_w', 2000, now()),
  ('e1000000-0000-0000-0000-00000000001b', 'pv1_power_w', 900, now());

-- the owner's plan includes reports
insert into waytara.plans (code, name, max_devices, price_monthly, price_yearly) select 'basic', 'Basic (test)', 3, 499, 4990 where not exists (select 1 from waytara.plans);
update waytara.plans set name = 'Team test plan', features = '{"reports": true}'::jsonb where id = (select id from waytara.plans order by price_monthly limit 1);
update waytara.customers set plan_id = (select id from waytara.plans order by price_monthly limit 1) where id = 'c1000000-0000-0000-0000-0000000000c1';

-- Member One: manager, may schedule; operates the inverter I1 and the charger C1, may only read the charger C1b.
-- Member Two: suspended (read on I1). A third invitation is still waiting for its person.
insert into waytara.team_members (id, owner_id, user_id, email, role, pages, can_schedule, status, accepted_at) values
  ('7e000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-0000000000c1', 'a1000000-0000-0000-0000-0000000000a1', 'm1@team.local', 'manager', array['overview', 'reports'], true, 'active', now()),
  ('7e000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-0000000000c1', 'a2000000-0000-0000-0000-0000000000a2', 'm2@team.local', 'viewer', array['overview'], false, 'suspended', now()),
  ('7e000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-0000000000c1', 'a3000000-0000-0000-0000-0000000000a3', 'm3@team.local', 'super', array['overview', 'monitoring', 'performance', 'reports', 'maintenance', 'site', 'devices'], true, 'active', now());
insert into waytara.team_members (id, owner_id, email, role, pages, status) values
  ('7e000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-0000000000c1', 'new@team.local', 'viewer', array['overview'], 'invited');
insert into waytara.team_member_devices (member_id, equipment_id, level) values
  ('7e000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'operate'),
  ('7e000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'operate'),
  ('7e000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-00000000001b', 'read'),
  ('7e000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'read');

-- ---- Member One -------------------------------------------------------------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is((select count(*)::int from waytara.sites), 1, 'a member sees only the site that holds a device they were given');
select is((select count(*)::int from waytara.equipment), 4, 'they see their devices and the panels under their inverter');
select is((select count(*)::int from waytara.equipment where id = 'e1000000-0000-0000-0000-00000000001b'), 0, 'not another device at the same site');
select is((select count(*)::int from waytara.equipment where id = 'ec000000-0000-0000-0000-000000000002'), 0, 'and not another customer''s device');
select is((select count(*)::int from waytara.equipment_latest), 1, 'readings only of their own devices');
select ok(waytara.can_view_equipment('e1000000-0000-0000-0000-000000000001') and not waytara.can_view_equipment('e1000000-0000-0000-0000-00000000001b'), 'can_view_equipment follows what they were given');
select ok(waytara.can_operate_equipment('e1000000-0000-0000-0000-000000000001') and waytara.can_operate_equipment('ec000000-0000-0000-0000-000000000001'), 'they may operate the devices given with operate');
select ok(not waytara.can_operate_equipment('ec000000-0000-0000-0000-00000000001b'), 'but not one given as read');
select ok(not waytara.can_operate_equipment('e1000000-0000-0000-0000-00000000001b'), 'nor one they were not given');
select ok(waytara.can_operate_equipment('ee000000-0000-0000-0000-000000000001'), 'a child device (the panels) takes its inverter''s level');

select lives_ok($$insert into waytara.equipment_configs (equipment_id, setting_category, key_name, setting_value, source, written_by) values ('e1000000-0000-0000-0000-000000000001', 'test', 'team_test', '1', 'customer_dashboard', 'a1000000-0000-0000-0000-0000000000a1')$$, 'they can change a setting of a device they operate');
select throws_ok($$insert into waytara.equipment_configs (equipment_id, setting_category, key_name, setting_value, source, written_by) values ('ec000000-0000-0000-0000-00000000001b', 'test', 'team_test', '1', 'customer_dashboard', 'a1000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'but not of one they can only read');
select throws_ok($$insert into waytara.equipment_configs (equipment_id, setting_category, key_name, setting_value, source, written_by) values ('e1000000-0000-0000-0000-00000000001b', 'test', 'team_test', '1', 'customer_dashboard', 'a1000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'nor of one they were not given');
select throws_ok($$insert into waytara.equipment_configs (equipment_id, setting_category, key_name, setting_value, source, written_by) values ('e1000000-0000-0000-0000-000000000001', 'test', 'team_test', '1', 'customer_dashboard', 'c1000000-0000-0000-0000-0000000000c1')$$, '42501', null, 'and a change cannot be written under the owner''s name');

select is((select count(*)::int from waytara.team_members), 1, 'a member sees only their own membership row');
select is((select count(*)::int from waytara.team_member_devices), 3, 'and their own device list');
select throws_ok($$select access_token_hash from waytara.team_members$$, '42501', null, 'the invitation link''s hash is never readable from a browser');
select throws_ok($$insert into waytara.team_members (owner_id, email) values ('c1000000-0000-0000-0000-0000000000c1', 'x@team.local')$$, '42501', null, 'a member cannot write membership rows');
select throws_ok($$insert into waytara.team_member_devices (member_id, equipment_id, level) values ('7e000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-00000000001b', 'operate')$$, '42501', null, 'nor give themselves another device');

select is((select plan_name from waytara.my_team_plan()), 'Team test plan', 'a member is shown the owner''s plan');

select lives_ok($$insert into waytara.customer_reports (customer_id, equipment_id, name, params) values ('c1000000-0000-0000-0000-0000000000c1', 'e1000000-0000-0000-0000-000000000001', 'Weekly', '{}'::jsonb)$$, 'a member who may schedule creates a scheduled report on the owner''s account');
select throws_ok($$insert into waytara.customer_reports (customer_id, equipment_id, name, params) values ('c1000000-0000-0000-0000-0000000000c1', 'e1000000-0000-0000-0000-00000000001b', 'Weekly', '{}'::jsonb)$$, '42501', null, 'but not for a device they cannot see');
select throws_ok($$insert into waytara.customer_reports (customer_id, name, params) values ('c1000000-0000-0000-0000-0000000000c1', 'Whole system', '{}'::jsonb)$$, '42501', null, 'and not one with no device (that would cover the whole system)');
select throws_ok($$insert into waytara.customer_reports (customer_id, name, params) values ('c2000000-0000-0000-0000-0000000000c2', 'Weekly', '{}'::jsonb)$$, '42501', null, 'and not on another customer''s account');
select is((select count(*)::int from waytara.customer_reports), 1, 'they see the scheduled reports of the account they belong to');
reset role;

-- ---- Member Two (suspended) --------------------------------------------------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*)::int from waytara.sites), 0, 'a suspended member sees no site');
select ok(not waytara.can_view_equipment('e1000000-0000-0000-0000-000000000001'), 'and no device');
select throws_ok($$insert into waytara.customer_reports (customer_id, name, params) values ('c1000000-0000-0000-0000-0000000000c1', 'Weekly', '{}'::jsonb)$$, '42501', null, 'and cannot schedule anything');
reset role;

-- ---- a super user: every device of the owner, none of them listed -------------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select is((select count(*)::int from waytara.equipment), 5, 'a super user sees every device of the owner (and the panels under the inverter), though none is listed for them');
select is((select count(*)::int from waytara.equipment where id = 'ec000000-0000-0000-0000-000000000002'), 0, 'but not another customer''s device');
select ok(waytara.can_operate_equipment('ec000000-0000-0000-0000-00000000001b') and waytara.can_operate_equipment('e1000000-0000-0000-0000-00000000001b'), 'and may operate every one, even those a manager is only allowed to read');
select ok(waytara.team_can_schedule('c1000000-0000-0000-0000-0000000000c1') and waytara.team_has_page('c1000000-0000-0000-0000-0000000000c1', 'devices'), 'with every page and the scheduled reports');
reset role;

-- ---- another customer, and the owner ---------------------------------------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is((select count(*)::int from waytara.equipment where id in ('e1000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001')), 0, 'another customer sees none of the first customer''s devices');
select is((select count(*)::int from waytara.team_members), 0, 'nor their team');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from waytara.team_members), 4, 'the owner sees all their invitations, the super user included');
select is((select count(*)::int from waytara.team_member_devices), 4, 'and every device given');
reset role;

-- ---- the backend's checks ------------------------------------------------------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is(waytara.gw_ev_access('a1000000-0000-0000-0000-0000000000a1', 'ec000000-0000-0000-0000-000000000001'), 'owner', 'a member with operate may command the charger');
select is(waytara.gw_ev_access('a1000000-0000-0000-0000-0000000000a1', 'ec000000-0000-0000-0000-00000000001b'), null::text, 'a member with read may not');
select is(waytara.gw_ev_access('a2000000-0000-0000-0000-0000000000a2', 'ec000000-0000-0000-0000-000000000001'), null::text, 'a suspended member may not');
select is(waytara.gw_ev_access('c1000000-0000-0000-0000-0000000000c1', 'ec000000-0000-0000-0000-000000000001'), 'owner', 'the owner still may');
select is(waytara.gw_cadence_access('a1000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-000000000001'), 'customer', 'a member with the Reports page may read the owner''s report files');
select is(waytara.gw_cadence_access('a1000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-00000000001b'), null::text, 'but not for a device they were not given');
select is(waytara.gw_cadence_access('a2000000-0000-0000-0000-0000000000a2', 'e1000000-0000-0000-0000-000000000001'), null::text, 'and a suspended member may not');
reset role;

select * from finish();
rollback;
