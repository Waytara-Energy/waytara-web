-- What the inverter cannot tell us about its battery: how big it is and how many cycles it is built for. The Deye reports
-- the energy that went in and out (lifetime counters), the charge level, voltage and current - but no state of health and
-- no cycle count. The Performance page works those out from the counters, and for that it needs the battery's datasheet
-- numbers, which only the installer knows. One row per inverter, written by the admin app, read by the customer.
--
--   rated_capacity_kwh        usable energy of the battery on its datasheet (not the nominal pack size)
--   rated_cycle_life          cycles it is rated for before it falls to end_of_life_pct of its capacity
--   end_of_life_pct           the capacity (as % of new) at which the rating ends: 80 is the usual
--   baseline_discharged_kwh   the inverter's lifetime discharge counter on the day THIS battery was installed, so a
--                             replaced battery starts again from zero cycles (0 = the counter started with this battery)
--   installed_on              when the battery was installed (shown to the customer)

create table if not exists waytara.battery_profiles (
  equipment_id            uuid primary key references waytara.equipment (id) on delete cascade,
  rated_capacity_kwh      numeric not null check (rated_capacity_kwh > 0 and rated_capacity_kwh <= 10000),
  rated_cycle_life        integer not null check (rated_cycle_life > 0 and rated_cycle_life <= 100000),
  end_of_life_pct         numeric not null default 80 check (end_of_life_pct between 50 and 95),
  baseline_discharged_kwh numeric not null default 0 check (baseline_discharged_kwh >= 0),
  installed_on            date,
  chemistry               text,
  updated_at              timestamptz not null default now()
);

comment on table waytara.battery_profiles is 'Datasheet numbers of an inverter''s battery, used to work out cycle count and health from the energy counters.';

alter table waytara.battery_profiles enable row level security;

create policy battery_profiles_admin_all on waytara.battery_profiles
  for all using ((select waytara.is_admin())) with check ((select waytara.is_admin()));

create policy battery_profiles_owner on waytara.battery_profiles
  for select using (exists (
    select 1 from waytara.equipment d
    join waytara.sites s on s.id = d.site_id
    where d.id = battery_profiles.equipment_id and s.customer_id = (select auth.uid())
  ));

create policy battery_profiles_employee_assigned on waytara.battery_profiles
  for select using (exists (
    select 1 from waytara.equipment d
    join waytara.sites s on s.id = d.site_id
    join waytara.customer_onboarding co on co.customer_id = s.customer_id
    where d.id = battery_profiles.equipment_id and co.employee_id = (select auth.uid())
  ));

revoke all on waytara.battery_profiles from anon, authenticated;
grant select, insert, update, delete on waytara.battery_profiles to authenticated;   -- what they may do is decided by the policies
grant all on waytara.battery_profiles to service_role;
