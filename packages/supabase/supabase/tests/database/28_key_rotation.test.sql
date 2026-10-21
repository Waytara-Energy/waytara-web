-- Replacing a unit's key without locking it out: both keys work side by side, the old one is cut only when the unit has logged in with the
-- new one, an unfinished rotation is cancelled and the old key stays, one rotation at a time. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(20);

insert into auth.users (id, instance_id, aud, role, email) values
  ('50000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'backend8@test.local'),
  ('a0000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin8@test.local'),
  ('c1000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust8@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('a0000000-0000-0000-0000-0000000000c8', 'admin8@test.local', 'admin', 'Admin Eight'),
  ('c1000000-0000-0000-0000-0000000000c8', 'cust8@test.local', 'customer', 'Customer Eight');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000c8');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000c8', 'c1000000-0000-0000-0000-0000000000c8', 'Site', 'residential_independent_villas', 'hybrid');
insert into waytara.equipment_inventory (id, name, category) values
  ('99000000-0000-0000-0000-0000000000c8', 'Inverter', 'solar_inverter'), ('99000000-0000-0000-0000-0000000000d8', 'Charger', 'ev_charger');
insert into waytara.equipment (id, site_id, stock_id, label, device_status) values
  ('e1000000-0000-0000-0000-0000000000c8', '51000000-0000-0000-0000-0000000000c8', '99000000-0000-0000-0000-0000000000c8', 'Unit', 'active'),
  ('e2000000-0000-0000-0000-0000000000c8', '51000000-0000-0000-0000-0000000000c8', '99000000-0000-0000-0000-0000000000d8', 'Charger', 'active');
insert into waytara.equipment_keys (id, equipment_id, kind, key_ciphertext, key_fingerprint) values
  ('b1000000-0000-0000-0000-0000000000c8', 'e1000000-0000-0000-0000-0000000000c8', 'gateway', decode(repeat('ab', 40), 'hex'), 'fingerprint-old'),
  ('b2000000-0000-0000-0000-0000000000c8', 'e2000000-0000-0000-0000-0000000000c8', 'charger', decode(repeat('cd', 40), 'hex'), 'fingerprint-chg');
insert into waytara.gateway_service_users (user_id, label) values ('50000000-0000-0000-0000-0000000000c8', 'test backend');

-- these read the key table as its owner: the backend identity cannot (browsers never read it)
create or replace function pg_temp.active_keys(p_eq uuid) returns int language sql security definer as $$
  select count(*)::int from waytara.equipment_keys where equipment_id = p_eq and revoked_at is null
$$;
create or replace function pg_temp.reason(p_key uuid) returns text language sql security definer as $$
  select revoke_reason from waytara.equipment_keys where id = p_key
$$;
grant execute on function pg_temp.active_keys(uuid), pg_temp.reason(uuid) to public;

-- not the backend identity: refused
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000c8","role":"authenticated"}', true);
select throws_ok($$select waytara.gw_begin_rotation('b1000000-0000-0000-0000-0000000000c8', decode(repeat('ee', 40), 'hex'), 'fingerprint-new', 'a0000000-0000-0000-0000-0000000000c8')$$, '42501', null, 'only the backend identity can start a rotation');

select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000c8","role":"authenticated"}', true);

-- begin
create temp table _rot (j jsonb);
grant all on _rot to public;
insert into _rot select waytara.gw_begin_rotation('b1000000-0000-0000-0000-0000000000c8', decode(repeat('ee', 40), 'hex'), 'fingerprint-new', 'a0000000-0000-0000-0000-0000000000c8');
select is(pg_temp.active_keys('e1000000-0000-0000-0000-0000000000c8'), 2, 'while a rotation runs both keys work side by side');
select throws_ok($$select waytara.gw_begin_rotation('b1000000-0000-0000-0000-0000000000c8', decode(repeat('ff', 40), 'hex'), 'fingerprint-x', 'a0000000-0000-0000-0000-0000000000c8')$$, '23505', null, 'a second rotation of the same unit is refused while one is open');
select throws_ok($$select waytara.gw_begin_rotation('b2000000-0000-0000-0000-0000000000c8', decode(repeat('ff', 40), 'hex'), 'fingerprint-x', 'a0000000-0000-0000-0000-0000000000c8')$$, 'P0002', null, 'a charger key is not rotated this way (it is typed into the charger)');

select is(waytara.gw_rotation_staged((select (j ->> 'rotation_id')::uuid from _rot)), true, 'the unit reports it has the new key aside');
select is(waytara.gw_rotation_staged((select (j ->> 'rotation_id')::uuid from _rot)), false, 'and only once');
select is(waytara.gw_rotation_for_login((select (j ->> 'new_key_id')::uuid from _rot)), (select (j ->> 'rotation_id')::uuid from _rot), 'a login with the new key is recognised as this rotation''s');
select is(waytara.gw_rotation_for_login('b1000000-0000-0000-0000-0000000000c8'), null::uuid, 'a login with the old key is not');

-- complete
select is(waytara.gw_complete_rotation((select (j ->> 'rotation_id')::uuid from _rot)), true, 'the unit logs in with the new key: the rotation completes');
select is(pg_temp.reason('b1000000-0000-0000-0000-0000000000c8'), 'rotated', 'and the old key is cut');
select is(pg_temp.active_keys('e1000000-0000-0000-0000-0000000000c8'), 1, 'one key is left, the new one');
select is(waytara.gw_complete_rotation((select (j ->> 'rotation_id')::uuid from _rot)), false, 'completing twice does nothing');
reset role;
select is((select count(*)::int from waytara.device_activity where action = 'key_rotated' and equipment_id = 'e1000000-0000-0000-0000-0000000000c8'), 1, 'the activity log says the key was replaced');

-- cancel: the old key (now the first new one) stays, the new one is cut
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000c8","role":"authenticated"}', true);
create temp table _rot2 (j jsonb);
grant all on _rot2 to public;
insert into _rot2 select waytara.gw_begin_rotation((select (j ->> 'new_key_id')::uuid from _rot), decode(repeat('dd', 40), 'hex'), 'fingerprint-two', 'a0000000-0000-0000-0000-0000000000c8');
select is(waytara.gw_cancel_rotation((select (j ->> 'rotation_id')::uuid from _rot2), 'test'), true, 'a rotation can be cancelled');
select is(pg_temp.reason((select (j ->> 'new_key_id')::uuid from _rot2)), 'rotation_cancelled', 'the new key is cut');
select is(pg_temp.active_keys('e1000000-0000-0000-0000-0000000000c8'), 1, 'and the unit still has exactly its working key');
reset role;
select is((select count(*)::int from waytara.device_activity where action = 'key_rotation_failed'), 1, 'the activity log says it did not finish');

-- expiry
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000c8","role":"authenticated"}', true);
create temp table _rot3 (j jsonb);
grant all on _rot3 to public;
insert into _rot3 select waytara.gw_begin_rotation((select (j ->> 'new_key_id')::uuid from _rot), decode(repeat('cc', 40), 'hex'), 'fingerprint-three', 'a0000000-0000-0000-0000-0000000000c8');
reset role;
update waytara.key_rotations set expires_at = now() - interval '1 minute' where id = (select (j ->> 'rotation_id')::uuid from _rot3);
select is(waytara._expire_rotations(now()), 1, 'an unfinished rotation past its time is cancelled by the database');
select is((select state from waytara.key_rotations where id = (select (j ->> 'rotation_id')::uuid from _rot3)), 'cancelled', 'and its state says so');

-- who may read it
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000c8","role":"authenticated"}', true);
select is((select count(*)::int from waytara.key_rotations), 0, 'a customer sees no rotation rows');
reset role;

select * from finish();
rollback;
