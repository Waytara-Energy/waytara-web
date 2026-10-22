-- Application Settings storage: a customer can change their own preferences, billing address and GST number (and nothing else on those
-- rows), a malformed GST number or an oversized preference is refused, and the pending e-mail codes are closed to the app.
-- Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@prefs.local'),
  ('c2000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@prefs.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('c1000000-0000-0000-0000-0000000000a1', 'a@prefs.local', 'customer', 'Asha'),
  ('c2000000-0000-0000-0000-0000000000a1', 'b@prefs.local', 'customer', 'Bala');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000a1'), ('c2000000-0000-0000-0000-0000000000a1');
insert into waytara.email_change_codes (user_id, new_email, code_hash, expires_at) values ('c1000000-0000-0000-0000-0000000000a1', 'new@prefs.local', 'x', now() + interval '10 minutes');

create or replace function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
end;
$$;

create or replace function pg_temp.rename_count(p uuid) returns int language plpgsql as $$
declare n int;
begin
  update waytara.profiles set full_name = 'Hacked' where id = p;
  get diagnostics n = row_count;
  return n;
end;
$$;

select pg_temp.as_user('c1000000-0000-0000-0000-0000000000a1');
select lives_ok($$update waytara.profiles set ui_preferences = '{"overview_cards":["solar","grid","load","battery"]}', security_preferences = '{"idle_minutes":30,"idle_scope":"all"}' where id = 'c1000000-0000-0000-0000-0000000000a1'$$, 'a customer saves their own preferences');
select is((select (security_preferences ->> 'idle_minutes')::int from waytara.profiles where id = 'c1000000-0000-0000-0000-0000000000a1'), 30, 'and reads them back');
select is(pg_temp.rename_count('c2000000-0000-0000-0000-0000000000a1'), 0, 'they cannot change somebody else''s profile');
select throws_ok($$update waytara.profiles set role = 'admin' where id = 'c1000000-0000-0000-0000-0000000000a1'$$, '42501', null, 'nor their own role');
select throws_ok($$update waytara.profiles set ui_preferences = (select jsonb_build_object('x', repeat('a', 9000))) where id = 'c1000000-0000-0000-0000-0000000000a1'$$, '23514', null, 'an oversized preference is refused');

select lives_ok($$update waytara.customers set billing_address = '{"line1":"1 Road","city":"Chennai","state":"Tamil Nadu","pincode":"600001"}', gstin = '33AABCU9603R1ZX', billing_email = 'bill@prefs.local' where id = 'c1000000-0000-0000-0000-0000000000a1'$$, 'a customer saves their billing details');
select throws_ok($$update waytara.customers set gstin = 'not-a-gst-number' where id = 'c1000000-0000-0000-0000-0000000000a1'$$, '23514', null, 'a malformed GST number is refused');
select throws_ok($$update waytara.customers set plan_id = null, status = 'active' where id = 'c1000000-0000-0000-0000-0000000000a1'$$, '42501', null, 'the plan and status stay out of reach');
select throws_ok($$select * from waytara.email_change_codes$$, '42501', null, 'the pending e-mail codes cannot be read by the app');

select * from finish();
rollback;
