-- Electricity rates: anyone signed in may read them, only an admin may change them, one rate per state/category/date.
-- Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(13);

\set c1 '''11111111-1111-1111-1111-111111111111'''
\set adm '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''

insert into auth.users (id, instance_id, aud, role, email) values
  (:c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local'),
  (:adm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm@test.local');
insert into waytara.profiles (id, email, role, full_name) values (:c1, 'c1@test.local', 'customer', 'C1'), (:adm, 'adm@test.local', 'admin', 'Adm');
insert into waytara.customers (id) values (:c1);

insert into waytara.electricity_tariffs (state, category, rate_per_kwh, effective_from, confidence) values
  ('Testland', 'residential', 6.00, '2025-07-01', 'verified'),
  ('Testland', 'residential', 6.20, '2026-07-01', 'verified');

select throws_ok($$ insert into waytara.electricity_tariffs (state, category, rate_per_kwh, effective_from) values ('Testland', 'residential', 7, '2026-07-01') $$, '23505', null, 'one rate per state, category and date');
select throws_ok($$ insert into waytara.electricity_tariffs (state, category, rate_per_kwh, effective_from) values ('Kerala', 'agricultural', 5, '2026-01-01') $$, '23514', null, 'only residential, commercial and industrial');
select throws_ok($$ insert into waytara.electricity_tariffs (state, category, rate_per_kwh, effective_from) values ('Kerala', 'residential', -1, '2026-01-01') $$, '23514', null, 'a rate cannot be negative');
select is((select rate_per_kwh from waytara.electricity_tariffs where state = 'Testland' and category = 'residential' and effective_from <= '2026-03-01' order by effective_from desc limit 1), 6.00::numeric, 'the rate in force on a date is the newest one that has started');

select throws_ok($$ insert into waytara.electricity_tariffs (state, category, rate_per_kwh, effective_from, billing_months) values ('Testland', 'commercial', 7, '2026-01-01', 3) $$, '23514', null, 'a bill covers one or two months');
select throws_ok($$ insert into waytara.electricity_tariffs (state, category, rate_per_kwh, effective_from, slabs) values ('Testland', 'commercial', 7, '2026-01-01', '{"upTo": 100}'::jsonb) $$, '23514', null, 'slabs are a list of bands');
select is((select free_units_over_cap from waytara.electricity_tariffs where state = 'Tamil Nadu' and category = 'residential' and effective_from = '2026-05-10'), 100::numeric, 'Tamil Nadu: 200 free units, and 100 once a two-month bill passes 500 units');
select is((select count(*)::int from waytara.electricity_tariffs where slabs is not null and (slabs -> -1 -> 'upTo') <> 'null'::jsonb), 0, 'every loaded tariff ends in an open-ended band');
select is((select count(*)::int from waytara.tariff_changes where notified_at is null and effective_from <= current_date), 0, 'loading the rates does not queue e-mails about them');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :c1, 'role', 'authenticated')::text, true);
select is((select count(*)::int from waytara.electricity_tariffs where state = 'Testland'), 2, 'a customer can read the rates');
select throws_ok($$ insert into waytara.electricity_tariffs (state, category, rate_per_kwh, effective_from) values ('Kerala', 'residential', 5, '2026-01-01') $$, '42501', null, 'but cannot add one');
update waytara.electricity_tariffs set rate_per_kwh = 1;
select is((select max(rate_per_kwh) from waytara.electricity_tariffs where state = 'Testland'), 6.20::numeric, 'or change one');

select set_config('request.jwt.claims', json_build_object('sub', :adm, 'role', 'authenticated')::text, true);
select lives_ok($$ insert into waytara.electricity_tariffs (state, category, rate_per_kwh, effective_from, source_url) values ('Kerala', 'residential', 5.5, '2026-01-01', 'https://example.org/order') $$, 'an admin can add a rate');

select * from finish();
rollback;
