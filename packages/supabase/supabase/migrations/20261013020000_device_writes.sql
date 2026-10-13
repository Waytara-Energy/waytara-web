-- Setting changes for the ESP32 monitoring unit: a change made in the app reaches the inverter within a second or two, and the
-- result comes back to the app.
--
--   1. A trigger on equipment_configs sends a tiny BROADCAST ping on the public channel cfg:<equipment id> whenever a person
--      (not the device) asks for a setting change. The ping carries only the row id and the key, never the value.
--   2. The unit listens on that channel over a WebSocket (Realtime). A broadcast channel cannot be trusted - anyone with the
--      public anon key can publish to it - so the ping is only a wake-up call. The unit then asks device_pending_writes(),
--      which checks its device token and returns the real requests from the table. A forged ping gets the unit nothing.
--   3. After acting, the unit records the outcome with device_report_configs() (agent_write_ok / agent_write_failed), exactly
--      like the Python agent, so the app shows confirmed / mismatch.
--   4. ingest_device_tick() also returns the pending requests in its answer, so the 10-second check-in is a fallback if the
--      WebSocket is down.
--
-- A request is "pending" while it is the newest row for its setting, was made in the last 10 minutes, and has not been answered
-- by the device. Older requests are not replayed onto the inverter (the Python agent never did either).

-- the one place a device token is checked
create or replace function waytara.device_token_ok(p_equipment_id uuid, p_token text)
returns boolean
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select p_token is not null and length(p_token) >= 16 and exists (
    select 1 from equipment_ingest_tokens t
    where t.equipment_id = p_equipment_id
      and t.token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
  )
$$;
revoke all on function waytara.device_token_ok(uuid, text) from public, anon, authenticated;

-- pending requests for one equipment: [{"id":..,"key":..,"value":..,"by":..}]
create or replace function waytara.device_pending_writes_of(p_equipment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'key', l.key_name, 'value', l.setting_value, 'by', l.written_by) order by l.id), '[]'::jsonb)
  from (
    select distinct on (c.key_name) c.id, c.key_name, c.setting_value, c.written_by, c.source
    from equipment_configs c
    where c.equipment_id = p_equipment_id
      and c.ts > now() - interval '10 minutes'
      and exists (select 1 from equipment_metrics m
                  where m.equipment_id = c.equipment_id and m.key_name = c.key_name and m.direction = 'write' and m.show_for_user)
    order by c.key_name, c.ts desc, c.id desc
  ) l
  where coalesce(l.source, '') not like 'agent\_%' and coalesce(l.source, '') <> 'modbus_initial_read'
$$;
revoke all on function waytara.device_pending_writes_of(uuid) from public, anon, authenticated;

create or replace function waytara.device_pending_writes(p_equipment_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  if not device_token_ok(p_equipment_id, p_token) then
    raise exception 'invalid device credentials' using errcode = '28000';
  end if;
  return device_pending_writes_of(p_equipment_id);
end;
$$;
revoke all on function waytara.device_pending_writes(uuid, text) from public, anon, authenticated;
grant execute on function waytara.device_pending_writes(uuid, text) to anon, authenticated, service_role;

-- ingest_device_tick: same as before (see 20261013010000), now with the pending requests in the answer
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
  return v_result || jsonb_build_object('pending_writes', device_pending_writes_of(p_equipment_id));
end;
$$;

revoke all on function waytara.ingest_device_tick(uuid, text, jsonb, jsonb, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function waytara.ingest_device_tick(uuid, text, jsonb, jsonb, jsonb, jsonb, timestamptz) to anon, authenticated, service_role;

-- p_rows: [{"key_name": text, "setting_value": text, "source": "agent_initial_read" | "agent_write_ok" | "agent_write_failed",
--           "previous_value": text, "notes": text, "unit": text, "written_by": uuid}]
create or replace function waytara.device_report_configs(
  p_equipment_id uuid,
  p_token        text,
  p_rows         jsonb
)
returns integer
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  n integer;
begin
  if not device_token_ok(p_equipment_id, p_token) then
    raise exception 'invalid device credentials' using errcode = '28000';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 200 then
    raise exception 'p_rows must be an array of at most 200 rows' using errcode = '22023';
  end if;

  insert into equipment_configs (equipment_id, ts, setting_category, key_name, setting_value, unit, written_by, source, notes, modbus_register, previous_value)
  select p_equipment_id, now(), m.category, r.key_name, r.setting_value, nullif(r.unit, ''), pr.id, r.source,
         left(r.notes, 500), m.address, r.previous_value
  from jsonb_to_recordset(p_rows) as r(key_name text, setting_value text, source text, previous_value text, notes text, unit text, written_by uuid)
  join equipment_metrics m on m.equipment_id = p_equipment_id and m.key_name = r.key_name and m.direction = 'write' and m.show_for_user
  left join profiles pr on pr.id = r.written_by
  where r.setting_value is not null
    and r.source in ('agent_initial_read', 'agent_write_ok', 'agent_write_failed');
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function waytara.device_report_configs(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function waytara.device_report_configs(uuid, text, jsonb) to anon, authenticated, service_role;

-- the wake-up ping: a person asked for a change -> broadcast on cfg:<equipment id> (id + key only, never the value)
create or replace function waytara.notify_device_config_change()
returns trigger
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  if coalesce(new.source, '') not like 'agent\_%' and coalesce(new.source, '') <> 'modbus_initial_read'
     and exists (select 1 from equipment_metrics m
                 where m.equipment_id = new.equipment_id and m.key_name = new.key_name and m.direction = 'write' and m.show_for_user) then
    begin
      perform realtime.send(jsonb_build_object('id', new.id, 'key', new.key_name), 'config_changed', 'cfg:' || new.equipment_id::text, false);
    exception when others then
      null;   -- a failed ping must never fail the user's save
    end;
  end if;
  return null;
end;
$$;
revoke all on function waytara.notify_device_config_change() from public, anon, authenticated;

drop trigger if exists equipment_configs_notify_device on waytara.equipment_configs;
create trigger equipment_configs_notify_device
  after insert on waytara.equipment_configs
  for each row execute function waytara.notify_device_config_change();
