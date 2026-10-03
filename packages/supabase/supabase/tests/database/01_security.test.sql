-- Security regression tests (pgTAP). Run against the local production-shaped
-- database:  node scripts/local-db.mjs up && pnpm --filter @waytara/supabase test:db
--
-- Everything runs inside one transaction that is rolled back, so it leaves no
-- data behind. Roles are impersonated the same way PostgREST does it: switch
-- the Postgres role and set the JWT claims that auth.uid() reads.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(39);

-- Runs a statement as the CURRENT role (so RLS applies) and returns how many
-- rows it touched. "0 rows" is how RLS reports a write it silently filtered.
create function pg_temp.rows_affected(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end $$;


-- ------------------------------------------------------------------
-- Fixtures (inserted as the superuser, i.e. RLS bypassed)
-- ------------------------------------------------------------------
\set c1 '''11111111-1111-1111-1111-111111111111'''
\set c2 '''22222222-2222-2222-2222-222222222222'''
\set adm '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
\set emp '''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'''

insert into auth.users (id, instance_id, aud, role, email) values
  (:c1,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  (:c2,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@test.local'),
  (:adm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm@test.local'),
  (:emp, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp@test.local');

insert into waytara.profiles (id, email, role, full_name) values
  (:c1,  'c1@test.local',  'customer', 'Customer One'),
  (:c2,  'c2@test.local',  'customer', 'Customer Two'),
  (:adm, 'adm@test.local', 'admin',    'Admin'),
  (:emp, 'emp@test.local', 'employee', 'Employee');

insert into waytara.customers (id) values (:c1), (:c2);

insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', :c1, 'Site 1', 'residential_independent_villas', 'hybrid'),
  ('52000000-0000-0000-0000-000000000002', :c2, 'Site 2', 'residential_independent_villas', 'hybrid');

insert into waytara.equipment_inventory (id, name, category) values
  ('99000000-0000-0000-0000-000000000009', 'Test inverter', 'solar_inverter');

insert into waytara.equipment (id, site_id, stock_id, label) values
  ('e1000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009', 'Dev 1'),
  ('e2000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', '99000000-0000-0000-0000-000000000009', 'Dev 2');

insert into waytara.equipment_telemetry (equipment_id, ts, key_name, value) values
  ('e1000000-0000-0000-0000-000000000001', now(), 'battery_soc_pct', 80),
  ('e2000000-0000-0000-0000-000000000002', now(), 'battery_soc_pct', 20);

insert into waytara.leads (id, full_name, email) values ('1ead0000-0000-0000-0000-000000000001', 'Existing Lead', 'lead@test.local');

-- employee is assigned to customer 1 only
insert into waytara.customer_onboarding (customer_id, employee_id, lead_id)
values (:c1, :emp, '1ead0000-0000-0000-0000-000000000001');

insert into waytara.support_tickets (id, customer_id, subject) values
  ('70000000-0000-0000-0000-000000000001', :c1, 'C1 ticket'),
  ('70000000-0000-0000-0000-000000000002', :c2, 'C2 ticket');

-- ------------------------------------------------------------------
-- 1. Anonymous (logged-out) visitor
-- ------------------------------------------------------------------
set local role anon;

select throws_ok($$ select count(*) from waytara.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select count(*) from waytara.equipment $$, '42501', null, 'anon cannot read equipment');
select throws_ok($$ select count(*) from waytara.equipment_telemetry $$, '42501', null, 'anon cannot read telemetry');
select throws_ok($$ select count(*) from waytara.leads $$, '42501', null, 'anon cannot read leads (insert-only)');
select throws_ok($$ select waytara.is_admin() $$, '42501', null, 'anon cannot call is_admin()');
select throws_ok($$ select waytara.consume_rate_limit('x','y',1,1) $$, '42501', null, 'anon cannot call the rate limiter');
select lives_ok($$ insert into waytara.leads (full_name, email) values ('Visitor', 'v@test.local') $$, 'anon CAN submit a normal lead');
select throws_ok($$ insert into waytara.leads (full_name, email, status) values ('Bad', 'b@test.local', 'converted') $$, '42501', null, 'anon cannot insert a pre-converted lead');
select throws_ok(
  $$ insert into waytara.leads (full_name, email, assigned_to) values ('Bad', 'b@test.local', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') $$,
  '42501', null, 'anon cannot pre-assign a lead');
select throws_ok($$ insert into waytara.leads (full_name, email, message) values ('Big', 'b@test.local', repeat('x', 6000)) $$, '23514', null, 'oversized lead message is rejected');

reset role;

-- ------------------------------------------------------------------
-- 2. Customer 1 (authenticated)
-- ------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;

select is((select count(*)::int from waytara.sites), 1, 'customer sees only their own site');
select is((select count(*)::int from waytara.equipment), 1, 'customer sees only their own device');
select is((select count(*)::int from waytara.equipment_telemetry where equipment_id = 'e2000000-0000-0000-0000-000000000002'), 0, 'customer cannot read another customer''s telemetry');
select is((select count(*)::int from waytara.equipment_telemetry), 1, 'customer sees only their own telemetry');
select is((select count(*)::int from waytara.profiles), 1, 'customer sees only their own profile');
select is((select count(*)::int from waytara.support_tickets), 1, 'customer sees only their own tickets');
select is((select count(*)::int from waytara.audit_log), 0, 'customer sees no audit log');

select throws_ok($$ update waytara.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111' $$, '42501', null, 'customer cannot promote themselves to admin');
select lives_ok($$ update waytara.profiles set full_name = 'Renamed' where id = '11111111-1111-1111-1111-111111111111' $$, 'customer can edit their own name');
select is(
  pg_temp.rows_affected($q$ update waytara.profiles set full_name = 'Hacked' where id = '22222222-2222-2222-2222-222222222222' $q$),
  0, 'customer cannot edit another customer''s profile');
select throws_ok($$ update waytara.equipment set device_status = 'decommissioned' where id = 'e1000000-0000-0000-0000-000000000001' $$, '42501', null, 'customer cannot change device status');
select throws_ok($$ update waytara.equipment set site_id = '52000000-0000-0000-0000-000000000002' where id = 'e1000000-0000-0000-0000-000000000001' $$, '42501', null, 'customer cannot move a device to another site');
select lives_ok($$ update waytara.equipment set label = 'My inverter' where id = 'e1000000-0000-0000-0000-000000000001' $$, 'customer can rename their own device');
select is(
  pg_temp.rows_affected($q$ update waytara.equipment set label = 'Hacked' where id = 'e2000000-0000-0000-0000-000000000002' $q$),
  0, 'customer cannot rename another customer''s device');
select throws_ok($$ select waytara.consume_rate_limit('x','y',1,1) $$, '42501', null, 'customer cannot call the rate limiter');
select throws_ok($$ delete from waytara.audit_log $$, '42501', null, 'customer cannot delete audit rows');
select throws_ok($$ insert into waytara.equipment_telemetry (equipment_id, ts, key_name, value) values ('e1000000-0000-0000-0000-000000000001', now(), 'battery_soc_pct', 100) $$, '42501', null, 'customer cannot forge telemetry');

reset role;

-- ------------------------------------------------------------------
-- 3. Employee assigned to customer 1
-- ------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'role', 'authenticated')::text, true);
set local role authenticated;

select is((select count(*)::int from waytara.sites), 1, 'employee sees only assigned customers'' sites');
select is((select count(*)::int from waytara.support_tickets), 1, 'employee sees only assigned customers'' tickets');
select is((select count(*)::int from waytara.audit_log), 0, 'employee cannot read the audit log');
select is((select count(*)::int from waytara.profiles), 1, 'employee cannot read other users'' profiles');

reset role;

-- ------------------------------------------------------------------
-- 4. Admin
-- ------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;

select is((select count(*)::int from waytara.sites), 2, 'admin sees every site');
select is((select waytara.is_admin()), true, 'is_admin() is true for the admin');
select throws_ok($$ delete from waytara.audit_log $$, '42501', null, 'even an admin cannot delete audit rows');
select throws_ok($$ update waytara.audit_log set action = 'x' $$, '42501', null, 'even an admin cannot rewrite audit rows');

reset role;

-- ------------------------------------------------------------------
-- 5. Rate limiter + storage + scheduling (superuser / service paths)
-- ------------------------------------------------------------------
select is(
  (select string_agg(waytara.consume_rate_limit('t','k',3,60)::text, ',') from generate_series(1,5)),
  'true,true,true,false,false', 'rate limiter allows N hits then blocks');
select is(waytara.consume_rate_limit('t','another-key',3,60), true, 'rate limiter keys are independent');
select is((select public from storage.buckets where id = 'quotation-pdfs'), false, 'quotation-pdfs bucket is private');
select is((select count(*)::int from cron.job where jobname in ('detect-alerts','detect-charging-sessions')), 2, 'cron jobs are scheduled');

select * from finish();
rollback;
