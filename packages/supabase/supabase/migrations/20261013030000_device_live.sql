-- Go Live for the ESP32 monitoring unit (no PC, no storage bucket).
--
-- The dashboard viewer already listens on the private Realtime channel live:<equipment id> (only people who can see the device may
-- listen, see 20261006000000_rollup_data_layer.sql) and expects one "tick" {t: epoch ms, v: {key: value}} per reading. The Python
-- agent publishes those from its PC. The ESP32 cannot join a private channel (it has no user login), so:
--
--   1. The viewer calls request_live(equipment) now and then (every ~30 s while the page is open). That keeps a "someone is watching
--      until ..." time in equipment_live_requests, and, when it switches on, sends a public wake-up ping on cfg:<equipment id>.
--   2. The unit hears the ping (or reads "live": true in its 10-second check-in answer) and starts sending its readings to
--      device_live_tick() with its device token. The function checks the token, and that someone is watching, and publishes the
--      tick on the private channel. When nobody renews, the time runs out and the answer says "live": false, so the unit stops.
--
-- Nothing is stored except the one "until" row per equipment; no readings are written to a table.

create table if not exists waytara.equipment_live_requests (
  equipment_id uuid primary key references waytara.equipment(id) on delete cascade,
  until        timestamptz not null
);
alter table waytara.equipment_live_requests enable row level security;
revoke all on waytara.equipment_live_requests from public, anon, authenticated;
grant all on waytara.equipment_live_requests to service_role;

-- is someone watching right now?
create or replace function waytara.device_live_active(p_equipment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select exists (select 1 from equipment_live_requests r where r.equipment_id = p_equipment_id and r.until > now())
$$;
revoke all on function waytara.device_live_active(uuid) from public, anon, authenticated;

-- A viewer asks for the live stream (and renews it). Returns until when it is on.
create or replace function waytara.request_live(p_equipment_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_was_active boolean;
  v_until      timestamptz := now() + interval '75 seconds';
begin
  if not can_view_equipment(p_equipment_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_was_active := device_live_active(p_equipment_id);
  insert into equipment_live_requests (equipment_id, until) values (p_equipment_id, v_until)
  on conflict (equipment_id) do update set until = excluded.until;
  if not v_was_active then
    begin
      -- wake the unit now instead of at its next check-in (public ping, no data in it)
      perform realtime.send(jsonb_build_object('live', true), 'live_requested', 'cfg:' || p_equipment_id::text, false);
    exception when others then
      null;
    end;
  end if;
  return v_until;
end;
$$;
revoke all on function waytara.request_live(uuid) from public, anon;
grant execute on function waytara.request_live(uuid) to authenticated, service_role;

-- The unit's readings for the viewers: one tick per call. p_t = epoch milliseconds, p_v = {key: number}.
create or replace function waytara.device_live_tick(
  p_equipment_id uuid,
  p_token        text,
  p_t            bigint,
  p_v            jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  if not device_token_ok(p_equipment_id, p_token) then
    raise exception 'invalid device credentials' using errcode = '28000';
  end if;
  if not device_live_active(p_equipment_id) then
    return jsonb_build_object('live', false);                 -- nobody is watching: the unit stops streaming
  end if;
  if jsonb_typeof(p_v) <> 'object' or (select count(*) from jsonb_object_keys(p_v)) > 120 then
    raise exception 'p_v must be an object of at most 120 readings' using errcode = '22023';
  end if;
  begin
    perform realtime.send(jsonb_build_object('t', p_t, 'v', p_v), 'tick', 'live:' || p_equipment_id::text, true);
  exception when others then
    null;
  end;
  return jsonb_build_object('live', true);
end;
$$;
revoke all on function waytara.device_live_tick(uuid, text, bigint, jsonb) from public, anon, authenticated;
grant execute on function waytara.device_live_tick(uuid, text, bigint, jsonb) to anon, authenticated, service_role;

-- The check-in answer now also says whether someone is watching (so the unit starts without waiting for the ping).
create or replace function waytara.ingest_device_tick(
  p_equipment_id uuid,
  p_token        text,
  p_values       jsonb default '{}'::jsonb,
  p_open         jsonb default '{}'::jsonb,
  p_closed       jsonb default '[]'::jsonb,
  p_agent        jsonb default '{}'::jsonb,
  p_ts           timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not device_token_ok(p_equipment_id, p_token) then
    raise exception 'invalid device credentials' using errcode = '28000';
  end if;

  if jsonb_typeof(coalesce(p_closed, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_closed, '[]'::jsonb)) > 1500 then
    raise exception 'p_closed must be an array of at most 1500 buckets' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_values, '{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_open, '{}'::jsonb)) <> 'object' then
    raise exception 'p_values and p_open must be objects' using errcode = '22023';
  end if;

  v_result := ingest_tick(p_equipment_id, coalesce(p_ts, now()), coalesce(p_values, '{}'::jsonb), coalesce(p_open, '{}'::jsonb),
                          coalesce(p_closed, '[]'::jsonb), coalesce(p_agent, '{}'::jsonb));
  return v_result || jsonb_build_object('pending_writes', device_pending_writes_of(p_equipment_id), 'live', device_live_active(p_equipment_id));
end;
$$;

revoke all on function waytara.ingest_device_tick(uuid, text, jsonb, jsonb, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function waytara.ingest_device_tick(uuid, text, jsonb, jsonb, jsonb, jsonb, timestamptz) to anon, authenticated, service_role;
