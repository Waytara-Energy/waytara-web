-- A person's own sessions: they see only theirs, the current one is marked, and they can end another of theirs but nobody else's.
-- Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@sess.local'),
  ('c2000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@sess.local');
insert into auth.sessions (id, user_id, user_agent, ip) values
  ('51000000-0000-0000-0000-0000000000f1', 'c1000000-0000-0000-0000-0000000000f1', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', '10.0.0.1'),
  ('52000000-0000-0000-0000-0000000000f1', 'c1000000-0000-0000-0000-0000000000f1', 'Mozilla/5.0 (iPhone) Safari', '10.0.0.2'),
  ('53000000-0000-0000-0000-0000000000f1', 'c1000000-0000-0000-0000-0000000000f1', null, null),
  ('54000000-0000-0000-0000-0000000000f1', 'c2000000-0000-0000-0000-0000000000f1', 'Other person', '10.0.0.9');

create or replace function pg_temp.as_user(p_id uuid, p_session uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'session_id', p_session)::text, true);
end;
$$;

select pg_temp.as_user('c1000000-0000-0000-0000-0000000000f1', '51000000-0000-0000-0000-0000000000f1');
select is((select count(*)::int from waytara.my_sessions()), 3, 'a person sees their own three sessions, not anybody else''s');
select is((select count(*)::int from waytara.my_sessions() where is_current), 1, 'one of them is marked as this device');
select is((select id::text from waytara.my_sessions() where is_current), '51000000-0000-0000-0000-0000000000f1', 'the one named in the access token');
select is((select ip from waytara.my_sessions() where id = '51000000-0000-0000-0000-0000000000f1'), '10.0.0.1', 'with its address, without a mask suffix');
select throws_ok($$select * from auth.sessions$$, '42501', null, 'the auth table itself stays unreadable to the app');

select lives_ok($$select waytara.revoke_my_session('52000000-0000-0000-0000-0000000000f1')$$, 'a person ends another of their sessions');
select is((select count(*)::int from waytara.my_sessions()), 2, 'and it is gone from their list');
select lives_ok($$select waytara.revoke_my_session('54000000-0000-0000-0000-0000000000f1')$$, 'asking to end somebody else''s session does no harm');
reset role;
select is((select count(*)::int from auth.sessions where id = '54000000-0000-0000-0000-0000000000f1'), 1, 'and it is still there');

select * from finish();
rollback;
