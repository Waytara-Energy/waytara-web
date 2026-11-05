-- Partner applications (pgTAP): visitors can only submit, admins review. Run with the rest:
--   node scripts/local-db.mjs up && pnpm --filter @waytara/supabase test:db

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(11);

\set adm '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
\set emp '''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'''

insert into auth.users (id, instance_id, aud, role, email) values
  (:adm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm@test.local'),
  (:emp, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp@test.local');

insert into waytara.profiles (id, email, role, full_name) values
  (:adm, 'adm@test.local', 'admin',    'Admin'),
  (:emp, 'emp@test.local', 'employee', 'Employee');

-- ------------------------------------------------------------------
-- A visitor who is not logged in
-- ------------------------------------------------------------------
set local role anon;

select lives_ok(
  $$ insert into waytara.partner_applications (company_name, contact_name, phone, email, states, services)
     values ('Test Solar', 'A Person', '9876543210', 'p@test.local', array['Tamil Nadu'], array['solar']) $$,
  'anon CAN submit a partner application');
select throws_ok($$ select count(*) from waytara.partner_applications $$, '42501', null, 'anon cannot read applications');
select throws_ok(
  $$ insert into waytara.partner_applications (company_name, contact_name, phone, email, status)
     values ('Bad', 'A Person', '9876543210', 'b@test.local', 'approved') $$,
  '42501', null, 'anon cannot submit a pre-approved application');
select throws_ok(
  $$ insert into waytara.partner_applications (company_name, contact_name, phone, email, admin_notes)
     values ('Bad', 'A Person', '9876543210', 'b@test.local', 'looks great') $$,
  '42501', null, 'anon cannot write admin notes');
select throws_ok(
  $$ insert into waytara.partner_applications (company_name, contact_name, phone, email, message)
     values ('Big', 'A Person', '9876543210', 'b@test.local', repeat('x', 6000)) $$,
  '23514', null, 'an oversized message is rejected');
select throws_ok($$ update waytara.partner_applications set status = 'approved' $$, '42501', null, 'anon cannot change a status');

reset role;

-- ------------------------------------------------------------------
-- An employee: not an admin, so no access
-- ------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'role', 'authenticated')::text, true);
set local role authenticated;

select is((select count(*)::int from waytara.partner_applications), 0, 'an employee sees no applications');

reset role;

-- ------------------------------------------------------------------
-- An admin
-- ------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;

select is((select count(*)::int from waytara.partner_applications), 1, 'an admin sees the application');
select lives_ok(
  $$ update waytara.partner_applications set status = 'in_review', admin_notes = 'Called back', reviewed_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', reviewed_at = now() $$,
  'an admin can review it');
select throws_ok($$ update waytara.partner_applications set status = 'unknown' $$, '23514', null, 'only the four statuses are allowed');
select throws_ok($$ delete from waytara.partner_applications $$, '42501', null, 'nobody deletes through the app');

reset role;

select * from finish();
rollback;
