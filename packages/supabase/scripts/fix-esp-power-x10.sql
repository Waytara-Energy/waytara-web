-- ONE-OFF data correction (run once, in the Supabase SQL editor). NOT a migration.
--
-- Problem: from the first upload of the ESP32 monitoring unit (13 Oct 2026, bucket 14:30 IST) until the corrected firmware was started
-- (14 Oct ~12:46 IST), six power metrics of the Waytara Office inverter (equipment b4c30eb8-fba4-4487-aa7a-3c1b089e36e2) were stored
-- 10 times too big:
--   battery_power_w, grid_total_power_w, load_total_power_w, load_l1_power_w, grid_ct_total_power_w, grid_ct_l1_power_w
-- (the firmware multiplied by 10 because register 54 reads 0; this inverter's power registers are in 1 W units).
--
-- What it does: divides those 15-minute rows by 10 (every bucket before the cutoff), then rebuilds the hourly and daily rows from them,
-- then COMMITS. Run the WHOLE script in one go, ONCE.
--
-- Safety: it records itself in waytara.data_fixes and stops with an error (changing nothing) if it was already applied, so a second run
-- cannot divide twice.
-- The cutoff (14 Oct 12:30 IST) is the first bucket that holds corrected data: the last wrong bucket is 12:15, there is no 12:30 row (the
-- restart happened inside it) and the buckets from 12:45 on come from the corrected firmware.

begin;

create temp table fix_params on commit drop as
select timestamptz '2026-10-14 12:30:00+05:30' as cutoff,               -- first bucket with corrected data (IST)
       timestamptz '2026-10-13 14:30:00+05:30' as first_bucket;         -- the unit's first upload

-- guard: this correction is recorded in a small table, so a second run stops instead of dividing twice.
create table if not exists waytara.data_fixes (name text primary key, applied_at timestamptz not null default now());
alter table waytara.data_fixes enable row level security;
revoke all on waytara.data_fixes from public, anon, authenticated;
do $$
begin
  if exists (select 1 from waytara.data_fixes where name = 'esp_power_x10_2026-10-14') then
    raise exception 'This correction was already applied - not running again.';
  end if;
  if not exists (select 1 from waytara.equipment_rollup_15m
                 where equipment_id = 'b4c30eb8-fba4-4487-aa7a-3c1b089e36e2' and key_name = 'load_total_power_w' and not is_test
                   and bucket >= (select first_bucket from fix_params) and bucket < (select cutoff from fix_params)) then
    raise exception 'No rows to correct in that range - nothing changed.';
  end if;
end $$;

-- 1. the 15-minute rows
update waytara.equipment_rollup_15m r
set wsum       = wsum / 10,
    min_value  = min_value / 10,
    max_value  = max_value / 10,
    last_value = last_value / 10,
    pos_wsum   = pos_wsum / 10,
    neg_wsum   = neg_wsum / 10
where r.equipment_id = 'b4c30eb8-fba4-4487-aa7a-3c1b089e36e2'
  and r.key_name in ('battery_power_w', 'grid_total_power_w', 'load_total_power_w', 'load_l1_power_w', 'grid_ct_total_power_w', 'grid_ct_l1_power_w')
  and not r.is_test
  and r.bucket >= (select first_bucket from fix_params)
  and r.bucket <  (select cutoff from fix_params);

-- 2. rebuild the hours (IST hour starts) and the days that contain those buckets
select waytara.rollup_hours(array(
  select generate_series(
    date_bin(interval '1 hour', (select first_bucket from fix_params), timestamptz '2000-01-01 00:00:00+05:30'),
    date_bin(interval '1 hour', (select cutoff from fix_params),       timestamptz '2000-01-01 00:00:00+05:30'),
    interval '1 hour')
));
select waytara.rollup_days(array(
  select generate_series(
    ((select first_bucket from fix_params) at time zone 'Asia/Kolkata')::date,
    ((select cutoff from fix_params)       at time zone 'Asia/Kolkata')::date,
    interval '1 day')::date
));

insert into waytara.data_fixes (name) values ('esp_power_x10_2026-10-14');

commit;

-- 3. check (runs after the commit): the largest load / grid / battery power per day should be believable
-- (load: up to a few hundred W, grid export: up to ~8000 W)
select (h.hour at time zone 'Asia/Kolkata')::date as day, h.key_name, round(max(h.max_value)::numeric) as max_w, round(min(h.min_value)::numeric) as min_w
from waytara.equipment_rollup_1h h
where h.equipment_id = 'b4c30eb8-fba4-4487-aa7a-3c1b089e36e2'
  and h.key_name in ('battery_power_w', 'grid_total_power_w', 'load_total_power_w')
  and h.hour >= timestamptz '2026-10-13 00:00:00+05:30'
group by 1, 2 order by 1, 2;
