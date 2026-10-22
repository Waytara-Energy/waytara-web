-- Customer alerts: a customer reads and writes only their own rules (on their own sites), a ready-made alert can be changed once, bad values are
-- refused, and the rule state is closed to the app. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(11);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rules.local'),
  ('c2000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rules.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('c1000000-0000-0000-0000-0000000000b1', 'a@rules.local', 'customer', 'Asha'),
  ('c2000000-0000-0000-0000-0000000000b1', 'b@rules.local', 'customer', 'Bala');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000b1'), ('c2000000-0000-0000-0000-0000000000b1');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000b1', 'c1000000-0000-0000-0000-0000000000b1', 'Villa', 'residential_independent_villas', 'hybrid'),
  ('52000000-0000-0000-0000-0000000000b1', 'c2000000-0000-0000-0000-0000000000b1', 'Other villa', 'residential_independent_villas', 'hybrid');
insert into waytara.alert_rules (customer_id, metric, op, threshold, name) values ('c2000000-0000-0000-0000-0000000000b1', 'battery_soc', 'below', 15, 'Bala''s rule');

create or replace function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
end;
$$;

select pg_temp.as_user('c1000000-0000-0000-0000-0000000000b1');
select lives_ok($$insert into waytara.alert_rules (customer_id, metric, op, threshold, name) values ('c1000000-0000-0000-0000-0000000000b1', 'battery_soc', 'below', 25, 'Mine')$$, 'a customer makes an alert of their own');
select is((select count(*)::int from waytara.alert_rules), 1, 'and sees only their own alerts');
select throws_ok($$insert into waytara.alert_rules (customer_id, metric, op, threshold) values ('c2000000-0000-0000-0000-0000000000b1', 'battery_soc', 'below', 5)$$, '42501', null, 'not one for somebody else');
select throws_ok($$insert into waytara.alert_rules (customer_id, metric, op, threshold, site_id) values ('c1000000-0000-0000-0000-0000000000b1', 'battery_soc', 'below', 5, '52000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'nor one on somebody else''s site');
select lives_ok($$insert into waytara.alert_rules (customer_id, metric, op, threshold, site_id) values ('c1000000-0000-0000-0000-0000000000b1', 'load_kw', 'above', 6, '51000000-0000-0000-0000-0000000000b1')$$, 'but on their own site is fine');
select throws_ok($$insert into waytara.alert_rules (customer_id, metric, op, threshold) values ('c1000000-0000-0000-0000-0000000000b1', 'battery_soc', 'sideways', 5)$$, '23514', null, 'a limit is above or below, nothing else');
select throws_ok($$insert into waytara.alert_rules (customer_id, metric, op, threshold, cooldown_minutes) values ('c1000000-0000-0000-0000-0000000000b1', 'battery_soc', 'below', 5, 1)$$, '23514', null, 'a cooldown of one minute is refused');

select lives_ok($$insert into waytara.alert_rules (customer_id, preset_id, metric, op, threshold, enabled) values ('c1000000-0000-0000-0000-0000000000b1', 'battery_low', 'battery_soc', 'below', 30, true)$$, 'a ready-made alert is changed with one row');
select throws_ok($$insert into waytara.alert_rules (customer_id, preset_id, metric, op, threshold) values ('c1000000-0000-0000-0000-0000000000b1', 'battery_low', 'battery_soc', 'below', 40)$$, '23505', null, 'but only one row per ready-made alert');
select throws_ok($$select * from waytara.alert_rule_state$$, '42501', null, 'the state of the rules is closed to the app');

reset role;
select is((select threshold::int from waytara.alert_rules where name = 'Bala''s rule'), 15, 'somebody else''s alert is untouched');

select * from finish();
rollback;
