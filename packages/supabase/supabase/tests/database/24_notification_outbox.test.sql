-- The device-status e-mail queue and the hub-health row: shape, one-event-one-row, and who can touch them. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(10);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local');
insert into waytara.profiles (id, email, role, full_name) values ('c1000000-0000-0000-0000-0000000000c1', 'c1@test.local', 'customer', 'C1');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000c1');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000c1', 'c1000000-0000-0000-0000-0000000000c1', 'S1', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-0000000000c9', 'Inv', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id) values
  ('e1000000-0000-0000-0000-0000000000c1', '51000000-0000-0000-0000-0000000000c1', '99000000-0000-0000-0000-0000000000c9');

-- hub_health is one row, made by the migration
select is((select count(*)::int from waytara.hub_health), 1, 'hub_health starts with its single row');
select throws_ok($$insert into waytara.hub_health (id) values (false)$$, '23514', null, 'a second hub_health row is refused');

-- the outbox: a customer message names the customer, an admin broadcast does not
select throws_ok(
  $$insert into waytara.notification_outbox (audience, kind, dedupe_key) values ('customer', 'offline', 'k1')$$,
  '23514', null, 'a customer message without a customer is refused');
select lives_ok(
  $$insert into waytara.notification_outbox (audience, kind, dedupe_key, payload) values ('admin', 'hub_down', 'hub_down:t1', '{"since":"x"}')$$,
  'an admin broadcast needs no customer');
select throws_ok(
  $$insert into waytara.notification_outbox (audience, kind, customer_id, dedupe_key) values ('customer', 'made_up', 'c1000000-0000-0000-0000-0000000000c1', 'k2')$$,
  '23514', null, 'an unknown kind is refused');

-- one event, one row
insert into waytara.notification_outbox (audience, kind, customer_id, device_id, dedupe_key)
values ('customer', 'offline', 'c1000000-0000-0000-0000-0000000000c1', 'e1000000-0000-0000-0000-0000000000c1', 'offline:alert-1');
select throws_ok(
  $$insert into waytara.notification_outbox (audience, kind, customer_id, dedupe_key) values ('customer', 'offline', 'c1000000-0000-0000-0000-0000000000c1', 'offline:alert-1')$$,
  '23505', null, 'the same event cannot be queued twice');

-- removing the device or the person removes their queue rows
delete from waytara.equipment where id = 'e1000000-0000-0000-0000-0000000000c1';
select is((select count(*)::int from waytara.notification_outbox where dedupe_key = 'offline:alert-1'), 0, 'deleting the device removes its queued messages');

insert into waytara.notification_state (customer_id, last_status_email_at) values ('c1000000-0000-0000-0000-0000000000c1', now());
delete from waytara.profiles where id = 'c1000000-0000-0000-0000-0000000000c1';
select is((select count(*)::int from waytara.notification_state), 0, 'deleting the person removes their e-mail timing row');

-- nobody signed in, and nobody anonymous, can read them
set local role authenticated;
select throws_ok($$select * from waytara.notification_outbox$$, '42501', null, 'a signed-in user cannot read the outbox');
reset role;
set local role anon;
select throws_ok($$select * from waytara.hub_health$$, '42501', null, 'an anonymous caller cannot read the hub health');
reset role;

select * from finish();
rollback;
