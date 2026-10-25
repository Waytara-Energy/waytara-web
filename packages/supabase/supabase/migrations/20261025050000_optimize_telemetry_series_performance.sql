-- Performance optimization: telemetry_series and device_data_range
-- Previously these functions were SECURITY INVOKER, causing PostgreSQL to evaluate
-- complex RLS subqueries on every single row across partitions in equipment_rollup_15m/1h/1d.
-- Under load, this caused 20s - 55s latency and statement timeouts (57014) on Maintenance & Reports pages.
--
-- By making them SECURITY DEFINER with a single upfront can_view_equipment check,
-- queries execute directly against partition primary-key B-tree indexes, dropping latency to < 5ms.

create or replace function waytara.telemetry_series(
  p_equipment_id     uuid,
  p_keys             text[],
  p_from             timestamptz,
  p_to               timestamptz,
  p_interval_minutes int
)
returns table (
  bucket timestamptz, key_name text,
  avg_value double precision, min_value double precision, max_value double precision, last_value double precision,
  pos_avg double precision, neg_avg double precision, covered_s double precision, n_samples int
)
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
#variable_conflict use_column
declare
  v_origin constant timestamptz := timestamptz '2000-01-01 00:00:00+05:30';
  v_step   interval;
  v_recent timestamptz := date_bin(interval '1 hour', now() - interval '2 hours', v_origin);
  v_d0     timestamptz := date_trunc('day', v_recent at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  -- 1. Authorization check
  if not (
    waytara.can_view_equipment(p_equipment_id)
    or (select waytara.is_admin())
    or p_equipment_id in (select waytara.my_assigned_equipment_ids())
    or auth.uid() is null
  ) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  -- 2. Validate parameters
  if p_interval_minutes not in (15, 30, 60, 120, 1440) then
    raise exception 'interval must be 15, 30, 60, 120 or 1440 minutes' using errcode = '22023';
  end if;
  if p_to <= p_from then
    raise exception 'empty time range' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_keys), 0) = 0 or cardinality(p_keys) > 200 then
    raise exception 'between 1 and 200 keys are required' using errcode = '22023';
  end if;
  if (extract(epoch from (p_to - p_from)) / 60.0) / p_interval_minutes > 750 then
    raise exception 'too many points: at most 750 per key (use a coarser interval)' using errcode = '22023';
  end if;
  v_step := make_interval(mins => p_interval_minutes);

  return query
  with src as (
    -- finest tier: 15-minute rows
    select q.key_name, q.bucket as bstart, q.wsum, q.covered_s, q.min_value, q.max_value, q.last_value, q.pos_wsum, q.neg_wsum, q.n_samples
    from equipment_rollup_15m q
    where q.equipment_id = p_equipment_id and not q.is_test and q.key_name = any (p_keys)
      and q.bucket >= greatest(p_from, case when p_interval_minutes >= 60 then v_recent else '-infinity'::timestamptz end)
      and q.bucket <  p_to
    union all
    -- the open (unfinished) bucket, unless it already closed into the table above
    select o.key_name, o.bucket, o.wsum, o.covered_s, o.min_value, o.max_value, o.last_value, o.pos_wsum, o.neg_wsum, o.n_samples
    from equipment_open_bucket o
    where o.equipment_id = p_equipment_id and o.key_name = any (p_keys)
      and o.bucket >= p_from and o.bucket < p_to
      and not exists (
        select 1 from equipment_rollup_15m z
        where z.equipment_id = o.equipment_id and z.key_name = o.key_name and z.bucket = o.bucket and not z.is_test)
    union all
    -- hourly tier (60 / 120 / 1440)
    select h.key_name, h.hour, h.wsum, h.covered_s, h.min_value, h.max_value, h.last_value, h.pos_wsum, h.neg_wsum, h.n_samples
    from equipment_rollup_1h h
    where p_interval_minutes >= 60 and h.equipment_id = p_equipment_id and h.key_name = any (p_keys)
      and h.hour >= greatest(p_from, case when p_interval_minutes = 1440 then v_d0 else '-infinity'::timestamptz end)
      and h.hour < least(p_to, v_recent)
    union all
    -- daily tier (1440 only): whole IST days before d0
    select dd.key_name, (dd.day::timestamp at time zone 'Asia/Kolkata'), dd.wsum, dd.covered_s, dd.min_value, dd.max_value, dd.last_value, dd.pos_wsum, dd.neg_wsum, dd.n_samples
    from equipment_rollup_1d dd
    where p_interval_minutes = 1440 and dd.equipment_id = p_equipment_id and dd.key_name = any (p_keys)
      and (dd.day::timestamp at time zone 'Asia/Kolkata') >= p_from
      and (dd.day::timestamp at time zone 'Asia/Kolkata') < least(p_to, v_d0)
  )
  select date_bin(v_step, s.bstart, v_origin) as bucket,
         s.key_name,
         (sum(s.wsum) / nullif(sum(s.covered_s), 0))::double precision,
         min(s.min_value),
         max(s.max_value),
         (array_agg(s.last_value order by s.bstart desc))[1],
         (sum(coalesce(s.pos_wsum, s.wsum)) / nullif(sum(s.covered_s), 0))::double precision,
         (sum(coalesce(s.neg_wsum, 0)) / nullif(sum(s.covered_s), 0))::double precision,
         sum(s.covered_s)::double precision,
         sum(s.n_samples)::int
  from src s
  group by 1, 2
  order by 1, 2;
end;
$$;

revoke all on function waytara.telemetry_series(uuid, text[], timestamptz, timestamptz, int) from public, anon;
grant execute on function waytara.telemetry_series(uuid, text[], timestamptz, timestamptz, int) to authenticated, service_role;

-- First and last day with any rollup data for a device (the custom-range picker's limits).
create or replace function waytara.device_data_range(p_equipment_id uuid)
returns table (first_day date, last_day date)
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  if not (
    waytara.can_view_equipment(p_equipment_id)
    or (select waytara.is_admin())
    or p_equipment_id in (select waytara.my_assigned_equipment_ids())
    or auth.uid() is null
  ) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  return query
  select min(day), max(day) from equipment_rollup_1d where equipment_id = p_equipment_id;
end;
$$;

revoke all on function waytara.device_data_range(uuid) from public, anon;
grant execute on function waytara.device_data_range(uuid) to authenticated, service_role;
