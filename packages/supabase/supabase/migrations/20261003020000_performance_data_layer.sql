-- Phase 4: data-layer performance.
--
--  1. Composite index for the time-series access pattern
--       WHERE equipment_id = ? AND key_name IN (...) AND NOT is_test AND ts >= ?
--  2. waytara.equipment_latest: one row per (device, key) holding the newest
--     reading, maintained by a statement-level trigger. Replaces the fragile
--     "ORDER BY ts DESC LIMIT keys*5" guess the app used to find latest values
--     (which silently dropped any key that hadn't reported recently, and got
--     slower as the telemetry table grew).
--  3. waytara.telemetry_buckets(): server-side time bucketing, so a chart asks
--     for a few hundred pre-averaged rows instead of paging through thousands
--     of raw readings.
--  4. RLS policies evaluate auth.uid() / is_admin() once per query instead of
--     once per row, by wrapping them in a scalar sub-select (Supabase's
--     documented RLS performance pattern).

-- ============================================================
-- 1. Index
-- ============================================================
create index if not exists equipment_telemetry_device_key_ts_idx
  on waytara.equipment_telemetry (equipment_id, key_name, ts desc)
  where not is_test;

-- ============================================================
-- 2. equipment_latest
-- ============================================================
create table if not exists waytara.equipment_latest (
  equipment_id uuid        not null references waytara.equipment (id) on delete cascade,
  key_name     text        not null,
  value        numeric,
  unit         text,
  ts           timestamptz not null,
  primary key (equipment_id, key_name)
);

comment on table waytara.equipment_latest is
  'Newest non-test reading per (device, key). Maintained by trigger from equipment_telemetry; never written by app code.';

alter table waytara.equipment_latest enable row level security;

create policy equipment_latest_admin on waytara.equipment_latest
  for select using ((select waytara.is_admin()));

create policy equipment_latest_owner on waytara.equipment_latest
  for select using (exists (
    select 1 from waytara.equipment d
    join waytara.sites s on s.id = d.site_id
    where d.id = equipment_latest.equipment_id and s.customer_id = (select auth.uid())
  ));

create policy equipment_latest_employee_assigned on waytara.equipment_latest
  for select using (exists (
    select 1 from waytara.equipment d
    join waytara.sites s on s.id = d.site_id
    join waytara.customer_onboarding co on co.customer_id = s.customer_id
    where d.id = equipment_latest.equipment_id and co.employee_id = (select auth.uid())
  ));

revoke all on waytara.equipment_latest from anon, authenticated;
grant select on waytara.equipment_latest to authenticated;
grant all on waytara.equipment_latest to service_role;

-- One upsert per INSERT *statement* (a batch of readings), not per row.
create or replace function waytara.sync_equipment_latest()
returns trigger
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  insert into equipment_latest (equipment_id, key_name, value, unit, ts)
  select distinct on (equipment_id, key_name) equipment_id, key_name, value, unit, ts
  from new_rows
  where not is_test
  order by equipment_id, key_name, ts desc
  on conflict (equipment_id, key_name) do update
    set value = excluded.value, unit = excluded.unit, ts = excluded.ts
    where equipment_latest.ts <= excluded.ts;
  return null;
end;
$$;

revoke all on function waytara.sync_equipment_latest() from public, anon, authenticated;

drop trigger if exists equipment_telemetry_sync_latest on waytara.equipment_telemetry;
create trigger equipment_telemetry_sync_latest
  after insert on waytara.equipment_telemetry
  referencing new table as new_rows
  for each statement execute function waytara.sync_equipment_latest();

-- Backfill from existing history (one-time).
insert into waytara.equipment_latest (equipment_id, key_name, value, unit, ts)
select distinct on (equipment_id, key_name) equipment_id, key_name, value, unit, ts
from waytara.equipment_telemetry
where not is_test
order by equipment_id, key_name, ts desc
on conflict (equipment_id, key_name) do nothing;

-- Live updates for the dashboard come from this small table instead of the
-- raw telemetry firehose.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'waytara' and tablename = 'equipment_latest') then
    alter publication supabase_realtime add table waytara.equipment_latest;
  end if;
end $$;

-- ============================================================
-- 3. Server-side bucketing
-- ============================================================
-- SECURITY INVOKER: runs as the caller, so the telemetry RLS policies still
-- decide which devices' readings are visible.
create or replace function waytara.telemetry_buckets(
  p_equipment_id uuid,
  p_keys text[],
  p_from timestamptz,
  p_to timestamptz,
  p_bucket_minutes int
)
returns table (bucket timestamptz, key_name text, avg_value double precision, samples int)
language plpgsql
stable
security invoker
set search_path = waytara, pg_temp
as $$
begin
  if p_bucket_minutes is null or p_bucket_minutes < 1 or p_bucket_minutes > 1440 then
    raise exception 'bucket size must be between 1 and 1440 minutes';
  end if;
  if p_to - p_from > interval '400 days' then
    raise exception 'time range too large (max 400 days)';
  end if;

  return query
  select date_bin(make_interval(mins => p_bucket_minutes), t.ts, p_from) as bucket,
         t.key_name,
         avg(t.value)::double precision as avg_value,
         count(*)::int as samples
  from equipment_telemetry t
  where t.equipment_id = p_equipment_id
    and t.key_name = any (p_keys)
    and not t.is_test
    and t.ts >= p_from
    and t.ts < p_to
  group by 1, 2
  order by 1, 2;
end;
$$;

revoke all on function waytara.telemetry_buckets(uuid, text[], timestamptz, timestamptz, int) from public, anon;
grant execute on function waytara.telemetry_buckets(uuid, text[], timestamptz, timestamptz, int) to authenticated, service_role;

-- ============================================================
-- 4. RLS: evaluate auth.uid() / role helpers once per query, not per row
-- ============================================================
do $$
declare
  p record;
  q text;
  c text;
  stmt text;
  tokens text[][] := array[
    array['auth.uid()',                    '(select auth.uid())'],
    array['waytara.is_admin()',            '(select waytara.is_admin())'],
    array['waytara.is_staff()',            '(select waytara.is_staff())'],
    array['waytara.is_site_engineer_or_admin()', '(select waytara.is_site_engineer_or_admin())']
  ];
  i int;
  wrapped_re text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'waytara'
  loop
    q := p.qual;
    c := p.with_check;

    for i in 1 .. array_length(tokens, 1) loop
      -- Postgres prints an already-wrapped call as "( SELECT fn() AS fn)";
      -- protect those before wrapping the bare calls.
      wrapped_re := '\(\s*select\s+' || regexp_replace(tokens[i][1], '([.()])', '\\\1', 'g') || '\s+as\s+\w+\s*\)';
      if q is not null then
        q := regexp_replace(q, wrapped_re, '@@KEEP' || i || '@@', 'gi');
        q := replace(q, tokens[i][1], tokens[i][2]);
        q := replace(q, '@@KEEP' || i || '@@', tokens[i][2]);
      end if;
      if c is not null then
        c := regexp_replace(c, wrapped_re, '@@KEEP' || i || '@@', 'gi');
        c := replace(c, tokens[i][1], tokens[i][2]);
        c := replace(c, '@@KEEP' || i || '@@', tokens[i][2]);
      end if;
    end loop;

    if q is distinct from p.qual or c is distinct from p.with_check then
      stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
      if q is not null then stmt := stmt || format(' using (%s)', q); end if;
      if c is not null then stmt := stmt || format(' with check (%s)', c); end if;
      execute stmt;
    end if;
  end loop;
end $$;
