-- A lighter check-in. The agent used to be heard from only when it uploaded (every 15 minutes by default), so a unit that
-- lost power - an adapter / ESP fed by the inverter, with the inverter switched off - was only noticed after three
-- upload intervals (45 minutes). The agent now also sends a tiny check-in every minute (no values, just its state) and
-- says how often in heartbeat_s; the dashboard and the alert job judge "the unit has gone quiet" by that, so power loss
-- shows within minutes.
--
--   p_agent {"interval_s": int, "heartbeat_s": int, "version": text, "device_online": bool,
--            "last_read_at": timestamptz, "device_error": text}

alter table waytara.equipment_heartbeat add column if not exists heartbeat_s integer;
comment on column waytara.equipment_heartbeat.heartbeat_s is 'How often the agent checks in (seconds), apart from its uploads; null for older agents.';

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
  v_online     boolean;
  v_last_read  timestamptz;
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

  -- The heartbeat says the AGENT is alive (last_seen); device_online / last_read_at say whether the DEVICE answered it.
  insert into equipment_heartbeat (equipment_id, last_seen, agent_ts, upload_interval_s, heartbeat_s, agent_version, device_online, last_read_at, device_error)
  values (p_equipment_id, v_now, p_ts, nullif(p_agent ->> 'interval_s', '')::int, nullif(p_agent ->> 'heartbeat_s', '')::int, p_agent ->> 'version',
          nullif(p_agent ->> 'device_online', '')::boolean,
          case when nullif(p_agent ->> 'last_read_at', '') is null then null else least((p_agent ->> 'last_read_at')::timestamptz, v_now) end,
          case when (p_agent ->> 'device_online') = 'false' then left(nullif(p_agent ->> 'device_error', ''), 300) end)
  on conflict (equipment_id) do update
    set last_seen = excluded.last_seen, agent_ts = excluded.agent_ts,
        upload_interval_s = coalesce(excluded.upload_interval_s, equipment_heartbeat.upload_interval_s),
        heartbeat_s = coalesce(excluded.heartbeat_s, equipment_heartbeat.heartbeat_s),
        agent_version = coalesce(excluded.agent_version, equipment_heartbeat.agent_version),
        device_online = coalesce(excluded.device_online, equipment_heartbeat.device_online),
        last_read_at = greatest(excluded.last_read_at, equipment_heartbeat.last_read_at),
        -- why the device is not answering: kept while it stays unreachable, cleared as soon as it answers again
        device_error = case
          when excluded.device_online is false then coalesce(excluded.device_error, equipment_heartbeat.device_error)
          when excluded.device_online is true then null
          else equipment_heartbeat.device_error end;
  select h.device_online, h.last_read_at into v_online, v_last_read from equipment_heartbeat h where h.equipment_id = p_equipment_id;

  -- One live message per upload on the device's private channel. Never fails the ingest.
  if n_values > 0 or n_open > 0 or p_agent ? 'device_online' then
    begin
      v_payload := jsonb_build_object('ts', v_ts, 'values', coalesce(p_values, '{}'::jsonb), 'open', coalesce(p_open, '{}'::jsonb),
                                      'agent', jsonb_build_object('device_online', v_online, 'last_read_at', v_last_read));
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
