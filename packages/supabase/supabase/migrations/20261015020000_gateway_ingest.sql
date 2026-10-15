-- Task A4c: what the backend's data intake needs from the database.
--
--   gateway_equipment_settings   per-equipment intake settings (upload interval, registers the inverter never answers)
--   gw_equipment_profile         the catalogue of one unit (equipment_metrics + template) and its stock specs, as one document
--   gw_store_map                 remembers each register map a board was given (idempotent by hash)
--   gw_ingest_summaries          15-minute summaries (a rewritten bucket REPLACES the stored one), the running figures of the open
--                                bucket, and the newest live values
--   gw_report_heartbeat          one check-in of a board: feeds equipment_heartbeat, whose triggers set the status verdict
--
-- Only the registered backend identity (waytara.gateway_service_users) may call any of these. The existing agent path
-- (ingest_tick / ingest_device_tick) is untouched. Rollback is at the bottom of this file.

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 1. Per-equipment settings
-- ---------------------------------------------------------------------------------------------------------------------------------

create table if not exists waytara.gateway_equipment_settings (
  equipment_id          uuid primary key references waytara.equipment(id) on delete cascade,
  upload_interval_s     integer not null default 900 check (upload_interval_s between 60 and 3600),
  -- registers the inverter is known not to answer (the 10 Sep sweep): a request is never extended across them
  unreadable_registers  integer[] not null default '{}',
  updated_at            timestamptz not null default now()
);

alter table waytara.gateway_equipment_settings enable row level security;
revoke all on waytara.gateway_equipment_settings from public, anon, authenticated;
grant select on waytara.gateway_equipment_settings to authenticated;
grant all on waytara.gateway_equipment_settings to service_role;

drop policy if exists gateway_equipment_settings_admin_select on waytara.gateway_equipment_settings;
create policy gateway_equipment_settings_admin_select on waytara.gateway_equipment_settings
  for select to authenticated using ((select waytara.is_admin()));

-- The Waytara Office inverter: the two registers its sweep on 10 Sep 2026 found silent.
insert into waytara.gateway_equipment_settings (equipment_id, unreadable_registers)
select e.id, array[603, 611]
from waytara.equipment e
where e.id = 'b4c30eb8-fba4-4487-aa7a-3c1b089e36e2'
on conflict (equipment_id) do nothing;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 2. The catalogue of one unit
-- ---------------------------------------------------------------------------------------------------------------------------------

create or replace function waytara.gw_equipment_profile(p_equipment uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_result jsonb;
begin
  perform waytara._require_gateway_service();

  select jsonb_build_object(
    'upload_interval_s', coalesce(s.upload_interval_s, 900),
    'unreadable_registers', to_jsonb(coalesce(s.unreadable_registers, '{}'::integer[])),
    'mppt_count', case when (i.technical_specs ->> 'mppt_count') ~ '^[0-9]{1,3}$' then (i.technical_specs ->> 'mppt_count')::integer end,
    'metrics', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', m.key_name,
               'direction', m.direction,
               'registers', coalesce(m.address -> 'registers', '[]'::jsonb),
               'decode', m.decode,
               'enum_ref', m.enum_ref,
               'value_kind', t.value_kind,
               'valid_min', m.valid_min,
               'valid_max', m.valid_max,
               'cadence_seconds', m.cadence_seconds,
               'show_for_user', m.show_for_user,
               'poll_enabled', m.poll_enabled,
               'verified', m.is_verified
             ) order by m.key_name, m.direction)
      from waytara.equipment_metrics m
      left join waytara.equipment_templates t on t.device_category = m.device_category and t.key_name = m.key_name
      where m.equipment_id = p_equipment
    ), '[]'::jsonb)
  )
  into v_result
  from waytara.equipment e
  left join waytara.equipment_inventory i on i.id = e.stock_id
  left join waytara.gateway_equipment_settings s on s.equipment_id = e.id
  where e.id = p_equipment;

  return v_result;   -- null when the equipment does not exist
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 3. Register maps given to boards
-- ---------------------------------------------------------------------------------------------------------------------------------

create or replace function waytara.gw_store_map(p_equipment uuid, p_hash text, p_body jsonb)
returns integer
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_version integer;
begin
  perform waytara._require_gateway_service();
  if p_hash is null or char_length(p_hash) not between 8 and 128 or p_body is null or jsonb_typeof(p_body) <> 'object' then
    raise exception 'invalid register map' using errcode = '22023';
  end if;
  if not exists (select 1 from waytara.equipment where id = p_equipment) then
    raise exception 'unknown equipment' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gw_store_map/' || p_equipment::text, 0));

  select version into v_version from waytara.register_map_versions where equipment_id = p_equipment and hash = p_hash;
  if v_version is not null then
    return v_version;
  end if;

  select coalesce(max(version), 0) + 1 into v_version from waytara.register_map_versions where equipment_id = p_equipment;
  insert into waytara.register_map_versions (equipment_id, version, hash, body) values (p_equipment, v_version, p_hash, p_body);
  return v_version;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 4. Summaries and live values
-- ---------------------------------------------------------------------------------------------------------------------------------
-- p_buckets  [ {"k": key, "b": bucket start, "w": wsum, "c": covered_s, "mn":, "mx":, "l":, "pw":, "nw":, "n":} ]
-- p_latest   [ {"k": key, "v": value, "t": seconds since 1970} ]
-- p_open     [ {"k": key, "b":, "w":, "c":, "mn":, "mx":, "l":, "pw":, "nw":, "n":} ]   the unfinished bucket (equipment_open_bucket)
-- Unlike ingest_tick, a bucket that arrives again REPLACES the stored one whatever it covers: the backend recomputes the whole
-- bucket from the raw readings every time, so the newest version is the most complete.

drop function if exists waytara.gw_ingest_summaries(uuid, jsonb, jsonb);

create or replace function waytara.gw_ingest_summaries(p_equipment uuid, p_buckets jsonb default '[]'::jsonb, p_latest jsonb default '[]'::jsonb, p_open jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_now      timestamptz := now();
  n_buckets  integer := 0;
  n_rejected integer := 0;
  n_latest   integer := 0;
  n_open     integer := 0;
  d          timestamptz;
  v_payload  jsonb;
begin
  perform waytara._require_gateway_service();
  if not exists (select 1 from waytara.equipment where id = p_equipment) then
    raise exception 'unknown equipment' using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(p_buckets, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_buckets, '[]'::jsonb)) > 3000
     or jsonb_typeof(coalesce(p_latest, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_latest, '[]'::jsonb)) > 1500
     or jsonb_typeof(coalesce(p_open, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_open, '[]'::jsonb)) > 1500 then
    raise exception 'too many or malformed entries' using errcode = '22023';
  end if;

  for d in
    select distinct date_trunc('day', (c ->> 'b')::timestamptz at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
    from jsonb_array_elements(coalesce(p_buckets, '[]'::jsonb)) c
    where c ? 'b' and (c ->> 'b')::timestamptz >= v_now - interval '8 days' and (c ->> 'b')::timestamptz < v_now + interval '1 day'
  loop
    perform waytara.ensure_rollup_15m_partition(d);
  end loop;

  with cb as (
    select e ->> 'k' as key_name,
           (e ->> 'b')::timestamptz as bucket,
           (e ->> 'w')::double precision as wsum, (e ->> 'c')::double precision as covered_s,
           (e ->> 'mn')::double precision as mn, (e ->> 'mx')::double precision as mx, (e ->> 'l')::double precision as lv,
           (e ->> 'pw')::double precision as pw, (e ->> 'nw')::double precision as nw,
           coalesce((e ->> 'n')::integer, 0) as n
    from jsonb_array_elements(coalesce(p_buckets, '[]'::jsonb)) e
    where e ? 'k' and e ? 'b' and e ? 'w' and e ? 'c'
  ), ok as (
    select * from cb
    where bucket >= v_now - interval '8 days'
      and bucket <  v_now + interval '1 day'
      and mod(extract(epoch from bucket)::bigint, 900) = 0
      and covered_s > 0 and covered_s <= 900.001
  ), ins as (
    insert into waytara.equipment_rollup_15m as r (equipment_id, key_name, bucket, is_test, wsum, covered_s, min_value, max_value, last_value, pos_wsum, neg_wsum, n_samples, created_at)
    select p_equipment, key_name, bucket, false, wsum, covered_s, mn, mx, lv, pw, nw, n, v_now from ok
    on conflict (equipment_id, key_name, bucket, is_test) do update
      set wsum = excluded.wsum, covered_s = excluded.covered_s,
          min_value = excluded.min_value, max_value = excluded.max_value, last_value = excluded.last_value,
          pos_wsum = excluded.pos_wsum, neg_wsum = excluded.neg_wsum, n_samples = excluded.n_samples,
          created_at = v_now
    returning 1
  )
  select (select count(*) from ins), (select count(*) from cb) - (select count(*) from ok)
  into n_buckets, n_rejected;

  insert into waytara.equipment_latest (equipment_id, key_name, value, unit, ts)
  select p_equipment, e ->> 'k', (e ->> 'v')::numeric, null, least(to_timestamp((e ->> 't')::double precision), v_now)
  from jsonb_array_elements(coalesce(p_latest, '[]'::jsonb)) e
  where e ? 'k' and jsonb_typeof(e -> 'v') = 'number' and jsonb_typeof(e -> 't') = 'number'
  on conflict (equipment_id, key_name) do update
    set value = excluded.value, ts = excluded.ts
    where equipment_latest.ts <= excluded.ts;
  get diagnostics n_latest = row_count;

  -- running figures of the unfinished bucket: a newer bucket replaces an older one, the same bucket is replaced by its newer version
  insert into waytara.equipment_open_bucket as o (equipment_id, key_name, bucket, wsum, covered_s, min_value, max_value, last_value, pos_wsum, neg_wsum, n_samples, updated_at)
  select p_equipment, e ->> 'k', (e ->> 'b')::timestamptz,
         (e ->> 'w')::double precision, (e ->> 'c')::double precision,
         (e ->> 'mn')::double precision, (e ->> 'mx')::double precision, (e ->> 'l')::double precision,
         (e ->> 'pw')::double precision, (e ->> 'nw')::double precision,
         coalesce((e ->> 'n')::integer, 0), v_now
  from jsonb_array_elements(coalesce(p_open, '[]'::jsonb)) e
  where e ? 'k' and e ? 'b' and e ? 'w' and e ? 'c'
    and (e ->> 'b')::timestamptz >= v_now - interval '1 hour' and (e ->> 'b')::timestamptz < v_now + interval '1 hour'
    and mod(extract(epoch from (e ->> 'b')::timestamptz)::bigint, 900) = 0
    and (e ->> 'c')::double precision between 0 and 900.001
  on conflict (equipment_id, key_name) do update
    set bucket = excluded.bucket, wsum = excluded.wsum, covered_s = excluded.covered_s,
        min_value = excluded.min_value, max_value = excluded.max_value, last_value = excluded.last_value,
        pos_wsum = excluded.pos_wsum, neg_wsum = excluded.neg_wsum, n_samples = excluded.n_samples, updated_at = excluded.updated_at
    where o.bucket <= excluded.bucket;
  get diagnostics n_open = row_count;

  -- the dashboards listen on the device's private channel; one message per write, never fails the write
  if n_latest > 0 or n_open > 0 then
    begin
      v_payload := jsonb_build_object(
        'ts', v_now,
        'values', (select coalesce(jsonb_object_agg(e ->> 'k', e -> 'v'), '{}'::jsonb)
                   from jsonb_array_elements(coalesce(p_latest, '[]'::jsonb)) e
                   where e ? 'k' and jsonb_typeof(e -> 'v') = 'number'),
        'open', (select coalesce(jsonb_object_agg(e ->> 'k', e - 'k'), '{}'::jsonb)
                 from jsonb_array_elements(coalesce(p_open, '[]'::jsonb)) e
                 where e ? 'k' and e ? 'b' and e ? 'w' and e ? 'c'));
      if pg_column_size(v_payload) < 200000 then
        perform realtime.send(v_payload, 'tick', 'device:' || p_equipment::text, true);
      end if;
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object('buckets_written', n_buckets, 'buckets_rejected', n_rejected, 'latest_updated', n_latest, 'open_updated', n_open);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 5. Check-ins
-- ---------------------------------------------------------------------------------------------------------------------------------
-- The status verdict (online / device_unreachable / offline) is set by the triggers on equipment_heartbeat, from the SERVER clock.

create or replace function waytara.gw_report_heartbeat(
  p_equipment            uuid,
  p_uptime_s             double precision default null,
  p_inverter_online      boolean default null,
  p_last_modbus_ok_age_s double precision default null,
  p_fw_version           text default null,
  p_map_version          integer default null,
  p_reset_reason         text default null,
  p_clock_offset_s       double precision default null,
  p_upload_interval_s    integer default null,
  p_heartbeat_s          integer default 10
)
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  -- the wall clock, not the transaction start: two check-ins in one transaction (a test, a batch) are still two check-ins
  v_now timestamptz := clock_timestamp();
begin
  perform waytara._require_gateway_service();
  if not exists (select 1 from waytara.equipment where id = p_equipment) then
    raise exception 'unknown equipment' using errcode = 'P0002';
  end if;

  insert into waytara.equipment_heartbeat as h (equipment_id, last_seen, agent_ts, upload_interval_s, agent_version, heartbeat_s, device_online, last_read_at, device_error)
  values (
    p_equipment,
    v_now,
    case when p_clock_offset_s is not null then v_now + make_interval(secs => p_clock_offset_s) end,
    p_upload_interval_s,
    p_fw_version,
    greatest(coalesce(p_heartbeat_s, 10), 1),
    p_inverter_online,
    case when p_last_modbus_ok_age_s is not null then v_now - make_interval(secs => greatest(p_last_modbus_ok_age_s, 0)) end,
    case when p_inverter_online is false then 'The inverter is not answering the monitoring unit' end
  )
  on conflict (equipment_id) do update
    set last_seen         = excluded.last_seen,
        agent_ts          = coalesce(excluded.agent_ts, h.agent_ts),
        upload_interval_s = coalesce(excluded.upload_interval_s, h.upload_interval_s),
        agent_version     = coalesce(excluded.agent_version, h.agent_version),
        heartbeat_s       = excluded.heartbeat_s,
        device_online     = coalesce(excluded.device_online, h.device_online),
        last_read_at      = coalesce(excluded.last_read_at, h.last_read_at),
        device_error      = case when excluded.device_online is false then excluded.device_error
                                 when excluded.device_online is true then null
                                 else h.device_error end;

  -- what we know about the board itself (a row exists once it has collected its key)
  update waytara.gateway_devices g
     set fw_version   = coalesce(p_fw_version, g.fw_version),
         map_version  = coalesce(p_map_version, g.map_version),
         reset_reason = coalesce(p_reset_reason, g.reset_reason),
         last_boot_at = case when p_uptime_s is not null then v_now - make_interval(secs => greatest(p_uptime_s, 0)) else g.last_boot_at end,
         updated_at   = v_now
   where g.equipment_id = p_equipment;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'gw_equipment_profile(uuid)',
    'gw_store_map(uuid, text, jsonb)',
    'gw_ingest_summaries(uuid, jsonb, jsonb, jsonb)',
    'gw_report_heartbeat(uuid, double precision, boolean, double precision, text, integer, text, double precision, integer, integer)'
  ] loop
    execute format('revoke all on function waytara.%s from public, anon', f);
    execute format('grant execute on function waytara.%s to authenticated, service_role', f);
  end loop;
end;
$$;

-- Rollback:
--   drop function if exists waytara.gw_report_heartbeat(uuid, double precision, boolean, double precision, text, integer, text, double precision, integer, integer),
--     waytara.gw_ingest_summaries(uuid, jsonb, jsonb, jsonb), waytara.gw_store_map(uuid, text, jsonb), waytara.gw_equipment_profile(uuid);
--   drop table if exists waytara.gateway_equipment_settings;
