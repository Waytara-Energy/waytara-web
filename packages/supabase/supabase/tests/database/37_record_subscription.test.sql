-- Recording a subscription: only an admin can, the table stays closed to direct writes, a renewal is a new row, and the state can be changed.
-- Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust@sub.local'),
  ('a0000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@sub.local'),
  ('e1000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp@sub.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('c1000000-0000-0000-0000-0000000000e1', 'cust@sub.local', 'customer', 'Chitra Customer'),
  ('a0000000-0000-0000-0000-0000000000e1', 'admin@sub.local', 'admin', 'Asha Admin'),
  ('e1000000-0000-0000-0000-0000000000e1', 'emp@sub.local', 'employee', 'Emil Employee');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000e1');

select set_config('test.plan', (select id::text from waytara.plans order by price_monthly limit 1), true);

create or replace function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
end;
$$;
create or replace function pg_temp.back() returns void language plpgsql as $$ begin execute 'reset role'; end; $$;

-- ---- who may record one -------------------------------------------------------------------------------------------------------------------

select pg_temp.as_user('c1000000-0000-0000-0000-0000000000e1');
select throws_ok($$select waytara.record_subscription('c1000000-0000-0000-0000-0000000000e1', current_setting('test.plan')::uuid)$$, '42501', null, 'a customer cannot record their own subscription');
select throws_ok($$insert into waytara.subscriptions (customer_id, plan_id) values ('c1000000-0000-0000-0000-0000000000e1', current_setting('test.plan')::uuid)$$, '42501', null, 'nor write the table directly');
select pg_temp.as_user('e1000000-0000-0000-0000-0000000000e1');
select throws_ok($$select waytara.record_subscription('c1000000-0000-0000-0000-0000000000e1', current_setting('test.plan')::uuid)$$, '42501', null, 'an employee cannot either');

-- ---- an admin records one ------------------------------------------------------------------------------------------------------------------

select pg_temp.as_user('a0000000-0000-0000-0000-0000000000e1');
select set_config('test.s1', waytara.record_subscription('c1000000-0000-0000-0000-0000000000e1', current_setting('test.plan')::uuid, 'active', '2026-10-01T00:00:00Z', '2027-10-01T00:00:00Z', '  UPI-123  ')::text, true);
select is((select status::text from waytara.subscriptions where id = current_setting('test.s1')::uuid), 'active', 'an admin records an active subscription');
select is((select payment_gateway_ref from waytara.subscriptions where id = current_setting('test.s1')::uuid), 'UPI-123', 'with the payment reference, trimmed');
select is((select current_period_end::date::text from waytara.subscriptions where id = current_setting('test.s1')::uuid), '2027-10-01', 'and its period');
select throws_ok($$select waytara.record_subscription('c1000000-0000-0000-0000-0000000000e1', current_setting('test.plan')::uuid, 'active', '2026-10-01T00:00:00Z', '2026-09-01T00:00:00Z')$$, '22023', null, 'a period that ends before it starts is refused');
select throws_ok($$select waytara.record_subscription('99999999-9999-9999-9999-999999999999', current_setting('test.plan')::uuid)$$, '22023', null, 'an unknown customer is refused');
select throws_ok($$select waytara.record_subscription('c1000000-0000-0000-0000-0000000000e1', '99999999-9999-9999-9999-999999999999')$$, '22023', null, 'and an unknown plan');

-- ---- the customer sees it; a renewal is a new row --------------------------------------------------------------------------------------------

select pg_temp.as_user('c1000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from waytara.subscriptions), 1, 'the customer sees their subscription');
select pg_temp.as_user('a0000000-0000-0000-0000-0000000000e1');
select lives_ok($$select waytara.record_subscription('c1000000-0000-0000-0000-0000000000e1', current_setting('test.plan')::uuid, 'trialing', '2027-10-01T00:00:00Z', '2028-10-01T00:00:00Z')$$, 'a renewal is recorded as another row');
select is((select count(*)::int from waytara.subscriptions where customer_id = 'c1000000-0000-0000-0000-0000000000e1'), 2, 'the earlier one stays as history');

-- ---- changing the state --------------------------------------------------------------------------------------------------------------------

select waytara.set_subscription_status(current_setting('test.s1')::uuid, 'cancelled');
select is((select status::text from waytara.subscriptions where id = current_setting('test.s1')::uuid), 'cancelled', 'an admin cancels a subscription');
select throws_ok($$select waytara.set_subscription_status('99999999-9999-9999-9999-999999999999', 'active')$$, '22023', null, 'an unknown subscription is refused');

select * from finish();
rollback;
