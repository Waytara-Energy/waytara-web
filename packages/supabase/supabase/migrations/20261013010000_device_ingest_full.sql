-- The ESP32 monitoring unit (anon key + per-device token, see 20261011000000_device_ingest_token.sql) can now upload what the
-- Python agent uploads through ingest_tick, still without a service_role key.
--
-- ingest_device_tick takes the same arguments as ingest_tick (p_ts, p_values, p_open, p_closed, p_agent), so the unit can send its
-- 15-minute rollup buckets (p_open / p_closed) and the heartbeat, not only the latest values. The old four-argument version is
-- replaced; a call that sends only values and an agent still works because the new arguments have defaults.
--
-- A token only ever works for its own equipment. Nothing else is exposed to anon.

drop function if exists waytara.ingest_device_tick(uuid, text, jsonb, jsonb);

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
begin
  -- one message for a wrong token and an unknown device, so ids cannot be probed
  if p_token is null or length(p_token) < 16 or not exists (
    select 1 from equipment_ingest_tokens t
    where t.equipment_id = p_equipment_id
      and t.token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
  ) then
    raise exception 'invalid device credentials' using errcode = '28000';
  end if;

  if jsonb_typeof(coalesce(p_closed, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_closed, '[]'::jsonb)) > 1500 then
    raise exception 'p_closed must be an array of at most 1500 buckets' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_values, '{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_open, '{}'::jsonb)) <> 'object' then
    raise exception 'p_values and p_open must be objects' using errcode = '22023';
  end if;

  return ingest_tick(p_equipment_id, coalesce(p_ts, now()), coalesce(p_values, '{}'::jsonb), coalesce(p_open, '{}'::jsonb),
                     coalesce(p_closed, '[]'::jsonb), coalesce(p_agent, '{}'::jsonb));
end;
$$;

revoke all on function waytara.ingest_device_tick(uuid, text, jsonb, jsonb, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function waytara.ingest_device_tick(uuid, text, jsonb, jsonb, jsonb, jsonb, timestamptz) to anon, authenticated, service_role;
