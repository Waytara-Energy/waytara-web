-- Task A10 (part): releasing a unit from its device (gw_release_board). Rolled back at the end.
-- (Same rule as 15_*.test.sql: every assertion is one statement starting with "select <assertion>(" at the start of a line.)

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(12);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local'),
  ('e1000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e1@test.local'),
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  ('50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'svc@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.local', 'admin', 'Admin'),
  ('e1000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'employee', 'E1'),
  ('c1000000-0000-0000-0000-000000000001', 'c1@test.local', 'customer', 'C1');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-000000000001');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'S1', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values ('99000000-0000-0000-0000-000000000009', 'Inverter', 'solar_inverter');
insert into waytara.equipment (id, site_id, stock_id, label) values
  ('91000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009', 'Inverter 1'),
  ('92000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '99000000-0000-0000-0000-000000000009', 'Inverter 2');
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000a0', 'test backend');
insert into waytara.gateway_devices (equipment_id, hardware_id, claimed_by) values ('91000000-0000-0000-0000-000000000001', 'AABBCCDDEEFF', 'a0000000-0000-0000-0000-000000000001');
insert into waytara.equipment_keys (id, equipment_id, kind, label, key_ciphertext, key_fingerprint) values
  ('b1000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'gateway', 'board AABBCCDDEEFF', decode(repeat('ab', 40), 'hex'), 'abcdef012345');
insert into waytara.equipment_claim_tickets (id, equipment_id, issued_to, hardware_id, expires_at) values
  ('d1000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'AABBCCDDEEFF', now() + interval '10 minutes');

-- ---- nobody but the backend identity
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_release_board('91000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001')$$, '42501', null, 'not even an admin can call it directly');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_release_board('91000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000e1')$$, '42501', null, 'nor a staff member');
reset role;
select is((select count(*)::int from waytara.gateway_devices where equipment_id = '91000000-0000-0000-0000-000000000001'), 1, 'so the unit is still linked');

-- ---- the backend identity
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is(waytara.gw_release_board('92000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'), false, 'a device with no unit has nothing to release');
select is(waytara.gw_release_board('91000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '203.0.113.9'), true, 'a linked unit is released');
select is(waytara.gw_release_board('91000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'), false, 'and releasing again does nothing');
reset role;

select is((select count(*)::int from waytara.gateway_devices where equipment_id = '91000000-0000-0000-0000-000000000001'), 0, 'the link is gone');
select is((select revoke_reason from waytara.equipment_keys where id = 'b1000000-0000-0000-0000-000000000001'), 'released', 'the unit''s key is revoked, with the reason');
select ok((select used_at from waytara.equipment_claim_tickets where id = 'd1000000-0000-0000-0000-000000000001') is not null, 'a ticket that was not used yet can no longer be used');
select is((select count(*)::int from waytara.equipment_key_events where equipment_id = '91000000-0000-0000-0000-000000000001' and event = 'revoked' and detail ->> 'reason' = 'released' and actor = 'a0000000-0000-0000-0000-000000000001'), 1, 'who released it is recorded');
select is((select detail ->> 'hardware_id' from waytara.equipment_key_events where equipment_id = '91000000-0000-0000-0000-000000000001' and event = 'revoked' limit 1), 'AABBCCDDEEFF', 'with which unit it was');

-- the unit can now be set up for another device: its link is free
insert into waytara.gateway_devices (equipment_id, hardware_id, claimed_by) values ('92000000-0000-0000-0000-000000000002', 'AABBCCDDEEFF', 'a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from waytara.gateway_devices where hardware_id = 'AABBCCDDEEFF'), 1, 'the same unit can be linked to a different device afterwards');

select * from finish();
rollback;
