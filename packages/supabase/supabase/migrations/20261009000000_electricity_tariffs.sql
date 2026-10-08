-- Electricity rates by state and kind of property. What a customer saves depends on what a unit costs where they live: a
-- villa in Tamil Nadu and a factory in Maharashtra pay very different rates. The Cost & Savings section works out the
-- customer's bill with and without solar from the rate of their site's state and kind of property.
--
--   electricity_tariffs   one row per (state, category) per effective date. A new row is a rate change: the newest row whose
--                         effective_from has arrived is the rate in force, the one before it is what it changed from. A row
--                         dated in the future is a scheduled change.
--   tariff_changes        one row per change once its date has arrived (made by the daily job), so customers are told once.
--
--   category      residential | commercial | industrial (chosen from the site's property type)
--   rate_per_kwh  the representative energy charge, Rs per kWh, that a unit saved or sold is worth at this state/category
--   confidence    verified: taken from the regulator's order (source_url says which). indicative: an estimate from
--                 published summaries, to be replaced by the order; the customer is told it is an estimate.
--
-- The rates are public reference data: any signed-in user may read them, only admins change them.

create table if not exists waytara.electricity_tariffs (
  id                     uuid primary key default gen_random_uuid(),
  state                  text not null,
  category               text not null check (category in ('residential', 'commercial', 'industrial')),
  rate_per_kwh           numeric not null check (rate_per_kwh >= 0 and rate_per_kwh <= 100),
  export_rate_per_kwh    numeric check (export_rate_per_kwh is null or (export_rate_per_kwh >= 0 and export_rate_per_kwh <= 100)),
  fixed_charge_per_month numeric check (fixed_charge_per_month is null or fixed_charge_per_month >= 0),
  effective_from         date not null,
  source_url             text,
  source_note            text,
  confidence             text not null default 'indicative' check (confidence in ('verified', 'indicative')),
  created_at             timestamptz not null default now(),
  created_by             uuid references waytara.profiles (id) on delete set null,
  unique (state, category, effective_from)
);
comment on table waytara.electricity_tariffs is 'Electricity rate per state and property category; a new row with a later effective_from is a rate change.';
comment on column waytara.electricity_tariffs.export_rate_per_kwh is 'What a unit sent to the grid is worth; null = the same as rate_per_kwh (net metering).';
create index if not exists electricity_tariffs_lookup_idx on waytara.electricity_tariffs (state, category, effective_from desc);

create table if not exists waytara.tariff_changes (
  id             uuid primary key default gen_random_uuid(),
  tariff_id      uuid unique references waytara.electricity_tariffs (id) on delete cascade,
  state          text not null,
  category       text not null,
  old_rate       numeric,
  new_rate       numeric not null,
  effective_from date not null,
  noticed_at     timestamptz not null default now(),
  notified_at    timestamptz
);
comment on table waytara.tariff_changes is 'A rate change that has taken effect; notified_at is when the affected customers were e-mailed.';

alter table waytara.electricity_tariffs enable row level security;
alter table waytara.tariff_changes enable row level security;

create policy electricity_tariffs_read on waytara.electricity_tariffs for select to authenticated using (true);
create policy electricity_tariffs_admin_write on waytara.electricity_tariffs for all using ((select waytara.is_admin())) with check ((select waytara.is_admin()));
create policy tariff_changes_read on waytara.tariff_changes for select to authenticated using (true);

revoke all on waytara.electricity_tariffs, waytara.tariff_changes from anon, authenticated;
grant select on waytara.electricity_tariffs, waytara.tariff_changes to authenticated;
grant insert, update, delete on waytara.electricity_tariffs to authenticated;   -- limited to admins by the policy above
grant all on waytara.electricity_tariffs, waytara.tariff_changes to service_role;

-- The daily check (06:00 India time): rates whose date has arrived become changes, and the customers they affect are told.
select cron.unschedule(jobid) from cron.job where jobname = 'update-tariffs';
select cron.schedule('update-tariffs', '30 0 * * *', $$select waytara.invoke_cron_route('/api/cron/update-tariffs')$$);
