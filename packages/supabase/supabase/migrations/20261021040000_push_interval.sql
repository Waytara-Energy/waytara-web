-- The push interval (task T10 of docs/GATEWAY_V3_TASKS.md): how often the hub writes the averaged 15-minute figures and the latest values of one
-- unit to Supabase. It already lived in waytara.gateway_equipment_settings.upload_interval_s (60 to 3600 s, default 900); this adds the two
-- functions the hub uses to read and change it, with a fixed list of allowed values and a line in the activity log (T9).
--
-- Only the registered backend identity may call them (like every gw_ function); the backend decides WHO may ask: the people who may manage
-- the unit's keys (admins, employees and site engineers with access to the site). The allowed values keep the buckets sensible.

create or replace function waytara.gw_get_push_interval(p_actor uuid, p_equipment uuid)
returns integer
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  if not waytara.gw_actor_can_manage_keys(p_actor, p_equipment) then
    return null;
  end if;
  return coalesce((select s.upload_interval_s from waytara.gateway_equipment_settings s where s.equipment_id = p_equipment), 900);
end;
$$;

create or replace function waytara.gw_set_push_interval(p_equipment uuid, p_actor uuid, p_seconds integer, p_ip inet default null)
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_old integer;
  v_txt text;
begin
  perform waytara._require_gateway_service();
  if not waytara.gw_actor_can_manage_keys(p_actor, p_equipment) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_seconds is null or p_seconds not in (60, 120, 300, 600, 900, 1800, 3600) then
    raise exception 'the push interval must be 60, 120, 300, 600, 900, 1800 or 3600 seconds' using errcode = '22023';
  end if;

  select coalesce(s.upload_interval_s, 900) into v_old from waytara.gateway_equipment_settings s where s.equipment_id = p_equipment;
  v_old := coalesce(v_old, 900);

  insert into waytara.gateway_equipment_settings (equipment_id, upload_interval_s, updated_at)
  values (p_equipment, p_seconds, now())
  on conflict (equipment_id) do update set upload_interval_s = excluded.upload_interval_s, updated_at = now();

  if p_seconds <> v_old then
    v_txt := case when p_seconds < 3600 then (p_seconds / 60) || ' minute' || case when p_seconds / 60 = 1 then '' else 's' end else '1 hour' end;
    perform waytara._record_activity(p_equipment, null, p_actor, 'setup_page', 'push_interval_changed',
      'The push interval was changed to ' || v_txt, jsonb_build_object('from_s', v_old, 'to_s', p_seconds), p_ip);
  end if;
  return jsonb_build_object('previous', v_old, 'seconds', p_seconds);
end;
$$;

revoke all on function waytara.gw_get_push_interval(uuid, uuid) from public, anon;
revoke all on function waytara.gw_set_push_interval(uuid, uuid, integer, inet) from public, anon;
grant execute on function waytara.gw_get_push_interval(uuid, uuid) to authenticated, service_role;
grant execute on function waytara.gw_set_push_interval(uuid, uuid, integer, inet) to authenticated, service_role;

-- To undo: drop function waytara.gw_set_push_interval(uuid, uuid, integer, inet), waytara.gw_get_push_interval(uuid, uuid);
