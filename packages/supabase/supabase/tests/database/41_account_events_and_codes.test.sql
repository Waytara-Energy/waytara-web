-- Account activity and the password code: a person reads only their own activity and cannot write or delete it from the app; the codes for changing
-- a password are closed to the app entirely. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@events.local'),
  ('c2000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@events.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('c1000000-0000-0000-0000-0000000000c1', 'a@events.local', 'customer', 'Asha'),
  ('c2000000-0000-0000-0000-0000000000c1', 'b@events.local', 'customer', 'Bala');
insert into waytara.account_events (customer_id, kind, device) values
  ('c1000000-0000-0000-0000-0000000000c1', 'signin', 'Chrome on Windows'),
  ('c2000000-0000-0000-0000-0000000000c1', 'signin', 'Safari on iPhone');
insert into waytara.password_change_codes (user_id, code_hash, expires_at) values ('c2000000-0000-0000-0000-0000000000c1', 'abc', now() + interval '10 minutes');

create or replace function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
end;
$$;

select pg_temp.as_user('c1000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from waytara.account_events), 1, 'a person sees only their own activity');
select is((select device from waytara.account_events), 'Chrome on Windows', 'and it is theirs');
select throws_ok($$insert into waytara.account_events (customer_id, kind) values ('c1000000-0000-0000-0000-0000000000c1', 'signin')$$, '42501', null, 'the app cannot write activity');
select throws_ok($$delete from waytara.account_events$$, '42501', null, 'nor delete it');
select throws_ok($$select * from waytara.password_change_codes$$, '42501', null, 'the password codes are closed to the app');
select throws_ok($$insert into waytara.password_change_codes (user_id, code_hash, expires_at) values ('c1000000-0000-0000-0000-0000000000c1', 'x', now())$$, '42501', null, 'and cannot be written from it');

reset role;
select is((select count(*)::int from waytara.account_events where customer_id in ('c1000000-0000-0000-0000-0000000000c1', 'c2000000-0000-0000-0000-0000000000c1')), 2, 'the activity is still all there');

select * from finish();
rollback;
