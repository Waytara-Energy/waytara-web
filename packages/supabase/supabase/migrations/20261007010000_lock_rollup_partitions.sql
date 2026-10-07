-- Security fix: the daily/monthly partitions of equipment_rollup_15m / equipment_rollup_1h were created without row-level
-- security, and default privileges gave `authenticated` SELECT and INSERT on each one. RLS on a partitioned parent does not
-- protect a partition queried directly (PostgREST exposes every table in the schema), so a signed-in customer could have
-- read other customers' rollups or inserted rows into a partition. Partitions are internal: lock all existing ones and make
-- the partition-creating functions lock every new one. Reads and writes keep going through the parent tables.

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
  execute format('alter table waytara.%I enable row level security', name);
  execute format('revoke all on waytara.%I from public, anon, authenticated', name);
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
  execute format('alter table waytara.%I enable row level security', name);
  execute format('revoke all on waytara.%I from public, anon, authenticated', name);
end;
$$;

-- Every partition that already exists.
do $$
declare r record;
begin
  for r in
    select c.oid::regclass as t
    from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    where i.inhparent in ('waytara.equipment_rollup_15m'::regclass, 'waytara.equipment_rollup_1h'::regclass)
  loop
    execute format('alter table %s enable row level security', r.t);
    execute format('revoke all on %s from public, anon, authenticated', r.t);
  end loop;
end $$;
