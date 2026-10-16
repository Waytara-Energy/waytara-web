-- Task A9: what the backend's settings write-back needs from the database.
--
--   gw_pending_writes     the settings a person changed in the last 10 minutes that the unit has not answered yet (the same rule the
--                         old agent path uses: the newest log row of a setting that is not from the device itself)
--   gw_report_settings    the unit's word on a setting: the value it holds at start-up or after a change on the inverter itself
--                         (agent_initial_read), a confirmed write (agent_write_ok, value = what was read back) or a failed one
--                         (agent_write_failed, value = what the inverter still holds, previous_value = what was asked for)
--   gw_last_settings      the newest log row of every setting, so the backend can tell a changed value from an unchanged one
--
-- Only the registered backend identity (waytara.gateway_service_users) may call any of these. The settings log (equipment_configs) stays
-- append-only and the old agent path (device_pending_writes / device_report_configs) is untouched. Rollback is at the bottom.

create or replace function waytara.gw_pending_writes(p_equipment uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  if not exists (select 1 from waytara.equipment where id = p_equipment) then
    raise exception 'unknown equipment' using errcode = 'P0002';
  end if;
  return waytara.device_pending_writes_of(p_equipment);
end;
$$;

create or replace function waytara.gw_report_settings(p_equipment uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  n integer;
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
begin
  perform waytara._require_gateway_service();
  if not exists (select 1 from waytara.equipment where id = p_equipment) then
    raise exception 'unknown equipment' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 200 then
    raise exception 'p_rows must be an array of at most 200 rows' using errcode = '22023';
  end if;

  -- The audit trigger on equipment_configs names the signed-in user as the actor and that user must have a profile. The backend identity
  -- has none (and must not get one: a profile carries a role), so for this insert the unit itself is the actor (no user), exactly as on the
  -- old agent path. The caller's claims are put back straight after; the setting only lives for this transaction.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  insert into waytara.equipment_configs (equipment_id, ts, setting_category, key_name, setting_value, unit, written_by, source, notes, modbus_register, previous_value)
  select p_equipment, now(), m.category, r.key_name, r.setting_value, nullif(r.unit, ''), pr.id, r.source,
         left(r.notes, 500), m.address, r.previous_value
  from jsonb_to_recordset(p_rows) as r(key_name text, setting_value text, source text, previous_value text, notes text, unit text, written_by uuid)
  join waytara.equipment_metrics m on m.equipment_id = p_equipment and m.key_name = r.key_name and m.direction = 'write' and m.show_for_user
  left join waytara.profiles pr on pr.id = r.written_by
  where r.setting_value is not null
    and r.source in ('agent_initial_read', 'agent_write_ok', 'agent_write_failed')
    -- a plain read of a setting a person is waiting for is not recorded: it would be newer than the request and hide it
    and (r.source <> 'agent_initial_read' or not exists (
          select 1 from waytara.equipment_configs c
          where c.equipment_id = p_equipment and c.key_name = r.key_name
            and c.ts > now() - interval '10 minutes'
            and coalesce(c.source, '') not like 'agent\_%' and coalesce(c.source, '') <> 'modbus_initial_read'
            and not exists (select 1 from waytara.equipment_configs n
                            where n.equipment_id = c.equipment_id and n.key_name = c.key_name and (n.ts, n.id) > (c.ts, c.id))));
  get diagnostics n = row_count;

  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  return n;
end;
$$;

create or replace function waytara.gw_last_settings(p_equipment uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  if not exists (select 1 from waytara.equipment where id = p_equipment) then
    raise exception 'unknown equipment' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('key', l.key_name, 'value', l.setting_value, 'source', l.source, 'id', l.id) order by l.key_name)
    from (
      select distinct on (c.key_name) c.key_name, c.setting_value, c.source, c.id
      from waytara.equipment_configs c
      where c.equipment_id = p_equipment
      order by c.key_name, c.ts desc, c.id desc
    ) l
  ), '[]'::jsonb);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'gw_pending_writes(uuid)',
    'gw_report_settings(uuid, jsonb)',
    'gw_last_settings(uuid)'
  ] loop
    execute format('revoke all on function waytara.%s from public, anon', f);
    execute format('grant execute on function waytara.%s to authenticated, service_role', f);
  end loop;
end;
$$;

-- Rollback:
--   drop function if exists waytara.gw_last_settings(uuid), waytara.gw_report_settings(uuid, jsonb), waytara.gw_pending_writes(uuid);
