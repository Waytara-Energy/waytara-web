-- Rollup data layer: the agent uploads 15-minute buckets (not raw readings); the
-- database derives hourly and daily rollups; dashboards read through one function.
--
-- ADDITIVE ONLY. Nothing from the old raw/hourly design is dropped or changed here
-- (equipment_telemetry, equipment_telemetry_hourly, telemetry_buckets,
-- telemetry_daily, device_last_seen all keep working) so the apps can be moved over
-- one screen at a time and the old objects removed in a later cutover migration.
--
-- Tables
--   equipment_rollup_15m  agent-written, append-only, daily partitions, kept 8 days
--   equipment_rollup_1h   built from 15m by run_rollups(), monthly partitions, kept forever
--   equipment_rollup_1d   built from 1h by run_rollups(), kept forever
--   equipment_open_bucket the running figures of the current unfinished 15-minute bucket
--   equipment_heartbeat   one row per device: last upload, upload interval, agent version
--   rollup_state          watermarks for the incremental jobs
--
-- Every rollup row is a set of exactly-combinable aggregates, so 30 min / 1 h / 2 h /
-- 1 day views are produced by combining rows (no extra tables):
--   wsum      sum of (value x seconds the value was in effect)
--   covered_s seconds that were covered by readings (offline gaps are NOT covered)
--   avg       = wsum / covered_s            (time-weighted)
--   min/max/last
--   pos_wsum / neg_wsum  only when the bucket contains negative values (battery and grid
--                        power are signed). NULL means "no negatives": positive part =
--                        wsum, negative part = 0.
--
-- Sample-and-hold semantics (the Python agent and backfill_rollup_15m() MUST agree):
--   a reading holds from its timestamp until the next reading of the same key, but no
--   longer than H = least(7200, greatest(60, 2 x cadence_seconds)) seconds. The held
--   interval is clipped to the 15-minute buckets it overlaps; a value that straddles a
--   boundary counts in both buckets. min/max/last consider every value with overlap > 0.
--   n_samples counts the readings whose timestamp falls inside the bucket.
--
-- Time zone: all buckets are aligned to the IST clock (Asia/Kolkata, UTC+05:30).
-- 15-minute buckets are therefore also aligned to UTC quarter hours; hours and days are
-- IST hours and IST days (origin 2000-01-01 00:00+05:30 for date_bin).

-- ============================================================
-- 0. Helpers
-- ============================================================
create or replace function waytara.try_uuid(p text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- Same audience as the existing telemetry policies: admin, the owning customer, and
-- the employee assigned to that customer's onboarding.
create or replace function waytara.can_view_equipment(p_equipment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select p_equipment_id is not null and (
    (select waytara.is_admin())
    or exists (
      select 1 from equipment d join sites s on s.id = d.site_id
      where d.id = p_equipment_id and s.customer_id = (select auth.uid())
    )
    or exists (
      select 1 from equipment d
      join sites s on s.id = d.site_id
      join customer_onboarding co on co.customer_id = s.customer_id
      where d.id = p_equipment_id and co.employee_id = (select auth.uid())
    )
  );
$$;

revoke all on function waytara.try_uuid(text) from public, anon;
grant execute on function waytara.try_uuid(text) to authenticated, service_role;
revoke all on function waytara.can_view_equipment(uuid) from public, anon;
grant execute on function waytara.can_view_equipment(uuid) to authenticated, service_role;

-- ============================================================
-- 1. Tables
-- ============================================================
create table if not exists waytara.equipment_rollup_15m (
  equipment_id uuid             not null references waytara.equipment (id) on delete cascade,
  key_name     text             not null,
  bucket       timestamptz      not null,           -- bucket start, IST quarter hour
  is_test      boolean          not null default false,
  wsum         double precision not null,
  covered_s    double precision not null,
  min_value    double precision,
  max_value    double precision,
  last_value   double precision,
  pos_wsum     double precision,
  neg_wsum     double precision,
  n_samples    int              not null default 0,
  created_at   timestamptz      not null default now(),  -- also bumped when a bucket is corrected; drives the incremental jobs
  primary key (equipment_id, key_name, bucket, is_test)
) partition by range (bucket);

create index if not exists equipment_rollup_15m_created_idx on waytara.equipment_rollup_15m (created_at);

create table if not exists waytara.equipment_rollup_1h (
  equipment_id uuid             not null references waytara.equipment (id) on delete cascade,
  key_name     text             not null,
  hour         timestamptz      not null,           -- IST hour start
  wsum         double precision not null,
  covered_s    double precision not null,
  min_value    double precision,
  max_value    double precision,
  last_value   double precision,
  pos_wsum     double precision,
  neg_wsum     double precision,
  n_samples    int              not null default 0,
  updated_at   timestamptz      not null default now(),
  primary key (equipment_id, key_name, hour)
) partition by range (hour);

create index if not exists equipment_rollup_1h_updated_idx on waytara.equipment_rollup_1h (updated_at);

create table if not exists waytara.equipment_rollup_1d (
  equipment_id uuid             not null references waytara.equipment (id) on delete cascade,
  key_name     text             not null,
  day          date             not null,           -- IST calendar day
  wsum         double precision not null,
  covered_s    double precision not null,
  min_value    double precision,
  max_value    double precision,
  last_value   double precision,
  pos_wsum     double precision,
  neg_wsum     double precision,
  n_samples    int              not null default 0,
  updated_at   timestamptz      not null default now(),
  primary key (equipment_id, key_name, day)
);

create table if not exists waytara.equipment_open_bucket (
  equipment_id uuid             not null references waytara.equipment (id) on delete cascade,
  key_name     text             not null,
  bucket       timestamptz      not null,
  wsum         double precision not null,
  covered_s    double precision not null,
  min_value    double precision,
  max_value    double precision,
  last_value   double precision,
  pos_wsum     double precision,
  neg_wsum     double precision,
  n_samples    int              not null default 0,
  updated_at   timestamptz      not null default now(),
  primary key (equipment_id, key_name)
);

create table if not exists waytara.equipment_heartbeat (
  equipment_id      uuid        primary key references waytara.equipment (id) on delete cascade,
  last_seen         timestamptz not null,           -- server time of the last upload
  agent_ts          timestamptz,                    -- the agent's own clock at that upload
  upload_interval_s int,
  agent_version     text
);

create table if not exists waytara.rollup_state (
  name      text        primary key,
  watermark timestamptz not null
);

comment on table waytara.equipment_rollup_15m is 'Agent-uploaded 15-minute aggregates, IST-aligned. Daily partitions, kept 8 days (see drop_old_rollup_15m_partitions).';
comment on table waytara.equipment_rollup_1h  is 'Hourly aggregates built from equipment_rollup_15m by run_rollups(); kept forever.';
comment on table waytara.equipment_rollup_1d  is 'IST-day aggregates built from equipment_rollup_1h by run_rollups(); kept forever.';

-- RLS: same audience as the telemetry tables. Uncorrelated IN (...) sub-selects are
-- evaluated once per query rather than once per row.
do $$
declare
  t text;
begin
  foreach t in array array['equipment_rollup_15m', 'equipment_rollup_1h', 'equipment_rollup_1d', 'equipment_open_bucket', 'equipment_heartbeat'] loop
    execute format('alter table waytara.%I enable row level security', t);
    execute format('drop policy if exists %I on waytara.%I', t || '_admin', t);
    execute format('create policy %I on waytara.%I for select using ((select waytara.is_admin()))', t || '_admin', t);
    execute format('drop policy if exists %I on waytara.%I', t || '_owner', t);
    execute format(
      'create policy %I on waytara.%I for select using (equipment_id in (
         select d.id from waytara.equipment d join waytara.sites s on s.id = d.site_id
         where s.customer_id = (select auth.uid())))', t || '_owner', t);
    execute format('drop policy if exists %I on waytara.%I', t || '_employee', t);
    execute format(
      'create policy %I on waytara.%I for select using (equipment_id in (
         select d.id from waytara.equipment d
         join waytara.sites s on s.id = d.site_id
         join waytara.customer_onboarding co on co.customer_id = s.customer_id
         where co.employee_id = (select auth.uid())))', t || '_employee', t);
    execute format('revoke all on waytara.%I from anon, authenticated', t);
    execute format('grant select on waytara.%I to authenticated', t);
    execute format('grant all on waytara.%I to service_role', t);
  end loop;
end $$;

alter table waytara.rollup_state enable row level security;
revoke all on waytara.rollup_state from anon, authenticated;
grant all on waytara.rollup_state to service_role;

-- ============================================================
-- 2. Partition management (plain SQL, no pg_partman: portable to any Postgres)
-- ============================================================
create or replace function waytara.ensure_rollup_15m_partition(p_ts timestamptz)
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  d0   timestamptz := date_trunc('day', p_ts at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  name text;
begin
  name := 'equipment_rollup_15m_p' || to_char(d0 at time zone 'Asia/Kolkata', 'YYYYMMDD');
  if to_regclass(format('waytara.%I', name)) is not null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('waytara.rollup_partitions', 0));
  if to_regclass(format('waytara.%I', name)) is not null then return; end if;
  execute format('create table waytara.%I partition of waytara.equipment_rollup_15m for values from (%L) to (%L)',
                 name, d0, d0 + interval '24 hours');
end;
$$;

create or replace function waytara.ensure_rollup_1h_partition(p_ts timestamptz)
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  local_start timestamp := date_trunc('month', p_ts at time zone 'Asia/Kolkata');
  m0   timestamptz := local_start at time zone 'Asia/Kolkata';
  m1   timestamptz := (local_start + interval '1 month') at time zone 'Asia/Kolkata';
  name text := 'equipment_rollup_1h_p' || to_char(local_start, 'YYYYMM');
begin
  if to_regclass(format('waytara.%I', name)) is not null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('waytara.rollup_partitions', 0));
  if to_regclass(format('waytara.%I', name)) is not null then return; end if;
  execute format('create table waytara.%I partition of waytara.equipment_rollup_1h for values from (%L) to (%L)', name, m0, m1);
end;
$$;

-- 15m partitions for [-8 days, +2 days] around today, hourly partitions for this and next month.
create or replace function waytara.ensure_rollup_partitions(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  i int;
begin
  for i in -8..2 loop
    perform ensure_rollup_15m_partition(p_now + make_interval(days => i));
  end loop;
  perform ensure_rollup_1h_partition(p_now);
  perform ensure_rollup_1h_partition(p_now + interval '1 month');
end;
$$;

-- Dropping a whole day is instant (no DELETE, no vacuum). Hourly/daily rollups of those
-- days were built long before (jobs run every 5 minutes; retention is 8 days).
create or replace function waytara.drop_old_rollup_15m_partitions(p_keep_days int default 8, p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  r record;
  n int := 0;
  cutoff date := (p_now at time zone 'Asia/Kolkata')::date - p_keep_days;
begin
  for r in
    select c.relname
    from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    where i.inhparent = 'waytara.equipment_rollup_15m'::regclass
      and c.relname ~ '_p[0-9]{8}$'
  loop
    if to_date(right(r.relname, 8), 'YYYYMMDD') < cutoff then
      execute format('drop table waytara.%I', r.relname);
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- ============================================================
-- 3. Agent ingest: one transaction per upload
-- ============================================================
-- p_values  { key: number | {"v": number, "u": "unit"} }  changed live values -> equipment_latest
-- p_open    { key: {"b": bucket, "w": wsum, "c": covered_s, "mn":, "mx":, "l":, "pw":, "nw":, "n":} }
-- p_closed  [ {"k": key, "b": bucket, ...same fields..., "t": is_test} ]  finished buckets
-- p_agent   {"interval_s": int, "version": text}
-- Idempotent: replays of a finished bucket never duplicate; a corrected bucket replaces the
-- stored one only when it covers more time; an older live value never overwrites a newer one.
create or replace function waytara.ingest_tick(
  p_equipment_id uuid,
  p_ts           timestamptz,
  p_values       jsonb default '{}'::jsonb,
  p_open         jsonb default '{}'::jsonb,
  p_closed       jsonb default '[]'::jsonb,
  p_agent        jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_now        timestamptz := now();
  v_ts         timestamptz := least(p_ts, v_now);          -- never trust a clock that runs ahead
  n_values     int := 0;
  n_open       int := 0;
  n_closed     int := 0;
  n_rejected   int := 0;
  d            timestamptz;
  v_payload    jsonb;
begin
  if not exists (select 1 from equipment where id = p_equipment_id) then
    raise exception 'unknown equipment %', p_equipment_id using errcode = '22023';
  end if;

  -- live values (newer wins)
  insert into equipment_latest (equipment_id, key_name, value, unit, ts)
  select p_equipment_id,
         e.key,
         case when jsonb_typeof(e.val) = 'number' then (e.val #>> '{}')::numeric else (e.val ->> 'v')::numeric end,
         case when jsonb_typeof(e.val) = 'object' then e.val ->> 'u' end,
         v_ts
  from jsonb_each(coalesce(p_values, '{}'::jsonb)) as e(key, val)
  where jsonb_typeof(e.val) = 'number' or (jsonb_typeof(e.val) = 'object' and jsonb_typeof(e.val -> 'v') = 'number')
  on conflict (equipment_id, key_name) do update
    set value = excluded.value,
        unit  = coalesce(excluded.unit, equipment_latest.unit),
        ts    = excluded.ts
    where equipment_latest.ts <= excluded.ts;
  get diagnostics n_values = row_count;

  -- running figures of the open bucket (a newer bucket replaces an older one, never the reverse)
  insert into equipment_open_bucket (equipment_id, key_name, bucket, wsum, covered_s, min_value, max_value, last_value, pos_wsum, neg_wsum, n_samples, updated_at)
  select p_equipment_id, e.key,
         (e.val ->> 'b')::timestamptz,
         (e.val ->> 'w')::double precision, (e.val ->> 'c')::double precision,
         (e.val ->> 'mn')::double precision, (e.val ->> 'mx')::double precision, (e.val ->> 'l')::double precision,
         (e.val ->> 'pw')::double precision, (e.val ->> 'nw')::double precision,
         coalesce((e.val ->> 'n')::int, 0), v_now
  from jsonb_each(coalesce(p_open, '{}'::jsonb)) as e(key, val)
  where e.val ? 'b' and e.val ? 'w' and e.val ? 'c'
  on conflict (equipment_id, key_name) do update
    set bucket = excluded.bucket, wsum = excluded.wsum, covered_s = excluded.covered_s,
        min_value = excluded.min_value, max_value = excluded.max_value, last_value = excluded.last_value,
        pos_wsum = excluded.pos_wsum, neg_wsum = excluded.neg_wsum, n_samples = excluded.n_samples,
        updated_at = excluded.updated_at
    where equipment_open_bucket.bucket <= excluded.bucket;
  get diagnostics n_open = row_count;

  -- finished buckets: aligned to 15 minutes, no older than the retention window, not in the future
  for d in
    select distinct date_trunc('day', (c ->> 'b')::timestamptz at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
    from jsonb_array_elements(coalesce(p_closed, '[]'::jsonb)) c
    where c ? 'b' and (c ->> 'b')::timestamptz >= v_now - interval '8 days' and (c ->> 'b')::timestamptz < v_now + interval '1 day'
  loop
    perform ensure_rollup_15m_partition(d);
  end loop;

  with cb as (
    select e ->> 'k' as key_name,
           (e ->> 'b')::timestamptz as bucket,
           coalesce((e ->> 't')::boolean, false) as is_test,
           (e ->> 'w')::double precision as wsum, (e ->> 'c')::double precision as covered_s,
           (e ->> 'mn')::double precision as mn, (e ->> 'mx')::double precision as mx, (e ->> 'l')::double precision as lv,
           (e ->> 'pw')::double precision as pw, (e ->> 'nw')::double precision as nw,
           coalesce((e ->> 'n')::int, 0) as n
    from jsonb_array_elements(coalesce(p_closed, '[]'::jsonb)) e
    where e ? 'k' and e ? 'b' and e ? 'w' and e ? 'c'
  ), ok as (
    select * from cb
    where bucket >= v_now - interval '8 days'
      and bucket <  v_now + interval '1 day'
      and mod(extract(epoch from bucket)::bigint, 900) = 0
      and covered_s > 0
  ), ins as (
    insert into equipment_rollup_15m as r (equipment_id, key_name, bucket, is_test, wsum, covered_s, min_value, max_value, last_value, pos_wsum, neg_wsum, n_samples, created_at)
    select p_equipment_id, key_name, bucket, is_test, wsum, covered_s, mn, mx, lv, pw, nw, n, v_now from ok
    on conflict (equipment_id, key_name, bucket, is_test) do update
      set wsum = excluded.wsum, covered_s = excluded.covered_s,
          min_value = excluded.min_value, max_value = excluded.max_value, last_value = excluded.last_value,
          pos_wsum = excluded.pos_wsum, neg_wsum = excluded.neg_wsum, n_samples = excluded.n_samples,
          created_at = v_now
      where excluded.covered_s > r.covered_s
    returning 1
  )
  select (select count(*) from ins), (select count(*) from cb) - (select count(*) from ok)
  into n_closed, n_rejected;

  insert into equipment_heartbeat (equipment_id, last_seen, agent_ts, upload_interval_s, agent_version)
  values (p_equipment_id, v_now, p_ts, nullif(p_agent ->> 'interval_s', '')::int, p_agent ->> 'version')
  on conflict (equipment_id) do update
    set last_seen = excluded.last_seen, agent_ts = excluded.agent_ts,
        upload_interval_s = coalesce(excluded.upload_interval_s, equipment_heartbeat.upload_interval_s),
        agent_version = coalesce(excluded.agent_version, equipment_heartbeat.agent_version);

  -- One live message per upload on the device's private channel. Never fails the ingest.
  if n_values > 0 or n_open > 0 then
    begin
      v_payload := jsonb_build_object('ts', v_ts, 'values', coalesce(p_values, '{}'::jsonb), 'open', coalesce(p_open, '{}'::jsonb));
      if pg_column_size(v_payload) < 200000 then
        perform realtime.send(v_payload, 'tick', 'device:' || p_equipment_id::text, true);
      end if;
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object(
    'values', n_values, 'open', n_open, 'closed_written', n_closed, 'closed_rejected', n_rejected,
    'skew_s', round(extract(epoch from (p_ts - v_now))::numeric, 1)
  );
end;
$$;

revoke all on function waytara.ingest_tick(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function waytara.ingest_tick(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb) to service_role;

-- ============================================================
-- 4. Rollup jobs: 15m -> 1h -> 1d (idempotent, incremental, late-data safe)
-- ============================================================
create or replace function waytara.rollup_hours(p_hours timestamptz[])
returns int
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_origin constant timestamptz := timestamptz '2000-01-01 00:00:00+05:30';
  lo timestamptz; hi timestamptz; m timestamptz; n int;
begin
  if p_hours is null or cardinality(p_hours) = 0 then return 0; end if;
  select min(h), max(h) into lo, hi from unnest(p_hours) h;
  for m in select distinct date_trunc('month', h at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' from unnest(p_hours) h loop
    perform ensure_rollup_1h_partition(m);
  end loop;

  insert into equipment_rollup_1h as r (equipment_id, key_name, hour, wsum, covered_s, min_value, max_value, last_value, pos_wsum, neg_wsum, n_samples, updated_at)
  select q.equipment_id, q.key_name, date_bin(interval '1 hour', q.bucket, v_origin) as hour,
         sum(q.wsum), sum(q.covered_s), min(q.min_value), max(q.max_value),
         (array_agg(q.last_value order by q.bucket desc))[1],
         case when bool_or(coalesce(q.min_value, 0) < 0) then sum(coalesce(q.pos_wsum, q.wsum)) end,
         case when bool_or(coalesce(q.min_value, 0) < 0) then sum(coalesce(q.neg_wsum, 0)) end,
         sum(q.n_samples), now()
  from equipment_rollup_15m q
  where not q.is_test
    and q.bucket >= lo and q.bucket < hi + interval '1 hour'
    and date_bin(interval '1 hour', q.bucket, v_origin) = any (p_hours)
  group by q.equipment_id, q.key_name, date_bin(interval '1 hour', q.bucket, v_origin)
  on conflict (equipment_id, key_name, hour) do update
    set wsum = excluded.wsum, covered_s = excluded.covered_s, min_value = excluded.min_value,
        max_value = excluded.max_value, last_value = excluded.last_value,
        pos_wsum = excluded.pos_wsum, neg_wsum = excluded.neg_wsum,
        n_samples = excluded.n_samples, updated_at = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function waytara.rollup_days(p_days date[])
returns int
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  lo timestamptz; hi timestamptz; n int;
begin
  if p_days is null or cardinality(p_days) = 0 then return 0; end if;
  select (min(d)::timestamp at time zone 'Asia/Kolkata'), ((max(d) + 1)::timestamp at time zone 'Asia/Kolkata') into lo, hi from unnest(p_days) d;

  insert into equipment_rollup_1d as r (equipment_id, key_name, day, wsum, covered_s, min_value, max_value, last_value, pos_wsum, neg_wsum, n_samples, updated_at)
  select h.equipment_id, h.key_name, (h.hour at time zone 'Asia/Kolkata')::date as day,
         sum(h.wsum), sum(h.covered_s), min(h.min_value), max(h.max_value),
         (array_agg(h.last_value order by h.hour desc))[1],
         case when bool_or(coalesce(h.min_value, 0) < 0) then sum(coalesce(h.pos_wsum, h.wsum)) end,
         case when bool_or(coalesce(h.min_value, 0) < 0) then sum(coalesce(h.neg_wsum, 0)) end,
         sum(h.n_samples), now()
  from equipment_rollup_1h h
  where h.hour >= lo and h.hour < hi
    and (h.hour at time zone 'Asia/Kolkata')::date = any (p_days)
  group by h.equipment_id, h.key_name, (h.hour at time zone 'Asia/Kolkata')::date
  on conflict (equipment_id, key_name, day) do update
    set wsum = excluded.wsum, covered_s = excluded.covered_s, min_value = excluded.min_value,
        max_value = excluded.max_value, last_value = excluded.last_value,
        pos_wsum = excluded.pos_wsum, neg_wsum = excluded.neg_wsum,
        n_samples = excluded.n_samples, updated_at = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- The 5-minute job. Rebuilds every hour/day touched by rows written (or corrected) since
-- the last run - so a bucket delivered hours late by the agent's offline buffer fixes the
-- hour and day it belongs to. The 5-minute overlap covers transactions that were still
-- open when the previous run read the watermark.
create or replace function waytara.run_rollups(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_origin constant timestamptz := timestamptz '2000-01-01 00:00:00+05:30';
  wm_h timestamptz; wm_d timestamptz; new_h timestamptz; new_d timestamptz;
  hours timestamptz[]; days date[]; n_h int := 0; n_d int := 0; dropped int;
begin
  perform ensure_rollup_partitions(p_now);

  select watermark into wm_h from rollup_state where name = '1h_from_15m';
  wm_h := coalesce(wm_h, '-infinity');
  select max(created_at) into new_h from equipment_rollup_15m where created_at >= wm_h - interval '5 minutes';
  select array_agg(distinct date_bin(interval '1 hour', bucket, v_origin)) into hours
    from equipment_rollup_15m where not is_test and created_at >= wm_h - interval '5 minutes';
  n_h := waytara.rollup_hours(hours);
  if new_h is not null then
    insert into rollup_state (name, watermark) values ('1h_from_15m', new_h)
    on conflict (name) do update set watermark = greatest(rollup_state.watermark, excluded.watermark);
  end if;

  select watermark into wm_d from rollup_state where name = '1d_from_1h';
  wm_d := coalesce(wm_d, '-infinity');
  select max(updated_at) into new_d from equipment_rollup_1h where updated_at >= wm_d - interval '5 minutes';
  select array_agg(distinct (hour at time zone 'Asia/Kolkata')::date) into days
    from equipment_rollup_1h where updated_at >= wm_d - interval '5 minutes';
  n_d := waytara.rollup_days(days);
  if new_d is not null then
    insert into rollup_state (name, watermark) values ('1d_from_1h', new_d)
    on conflict (name) do update set watermark = greatest(rollup_state.watermark, excluded.watermark);
  end if;

  dropped := waytara.drop_old_rollup_15m_partitions(8, p_now);
  return jsonb_build_object('hours', n_h, 'days', n_d, 'partitions_dropped', dropped);
end;
$$;

revoke all on function waytara.rollup_hours(timestamptz[]), waytara.rollup_days(date[]), waytara.run_rollups(timestamptz),
  waytara.ensure_rollup_15m_partition(timestamptz), waytara.ensure_rollup_1h_partition(timestamptz),
  waytara.ensure_rollup_partitions(timestamptz), waytara.drop_old_rollup_15m_partitions(int, timestamptz)
  from public, anon, authenticated;

-- ============================================================
-- 5. Backfill the 15-minute table from raw readings (one-time, and the reference
--    implementation of the hold semantics described at the top)
-- ============================================================
create or replace function waytara.backfill_rollup_15m(p_equipment_id uuid, p_from timestamptz, p_to timestamptz)
returns bigint
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
#variable_conflict use_column
declare
  v_origin constant timestamptz := timestamptz '2000-01-01 00:00:00+05:30';
  v_from timestamptz := date_bin(interval '15 minutes', p_from, v_origin);
  v_to   timestamptz := date_bin(interval '15 minutes', p_to, v_origin);
  d timestamptz; n bigint;
begin
  if v_to <= v_from then return 0; end if;
  for d in select distinct date_trunc('day', g at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
           from generate_series(v_from, v_to - interval '1 microsecond', interval '15 minutes') g loop
    perform ensure_rollup_15m_partition(d);
  end loop;

  with cad as (
    select key_name, min(cadence_seconds) as c
    from equipment_metrics where equipment_id = p_equipment_id and direction = 'read' group by key_name
  ), raw as (
    select t.key_name, t.ts as t0, t.value::double precision as v,
           lead(t.ts) over (partition by t.key_name order by t.ts) as next_ts,
           least(7200, greatest(60, 2 * coalesce(cad.c, 30)))::double precision as hold_s
    from equipment_telemetry t
    left join cad on cad.key_name = t.key_name
    where t.equipment_id = p_equipment_id and not t.is_test and t.value is not null
      and t.ts >= v_from - interval '2 hours' and t.ts < v_to + interval '2 hours'
  ), iv as (
    select key_name, t0, v,
           t0 + make_interval(secs => least(coalesce(extract(epoch from (next_ts - t0))::double precision, hold_s), hold_s)) as t1
    from raw
  ), ex as (
    select iv.key_name, iv.t0, iv.v, gs as bstart,
           greatest(0, extract(epoch from (least(iv.t1, gs + interval '15 minutes') - greatest(iv.t0, gs))))::double precision as ov
    from iv
    cross join lateral generate_series(
      date_bin(interval '15 minutes', iv.t0, v_origin),
      date_bin(interval '15 minutes', greatest(iv.t1 - interval '1 microsecond', iv.t0), v_origin),
      interval '15 minutes') gs
  ), agg as (
    select key_name, bstart,
           sum(v * ov) as wsum, sum(ov) as covered,
           min(v) filter (where ov > 0) as mn, max(v) filter (where ov > 0) as mx,
           (array_agg(v order by t0 desc) filter (where ov > 0))[1] as lv,
           sum(greatest(v, 0) * ov) as pw, sum(greatest(-v, 0) * ov) as nw,
           count(*) filter (where t0 >= bstart and t0 < bstart + interval '15 minutes') as n
    from ex
    where bstart >= v_from and bstart < v_to
    group by key_name, bstart
    having sum(ov) > 0
  )
  insert into equipment_rollup_15m as r (equipment_id, key_name, bucket, is_test, wsum, covered_s, min_value, max_value, last_value, pos_wsum, neg_wsum, n_samples, created_at)
  select p_equipment_id, key_name, bstart, false, wsum, covered, mn, mx, lv,
         case when mn < 0 then pw end, case when mn < 0 then nw end, n, now()
  from agg
  on conflict (equipment_id, key_name, bucket, is_test) do update
    set wsum = excluded.wsum, covered_s = excluded.covered_s, min_value = excluded.min_value,
        max_value = excluded.max_value, last_value = excluded.last_value, pos_wsum = excluded.pos_wsum,
        neg_wsum = excluded.neg_wsum, n_samples = excluded.n_samples, created_at = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function waytara.backfill_rollup_15m(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function waytara.backfill_rollup_15m(uuid, timestamptz, timestamptz) to service_role;

-- ============================================================
-- 6. Read path
-- ============================================================
-- One function for every chart and report. SECURITY INVOKER: RLS decides what is visible.
--   15 / 30 min          from the 15-minute table (last 8 days)
--   60 / 120 min         hourly table for hours before the last two hours, 15-minute table after
--   1440 (one IST day)   daily table for days before the last two hours' day, then hourly, then 15-minute
-- plus the running figures of the open bucket, so "now" is never stale by a bucket.
-- At most 750 points per key; combining is exact (sum of wsum / sum of covered_s).
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
security invoker
set search_path = waytara, pg_temp
as $$
#variable_conflict use_column
declare
  v_origin constant timestamptz := timestamptz '2000-01-01 00:00:00+05:30';
  v_step   interval;
  v_recent timestamptz := date_bin(interval '1 hour', now() - interval '2 hours', v_origin);   -- recent boundary
  v_d0     timestamptz := date_trunc('day', v_recent at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
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
language sql
stable
security invoker
set search_path = waytara, pg_temp
as $$
  select min(day), max(day) from equipment_rollup_1d where equipment_id = p_equipment_id;
$$;

revoke all on function waytara.device_data_range(uuid) from public, anon;
grant execute on function waytara.device_data_range(uuid) to authenticated, service_role;

-- ============================================================
-- 7. Live channels and the Go Live snapshot bucket
-- ============================================================
-- Topics:  device:<equipment_id>  one broadcast per agent upload (sent by ingest_tick)
--          live:<equipment_id>    presence of dashboard viewers (Go Live) + the agent's live stream
-- Only people who can see the device may listen; only they may announce presence.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists waytara_device_channels_read on realtime.messages';
    execute $p$create policy waytara_device_channels_read on realtime.messages for select to authenticated
      using (
        (select realtime.topic()) ~ '^(device|live):'
        and waytara.can_view_equipment(waytara.try_uuid(split_part((select realtime.topic()), ':', 2)))
      )$p$;
    execute 'drop policy if exists waytara_live_presence_write on realtime.messages';
    execute $p$create policy waytara_live_presence_write on realtime.messages for insert to authenticated
      with check (
        realtime.messages.extension = 'presence'
        and (select realtime.topic()) ~ '^live:'
        and waytara.can_view_equipment(waytara.try_uuid(split_part((select realtime.topic()), ':', 2)))
      )$p$;
  end if;
end $$;

-- Private bucket for the on-demand "today so far" snapshot the agent publishes when a
-- viewer clicks Go Live. Path: <equipment_id>/<file>. The agent (service role) writes and
-- deletes; viewers may only read their own devices' objects.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('live-snapshots', 'live-snapshots', false, 52428800, array['application/json', 'application/gzip', 'application/octet-stream'])
    on conflict (id) do nothing;

    execute 'drop policy if exists waytara_live_snapshots_read on storage.objects';
    execute $p$create policy waytara_live_snapshots_read on storage.objects for select to authenticated
      using (bucket_id = 'live-snapshots' and waytara.can_view_equipment(waytara.try_uuid((storage.foldername(name))[1])))$p$;
  end if;
end $$;

-- ============================================================
-- 8. Schedule
-- ============================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'rollup-run';
    perform cron.schedule('rollup-run', '*/5 * * * *', 'select waytara.run_rollups()');
  end if;
end $$;

select waytara.ensure_rollup_partitions();
