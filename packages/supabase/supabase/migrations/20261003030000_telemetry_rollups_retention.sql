-- Phase 8: telemetry at scale.
--
-- Problem: equipment_telemetry grows by ~30k rows per device per day, and the
-- long-range pages (Analytics, Performance, report export: 30–365 days) read
-- RAW rows through a helper hard-capped at 20,000 rows — i.e. about one day of
-- one key — so their numbers were silently computed from the first day or two
-- of the window. Raw rows also cannot be kept forever.
--
-- Solution:
--   1. equipment_telemetry_hourly: one row per (device, key, hour) with
--      min/avg/max/count, refreshed every 10 minutes by pg_cron (idempotent
--      upsert of the trailing hours) and backfilled here.
--   2. telemetry_daily(): per-day max/avg/min for a range, read from the rollup
--      (a year of one key is ~365 rows). "Day" is the business day in India
--      (Asia/Kolkata), independent of any session timezone. Hour bins are
--      aligned to IST (they start at :30 past the UTC hour) so that every IST
--      midnight is an exact bin boundary and no reading is attributed to the
--      wrong day.
--   3. purge_old_telemetry(): bounded, batched deletion of raw rows older than
--      the retention window (default 90 days). Hourly rollups are kept
--      indefinitely, so nothing the dashboards show is lost.

-- ============================================================
-- 1. Hourly rollup
-- ============================================================
create table if not exists waytara.equipment_telemetry_hourly (
  equipment_id uuid        not null references waytara.equipment (id) on delete cascade,
  key_name     text        not null,
  hour         timestamptz not null,           -- start of the hour, bins aligned to IST (:30 past the UTC hour)
  avg_value    double precision,
  min_value    double precision,
  max_value    double precision,
  samples      int         not null,
  primary key (equipment_id, key_name, hour)
);

comment on table waytara.equipment_telemetry_hourly is
  'Per (device, key, IST-aligned hour) min/avg/max of non-test readings. Maintained by waytara.rollup_telemetry_hourly(); kept indefinitely.';

alter table waytara.equipment_telemetry_hourly enable row level security;

create policy telemetry_hourly_admin on waytara.equipment_telemetry_hourly
  for select using ((select waytara.is_admin()));

create policy telemetry_hourly_owner on waytara.equipment_telemetry_hourly
  for select using (exists (
    select 1 from waytara.equipment d
    join waytara.sites s on s.id = d.site_id
    where d.id = equipment_telemetry_hourly.equipment_id and s.customer_id = (select auth.uid())
  ));

create policy telemetry_hourly_employee_assigned on waytara.equipment_telemetry_hourly
  for select using (exists (
    select 1 from waytara.equipment d
    join waytara.sites s on s.id = d.site_id
    join waytara.customer_onboarding co on co.customer_id = s.customer_id
    where d.id = equipment_telemetry_hourly.equipment_id and co.employee_id = (select auth.uid())
  ));

revoke all on waytara.equipment_telemetry_hourly from anon, authenticated;
grant select on waytara.equipment_telemetry_hourly to authenticated;
grant all on waytara.equipment_telemetry_hourly to service_role;

create or replace function waytara.rollup_telemetry_hourly(
  p_since timestamptz default now() - interval '3 hours',
  p_until timestamptz default null
)
returns bigint
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  n bigint;
begin
  insert into equipment_telemetry_hourly (equipment_id, key_name, hour, avg_value, min_value, max_value, samples)
  select t.equipment_id,
         t.key_name,
         date_bin(interval '1 hour', t.ts, timestamptz '2000-01-01 00:00:00+05:30') as hour,
         avg(t.value)::double precision,
         min(t.value)::double precision,
         max(t.value)::double precision,
         count(t.value)::int
  from equipment_telemetry t
  where not t.is_test
    and t.value is not null
    and t.ts >= date_bin(interval '1 hour', p_since, timestamptz '2000-01-01 00:00:00+05:30')
    and (p_until is null or t.ts < p_until)
  group by 1, 2, 3
  on conflict (equipment_id, key_name, hour) do update
    set avg_value = excluded.avg_value,
        min_value = excluded.min_value,
        max_value = excluded.max_value,
        samples   = excluded.samples;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function waytara.rollup_telemetry_hourly(timestamptz, timestamptz) from public, anon, authenticated;

-- One-time backfill of all existing history.
select waytara.rollup_telemetry_hourly('-infinity');

-- ============================================================
-- 2. Per-day view over the rollup (SECURITY INVOKER: RLS applies)
-- ============================================================
create or replace function waytara.telemetry_daily(
  p_equipment_id uuid,
  p_keys text[],
  p_from timestamptz,
  p_to timestamptz
)
returns table (key_name text, day timestamptz, max_value double precision, avg_value double precision, min_value double precision, samples int)
language plpgsql
stable
security invoker
set search_path = waytara, pg_temp
as $$
begin
  if p_to - p_from > interval '800 days' then
    raise exception 'time range too large (max 800 days)';
  end if;

  return query
  select h.key_name,
         (date_trunc('day', h.hour at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as day,
         max(h.max_value),
         (sum(h.avg_value * h.samples) / nullif(sum(h.samples), 0))::double precision,
         min(h.min_value),
         sum(h.samples)::int
  from equipment_telemetry_hourly h
  where h.equipment_id = p_equipment_id
    and h.key_name = any (p_keys)
    and h.hour >= p_from
    and h.hour < p_to
  group by 1, 2
  order by 2, 1;
end;
$$;

revoke all on function waytara.telemetry_daily(uuid, text[], timestamptz, timestamptz) from public, anon;
grant execute on function waytara.telemetry_daily(uuid, text[], timestamptz, timestamptz) to authenticated, service_role;

-- ============================================================
-- 3. Retention of RAW rows (rollups are kept)
-- ============================================================
create or replace function waytara.purge_old_telemetry(
  p_retain_days int default 90,
  p_batch int default 50000,
  p_max_batches int default 20
)
returns bigint
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  cutoff  timestamptz;
  deleted bigint := 0;
  n       bigint;
  i       int := 0;
begin
  if p_retain_days < 14 then
    raise exception 'retention below 14 days is not allowed (got %)', p_retain_days;
  end if;
  cutoff := now() - make_interval(days => p_retain_days);

  -- Safety net: re-roll only the slice about to be deleted (the 10-minute job
  -- already covers it; this guards against the job having been down).
  perform rollup_telemetry_hourly(cutoff - interval '2 days', cutoff);

  -- Bounded work per run (batches * batch rows) so a backlog never holds long locks.
  loop
    exit when i >= p_max_batches;
    delete from equipment_telemetry
    where ctid in (select ctid from equipment_telemetry where ts < cutoff limit p_batch);
    get diagnostics n = row_count;
    deleted := deleted + n;
    i := i + 1;
    exit when n < p_batch;
  end loop;

  return deleted;
end;
$$;

revoke all on function waytara.purge_old_telemetry(int, int, int) from public, anon, authenticated;

-- ============================================================
-- 4. Schedules (UTC): rollup every 10 min; purge nightly ~03:30 IST
-- ============================================================
do $$
declare j text;
begin
  foreach j in array array['rollup-telemetry-hourly', 'purge-old-telemetry'] loop
    perform cron.unschedule(j) from cron.job where jobname = j;
  end loop;
end $$;

select cron.schedule('rollup-telemetry-hourly', '*/10 * * * *', $$select waytara.rollup_telemetry_hourly()$$);
select cron.schedule('purge-old-telemetry', '0 22 * * *', $$select waytara.purge_old_telemetry(90)$$);
