-- Task A1: who may see a site (owner, admin, assigned staff, legacy onboarding employee), and the equipment keys. Rolled back at the end.
--
-- Every pgTAP assertion below is a single statement that starts with "select <assertion>(" at the beginning of a line and ends with ");"
-- so a runner without psql can wrap and collect them. Setup statements never start with those words.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(56);

-- ---- people: admin A, customers C1 and C2, employees E1 (assigned), E2 (nobody), E3 (legacy onboarding), E4, site engineer SE, service user SU
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local'),
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  ('c2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@test.local'),
  ('e1000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e1@test.local'),
  ('e2000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e2@test.local'),
  ('e3000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e3@test.local'),
  ('e4000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e4@test.local'),
  ('5e000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'se@test.local'),
  ('50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'svc@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.local', 'admin', 'Admin'),
  ('c1000000-0000-0000-0000-000000000001', 'c1@test.local', 'customer', 'C1'),
  ('c2000000-0000-0000-0000-000000000002', 'c2@test.local', 'customer', 'C2'),
  ('e1000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'employee', 'E1'),
  ('e2000000-0000-0000-0000-0000000000e2', 'e2@test.local', 'employee', 'E2'),
  ('e3000000-0000-0000-0000-0000000000e3', 'e3@test.local', 'employee', 'E3'),
  ('e4000000-0000-0000-0000-0000000000e4', 'e4@test.local', 'employee', 'E4'),
  ('5e000000-0000-0000-0000-0000000000a5', 'se@test.local', 'site_engineer', 'SE'),
  ('50000000-0000-0000-0000-0000000000a0', 'svc@test.local', 'employee', 'Service');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-000000000001'), ('c2000000-0000-0000-0000-000000000002');

-- ---- sites: S1 (C1), S2 (C2), S3 (C1, hidden by the customer)
insert into waytara.sites (id, customer_id, name, property_type, power_source_category, customer_hidden_at) values
  ('51000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'S1', 'residential_independent_villas', 'hybrid', null),
  ('52000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'S2', 'residential_independent_villas', 'hybrid', null),
  ('53000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'S3 hidden', 'residential_independent_villas', 'hybrid', now());
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-000000000009', 'Inv', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id) values
  ('91000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009'),
  ('92000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', '99000000-0000-0000-0000-000000000009');
insert into waytara.equipment_latest (equipment_id, key_name, value, unit, ts) values
  ('91000000-0000-0000-0000-000000000001', 'pv1_power_w', 100, 'W', now()),
  ('92000000-0000-0000-0000-000000000002', 'pv1_power_w', 200, 'W', now());

-- ---- legacy route: E3 is the onboarding employee of C1
insert into waytara.leads (id, full_name, email) values ('1ead0000-0000-0000-0000-000000000001', 'Lead', 'lead@test.local');
insert into waytara.customer_onboarding (customer_id, employee_id, lead_id)
values ('c1000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-0000000000e3', '1ead0000-0000-0000-0000-000000000001');

-- ---- assignments: E1 and SE on S1; the backend identity
insert into waytara.site_staff (site_id, staff_id, granted_by) values
  ('51000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-000000000001'),
  ('51000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-0000000000a5', 'a0000000-0000-0000-0000-000000000001');
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000a0', 'test backend');

-- ---- assignments: rules
select throws_ok(
  $$insert into waytara.site_staff (site_id, staff_id) values ('51000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002')$$,
  '23514', null, 'a customer cannot be assigned to a site as staff');
select throws_ok(
  $$insert into waytara.site_staff (site_id, staff_id) values ('51000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000e1')$$,
  '23505', null, 'a person has one live assignment per site');
select throws_ok(
  $$insert into waytara.site_staff (site_id, staff_id, granted_at, expires_at) values ('52000000-0000-0000-0000-000000000002', 'e4000000-0000-0000-0000-0000000000e4', now(), now() - interval '1 day')$$,
  '23514', null, 'an assignment cannot expire before it starts');

-- ---- what assigned staff can read (E1 and the site engineer are on S1)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from waytara.sites), 1, 'assigned employee sees exactly one site');
select is((select id from waytara.sites), '51000000-0000-0000-0000-000000000001'::uuid, 'and it is S1');
select is((select count(*)::int from waytara.equipment), 1, 'assigned employee sees that site''s equipment');
select is((select count(*)::int from waytara.equipment_latest), 1, 'and its latest values');
select is((select count(*)::int from waytara.equipment_latest where equipment_id = '92000000-0000-0000-0000-000000000002'), 0, 'but not another site''s values');
select is((select count(*)::int from waytara.site_staff), 1, 'an employee sees only their own assignment row');
select throws_ok(
  $$insert into waytara.site_staff (site_id, staff_id) values ('52000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-0000000000e1')$$,
  '42501', null, 'an employee cannot assign themselves to a site');
select set_config('request.jwt.claims', '{"sub":"5e000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
select is((select count(*)::int from waytara.sites), 1, 'an assigned site engineer sees only the assigned site');

-- ---- staff who are not assigned
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
select is((select count(*)::int from waytara.sites), 0, 'an unassigned employee sees no sites');
select is((select count(*)::int from waytara.equipment), 0, 'and no equipment');
select is((select count(*)::int from waytara.equipment_latest), 0, 'and no values');

-- ---- the admin manages assignments
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$insert into waytara.site_staff (site_id, staff_id, granted_by) values ('52000000-0000-0000-0000-000000000002', 'e4000000-0000-0000-0000-0000000000e4', 'a0000000-0000-0000-0000-000000000001')$$,
  'an admin can assign an employee to a site');
select is((select count(*)::int from waytara.site_staff), 3, 'an admin sees every assignment');
reset role;

-- ---- an expired, removed or deactivated assignment stops working
update waytara.site_staff set granted_at = now() - interval '2 days', expires_at = now() - interval '1 day'
 where staff_id = 'e1000000-0000-0000-0000-0000000000e1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from waytara.sites), 0, 'an expired permission stops access');
reset role;
update waytara.site_staff set expires_at = null, removed_at = now() where staff_id = 'e1000000-0000-0000-0000-0000000000e1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from waytara.sites), 0, 'a removed permission stops access');
reset role;
update waytara.site_staff set removed_at = null where staff_id = 'e1000000-0000-0000-0000-0000000000e1';
update waytara.profiles set deactivated_at = now() where id = 'e1000000-0000-0000-0000-0000000000e1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from waytara.sites), 0, 'a deactivated employee loses access even with a live permission');
reset role;
update waytara.profiles set deactivated_at = null where id = 'e1000000-0000-0000-0000-0000000000e1';

-- ---- the full answer used by the backend
select is(waytara.can_access_site_as('a0000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001'), true, 'admin: yes');
select is(waytara.can_access_site_as('c1000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001'), true, 'owner: yes');
select is(waytara.can_access_site_as('c2000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001'), false, 'another customer: no');
select is(waytara.can_access_site_as('e1000000-0000-0000-0000-0000000000e1', '51000000-0000-0000-0000-000000000001'), true, 'assigned employee: yes');
select is(waytara.can_access_site_as('e2000000-0000-0000-0000-0000000000e2', '51000000-0000-0000-0000-000000000001'), false, 'unassigned employee: no');
select is(waytara.can_access_site_as('e3000000-0000-0000-0000-0000000000e3', '51000000-0000-0000-0000-000000000001'), true, 'legacy onboarding employee: yes');
select is(waytara.can_access_site_as('c1000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000003'), false, 'a site the customer hid: no');
select is(waytara.can_access_site_as(null, '51000000-0000-0000-0000-000000000001'), false, 'nobody signed in: no');

-- ---- keys: nobody but the backend identity can create or read the secret
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok(
  $$select waytara.gw_create_key('91000000-0000-0000-0000-000000000001', 'gateway', 'x', decode(repeat('ab', 40), 'hex'), 'abcdef0123', 'e1000000-0000-0000-0000-0000000000e1')$$,
  '42501', null, 'a staff member cannot call the key functions directly');
select throws_ok(
  $$insert into waytara.equipment_keys (equipment_id, kind, key_ciphertext, key_fingerprint) values ('91000000-0000-0000-0000-000000000001', 'gateway', decode(repeat('ab', 40), 'hex'), 'abcdef0123')$$,
  '42501', null, 'nobody can insert a key row from a browser');
select throws_ok($$select waytara.gw_active_keys('91000000-0000-0000-0000-000000000001')$$, '42501', null, 'only the backend may read active keys');
select throws_ok($$select waytara.gw_actor_can_access_site('e1000000-0000-0000-0000-0000000000e1', '51000000-0000-0000-0000-000000000001')$$, '42501', null, 'only the backend may ask about someone else');
reset role;

-- ---- the backend identity at work
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is(waytara.gw_actor_can_access_site('e1000000-0000-0000-0000-0000000000e1', '51000000-0000-0000-0000-000000000001'), true, 'the backend can ask about an assigned employee');
select is(waytara.gw_actor_can_manage_keys('a0000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001'), true, 'an admin may manage keys');
select is(waytara.gw_actor_can_manage_keys('e1000000-0000-0000-0000-0000000000e1', '91000000-0000-0000-0000-000000000001'), true, 'an assigned employee may manage keys');
select is(waytara.gw_actor_can_manage_keys('c1000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001'), false, 'a customer may not manage keys by hand');
select is(waytara.gw_actor_can_manage_keys('e2000000-0000-0000-0000-0000000000e2', '91000000-0000-0000-0000-000000000001'), false, 'an unassigned employee may not manage keys');
select throws_ok(
  $$select waytara.gw_create_key('91000000-0000-0000-0000-000000000001', 'gateway', 'x', decode('abcd', 'hex'), 'abcdef0123', 'a0000000-0000-0000-0000-000000000001')$$,
  '22023', null, 'a too-short encrypted key is refused');
select throws_ok(
  $$select waytara.gw_create_key('91000000-0000-0000-0000-000000000001', 'toaster', 'x', decode(repeat('ab', 40), 'hex'), 'abcdef0123', 'a0000000-0000-0000-0000-000000000001')$$,
  '22023', null, 'an unknown key kind is refused');
create temp table _k (name text primary key, id uuid);
grant all on _k to authenticated;
insert into _k select 'first', waytara.gw_create_key('91000000-0000-0000-0000-000000000001', 'gateway', 'board 1', decode(repeat('ab', 40), 'hex'), 'abcdef0123', 'e1000000-0000-0000-0000-0000000000e1', '10.0.0.5');
insert into _k select 'other', waytara.gw_create_key('92000000-0000-0000-0000-000000000002', 'gateway', 'board 2', decode(repeat('cd', 40), 'hex'), 'cdef012345', 'a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from waytara.gw_active_keys('91000000-0000-0000-0000-000000000001')), 1, 'the backend sees the active key');
select waytara.gw_touch_key((select id from _k where name = 'first'), '10.0.0.5');
insert into _k select 'rot0', waytara.gw_rotate_key((select id from _k where name = 'first'), decode(repeat('ef', 40), 'hex'), 'ef01234567', 'a0000000-0000-0000-0000-000000000001', '10.0.0.6', 0);
select is((select count(*)::int from waytara.gw_active_keys('91000000-0000-0000-0000-000000000001')), 1, 'rotating with no grace leaves exactly one active key');
insert into _k select 'rot60', waytara.gw_rotate_key((select id from _k where name = 'rot0'), decode(repeat('12', 40), 'hex'), '1234567890', 'a0000000-0000-0000-0000-000000000001', '10.0.0.6', 60);
select is((select count(*)::int from waytara.gw_active_keys('91000000-0000-0000-0000-000000000001')), 2, 'rotating with a grace period keeps both keys working for a moment');
select is(waytara.gw_revoke_key((select id from _k where name = 'rot60'), 'a0000000-0000-0000-0000-000000000001', '10.0.0.6', 'lost board'), true, 'revoking an active key works');
select is(waytara.gw_revoke_key((select id from _k where name = 'rot60'), 'a0000000-0000-0000-0000-000000000001', '10.0.0.6', 'again'), false, 'revoking it twice does nothing');
select is((select count(*)::int from waytara.gw_active_keys('91000000-0000-0000-0000-000000000001')), 1, 'after the revoke only the old key, still inside its grace period, remains');
reset role;

-- ---- the audit trail (read as the database owner: browsers see it only for their own sites)
select is((select count(*)::int from waytara.equipment_key_events where event = 'created'), 2, 'each creation is in the audit trail');
select is((select count(*)::int from waytara.equipment_key_events where event = 'rotated'), 2, 'each rotation is in the audit trail');
select is((select count(*)::int from waytara.equipment_key_events where event = 'revoked'), 1, 'and the revoke');
select isnt((select last_used_at from waytara.equipment_keys where id = (select id from _k where name = 'first')), null, 'using a key stamps when it was last used');
select is((select revoke_reason from waytara.equipment_keys where id = (select id from _k where name = 'first')), 'rotated', 'a key replaced without grace is marked rotated');
select ok((select expires_at from waytara.equipment_keys where id = (select id from _k where name = 'rot0')) between now() and now() + interval '61 seconds', 'a key replaced with a grace period stops working inside that period');

-- ---- what a browser can see of a key
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from waytara.equipment_keys where equipment_id = '91000000-0000-0000-0000-000000000001' and revoked_at is null), 1, 'an assigned employee sees the live key row');
select throws_ok($$select key_ciphertext from waytara.equipment_keys$$, '42501', null, 'but never the secret');
select is((select count(*)::int from waytara.equipment_keys where equipment_id = '92000000-0000-0000-0000-000000000002'), 0, 'and not another site''s keys');
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
select is((select count(*)::int from waytara.equipment_keys), 0, 'an unassigned employee sees no keys');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from waytara.equipment_keys), 0, 'a customer sees no keys');
select throws_ok($$select * from waytara.equipment_claim_tickets$$, '42501', null, 'claim tickets are not readable from a browser');
reset role;

select * from finish();
rollback;
