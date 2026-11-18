-- A super user and the owner's support tickets and alert rules: they see, answer, open and close the owner's tickets, and manage the owner's alert rules (for the owner's
-- own sites only); an ordinary member and another customer see none of it. Rolled back at the end.
-- (Same rule as 15_*.test.sql: every assertion is one statement starting with "select <assertion>(" at the start of a line.)

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(15);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@super.local'),
  ('5a000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'super@super.local'),
  ('5b000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plain@super.local'),
  ('c2000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@super.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('c1000000-0000-0000-0000-0000000000f4', 'owner@super.local', 'customer', 'Owner'),
  ('5a000000-0000-0000-0000-0000000000f4', 'super@super.local', 'customer', 'Super User'),
  ('5b000000-0000-0000-0000-0000000000f4', 'plain@super.local', 'customer', 'Plain Member'),
  ('c2000000-0000-0000-0000-0000000000f4', 'other@super.local', 'customer', 'Other');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000f4'), ('c2000000-0000-0000-0000-0000000000f4');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000f4', 'c1000000-0000-0000-0000-0000000000f4', 'Owner villa', 'residential_independent_villas', 'hybrid'),
  ('52000000-0000-0000-0000-0000000000f4', 'c2000000-0000-0000-0000-0000000000f4', 'Other villa', 'residential_independent_villas', 'hybrid');
insert into waytara.team_members (id, owner_id, user_id, email, role, pages, can_schedule, status, accepted_at) values
  ('7e000000-0000-0000-0000-0000000000a4', 'c1000000-0000-0000-0000-0000000000f4', '5a000000-0000-0000-0000-0000000000f4', 'super@super.local', 'super', array['overview', 'monitoring', 'performance', 'reports', 'maintenance', 'site', 'devices'], true, 'active', now()),
  ('7e000000-0000-0000-0000-0000000000b4', 'c1000000-0000-0000-0000-0000000000f4', '5b000000-0000-0000-0000-0000000000f4', 'plain@super.local', 'viewer', array['overview'], false, 'active', now());

create or replace function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
end;
$$;
create or replace function pg_temp.back() returns void language plpgsql as $$ begin execute 'reset role'; end; $$;

-- ---- the owner opens a ticket -------------------------------------------------------------------------------------------------------------------------

select pg_temp.as_user('c1000000-0000-0000-0000-0000000000f4');
select set_config('test.t1', (waytara.support_create_ticket('51000000-0000-0000-0000-0000000000f4', null, 'device', 'Inverter beeps', 'It beeps every evening.') ->> 'ticket_id'), true);
select pg_temp.back();

-- ---- the super user ------------------------------------------------------------------------------------------------------------------------------------

select pg_temp.as_user('5a000000-0000-0000-0000-0000000000f4');
select is((select count(*)::int from waytara.support_tickets where id = current_setting('test.t1')::uuid), 1, 'a super user sees the owner''s ticket');
select is((select count(*)::int from waytara.support_messages where ticket_id = current_setting('test.t1')::uuid), 1, 'and its messages');
select lives_ok($$select waytara.support_send_message(current_setting('test.t1')::uuid, 'I will check it today.', false)$$, 'a super user answers it');
-- (every message of one transaction has the same time, so the message is found by who wrote it, not by being the latest)
select is((select sender_role from waytara.support_messages where ticket_id = current_setting('test.t1')::uuid and sender_id = '5a000000-0000-0000-0000-0000000000f4'), 'customer', 'as the customer''s side, under their own name');
select set_config('test.t2', (waytara.support_create_ticket('51000000-0000-0000-0000-0000000000f4', null, 'other', 'Opened by the super user', 'Hello team.') ->> 'ticket_id'), true);
select is((select customer_id from waytara.support_tickets where id = current_setting('test.t2')::uuid), 'c1000000-0000-0000-0000-0000000000f4'::uuid, 'a ticket a super user opens belongs to the owner');
select throws_ok($$select waytara.support_create_ticket('52000000-0000-0000-0000-0000000000f4', null, 'other', 'Not theirs', 'x')$$, '42501', null, 'but not on another customer''s site');
select lives_ok($$select waytara.support_customer_close(current_setting('test.t2')::uuid, 5::smallint, null)$$, 'a super user closes and rates the owner''s ticket');
select is((select status from waytara.support_tickets where id = current_setting('test.t2')::uuid), 'closed', 'and it is closed');
select lives_ok($$insert into waytara.alert_rules (customer_id, metric, op, threshold, name, site_id) values ('c1000000-0000-0000-0000-0000000000f4', 'battery_soc', 'below', 20, 'Set by the super user', '51000000-0000-0000-0000-0000000000f4')$$, 'a super user adds an alert rule for the owner');
select throws_ok($$insert into waytara.alert_rules (customer_id, metric, op, threshold, name, site_id) values ('c1000000-0000-0000-0000-0000000000f4', 'battery_soc', 'below', 20, 'Wrong site', '52000000-0000-0000-0000-0000000000f4')$$, '42501', null, 'but not on a site that is not the owner''s');
select throws_ok($$insert into waytara.alert_rules (customer_id, metric, op, threshold, name) values ('c2000000-0000-0000-0000-0000000000f4', 'battery_soc', 'below', 20, 'For somebody else')$$, '42501', null, 'nor for another customer');
select pg_temp.back();

-- ---- the owner, an ordinary member and another customer -----------------------------------------------------------------------------------------------

select pg_temp.as_user('c1000000-0000-0000-0000-0000000000f4');
select is((select count(*)::int from waytara.alert_rules where name = 'Set by the super user'), 1, 'the owner sees the rule the super user made');
select is((select count(*)::int from waytara.support_tickets), 2, 'and both tickets');
select pg_temp.back();

select pg_temp.as_user('5b000000-0000-0000-0000-0000000000f4');
select is((select count(*)::int from waytara.support_tickets) + (select count(*)::int from waytara.alert_rules), 0, 'an ordinary member sees no tickets and no alert rules');
select throws_ok($$select waytara.support_send_message(current_setting('test.t1')::uuid, 'Let me in.', false)$$, '42501', null, 'and cannot write in a ticket');
select pg_temp.back();

select * from finish();
rollback;
