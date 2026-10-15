-- Task A4a: the helpers the backend uses for keys, and the claim of a board by a single-use ticket. Rolled back at the end.
-- (Same rule as 15_*.test.sql: every assertion is one statement starting with "select <assertion>(" at the start of a line.)

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(29);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local'),
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  ('e1000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e1@test.local'),
  ('50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'svc@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.local', 'admin', 'Admin'),
  ('c1000000-0000-0000-0000-000000000001', 'c1@test.local', 'customer', 'C1'),
  ('e1000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'employee', 'E1');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-000000000001');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'S1', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category, technical_specs) values
  ('99000000-0000-0000-0000-000000000009', 'Inv', 'solar_inverter', '{"mppt_count": 2, "phase": 1}');
insert into waytara.equipment (id, site_id, stock_id, label) values
  ('91000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009', 'Office inverter'),
  ('92000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009', 'Second inverter');
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000a0', 'test backend');

-- ---- not for browsers
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select * from waytara.gw_equipment_info('91000000-0000-0000-0000-000000000001')$$, '42501', null, 'a staff member cannot read equipment info through the backend functions');
select throws_ok($$select * from waytara.gw_issue_claim_ticket('91000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000e1', 'AABBCCDDEEFF')$$, '42501', null, 'a staff member cannot issue a ticket directly');
select throws_ok($$select * from waytara.gw_claim_peek('00000000-0000-0000-0000-000000000000', 'AABBCCDDEEFF')$$, '42501', null, 'a staff member cannot peek at a ticket');
reset role;

-- ---- the backend identity
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);

select is((select site_id from waytara.gw_equipment_info('91000000-0000-0000-0000-000000000001')), '51000000-0000-0000-0000-000000000001'::uuid, 'equipment info gives the site');
select is((select category from waytara.gw_equipment_info('91000000-0000-0000-0000-000000000001')), 'solar_inverter', 'and the kind of unit');
select is((select (technical_specs ->> 'mppt_count')::int from waytara.gw_equipment_info('91000000-0000-0000-0000-000000000001')), 2, 'and the stock specs (PV inputs)');
select is((select count(*)::int from waytara.gw_equipment_info('99999999-0000-0000-0000-000000000000')), 0, 'unknown equipment gives nothing');

select throws_ok($$select * from waytara.gw_issue_claim_ticket('91000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000e1', 'bad id!')$$, '22023', null, 'a malformed hardware id is refused');
select throws_ok($$select * from waytara.gw_issue_claim_ticket('99999999-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-0000000000e1', 'AABBCCDDEEFF')$$, 'P0002', null, 'a ticket for unknown equipment is refused');

create temp table _t (name text primary key, id uuid, eq uuid, key uuid);
grant all on _t to authenticated;
insert into _t (name, id) select 'first', ticket from waytara.gw_issue_claim_ticket('91000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000e1', 'AABBCCDDEEFF', '10.0.0.7');
select is((select equipment_id from waytara.gw_claim_peek((select id from _t where name = 'first'), 'AABBCCDDEEFF')), '91000000-0000-0000-0000-000000000001'::uuid, 'a fresh ticket is good for its board');
select throws_ok($$select * from waytara.gw_claim_peek((select id from _t where name = 'first'), 'AABBCCDDEE00')$$, 'P0002', null, 'but not for another board');
select throws_ok($$select * from waytara.gw_claim_peek('00000000-0000-0000-0000-000000000000', 'AABBCCDDEEFF')$$, 'P0002', null, 'and a made-up ticket is no good');

-- a newer ticket for the same equipment replaces the older one
insert into _t (name, id) select 'second', ticket from waytara.gw_issue_claim_ticket('91000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000e1', 'AABBCCDDEEFF', '10.0.0.7');
select throws_ok($$select * from waytara.gw_claim_peek((select id from _t where name = 'first'), 'AABBCCDDEEFF')$$, 'P0002', null, 'issuing a new ticket cancels the older one');

-- claiming
select throws_ok(
  $$select * from waytara.gw_claim_device((select id from _t where name = 'second'), 'AABBCCDDEEFF', decode('abcd', 'hex'), 'abcdef012345')$$,
  '22023', null, 'a too-short encrypted key is refused');
select throws_ok(
  $$select * from waytara.gw_claim_device((select id from _t where name = 'second'), 'AABBCCDDEE00', decode(repeat('ab', 40), 'hex'), 'abcdef012345')$$,
  'P0002', null, 'the wrong board cannot redeem the ticket');
select is(
  (select out_issued_to from waytara.gw_claim_device((select id from _t where name = 'second'), 'AABBCCDDEEFF', decode(repeat('ab', 40), 'hex'), 'abcdef012345', '10.0.0.7')),
  'e1000000-0000-0000-0000-0000000000e1'::uuid, 'the right board redeems it and learns who set it up');
select throws_ok(
  $$select * from waytara.gw_claim_device((select id from _t where name = 'second'), 'AABBCCDDEEFF', decode(repeat('cd', 40), 'hex'), 'cdef01234567')$$,
  'P0002', null, 'a ticket works only once');

-- claiming again replaces the old key
insert into _t (name, id) select 'third', ticket from waytara.gw_issue_claim_ticket('91000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'AABBCCDDEEFF');
select is(
  (select out_issued_to from waytara.gw_claim_device((select id from _t where name = 'third'), 'AABBCCDDEEFF', decode(repeat('ef', 40), 'hex'), 'ef0123456789')),
  'a0000000-0000-0000-0000-000000000001'::uuid, 'the same board can be claimed again');
select is((select count(*)::int from waytara.gw_active_keys('91000000-0000-0000-0000-000000000001')), 1, 'and only the newest key works');

-- one board, one equipment
insert into _t (name, id) select 'other', ticket from waytara.gw_issue_claim_ticket('92000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'AABBCCDDEEFF');
select throws_ok(
  $$select * from waytara.gw_claim_device((select id from _t where name = 'other'), 'AABBCCDDEEFF', decode(repeat('12', 40), 'hex'), '123456789012')$$,
  '23505', null, 'a board that belongs to other equipment cannot be claimed for this one');
reset role;

-- ---- what was written (read as the database owner)
select is((select count(*)::int from waytara.equipment_keys where equipment_id = '91000000-0000-0000-0000-000000000001'), 2, 'two keys were made for the first equipment');
select is((select count(*)::int from waytara.equipment_keys where equipment_id = '91000000-0000-0000-0000-000000000001' and revoked_at is null), 1, 'one of them is still live');
select is((select revoke_reason from waytara.equipment_keys where equipment_id = '91000000-0000-0000-0000-000000000001' and revoked_at is not null), 'reclaimed', 'the older one is marked reclaimed');
select is((select hardware_id from waytara.gateway_devices where equipment_id = '91000000-0000-0000-0000-000000000001'), 'AABBCCDDEEFF', 'the board is recorded');
select is((select claimed_by from waytara.gateway_devices where equipment_id = '91000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000001'::uuid, 'with who claimed it last');
select is((select count(*)::int from waytara.equipment_key_events where event = 'claimed'), 2, 'each claim is in the audit trail');
select is((select count(*)::int from waytara.equipment_key_events where event = 'ticket_issued'), 4, 'and each ticket');
select is((select count(*)::int from waytara.equipment_key_events where event = 'revoked' and detail ->> 'reason' = 'reclaimed'), 1, 'and the replaced key');
select ok(not exists (select 1 from waytara.equipment_claim_tickets where used_at is null and equipment_id = '91000000-0000-0000-0000-000000000001'), 'no ticket is left open for the first equipment');

select * from finish();
rollback;
