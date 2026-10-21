-- Read rates per value: staff choose, for one unit, how often each value is read from the inverter (the "cadence seconds" of the register map).
-- The unit reads each register at the fastest rate of the values that use it, and the cadence files in R2 keep the raw readings of each round,
-- so what is stored follows these rates.
--
-- equipment_metrics.cadence_seconds stays THE rate in force (the hub, the rollups and the reports already read it). The rate the register map was
-- made with is kept next to it in map_cadence_seconds, so "use the map's rate" can always put it back. Only the registered backend identity may
-- call the two functions; the backend decides who may ask (the people who may manage the unit, as for the push interval).

alter table waytara.device_activity drop constraint if exists device_activity_action_check;
alter table waytara.device_activity add constraint device_activity_action_check check (action in (
  'unit_claimed', 'key_rotated', 'key_rotation_failed', 'key_revoked', 'unit_released',
  'wifi_changed', 'wifi_removed', 'unit_restarted', 'push_interval_changed',
  'setting_requested', 'setting_confirmed', 'setting_failed',
  'access_granted', 'access_removed',
  'device_offline', 'device_online',
  'bluetooth_access', 'device_renamed', 'read_rates_changed'));

alter table waytara.equipment_metrics add column if not exists map_cadence_seconds int;
update waytara.equipment_metrics set map_cadence_seconds = cadence_seconds where map_cadence_seconds is null;

create or replace function waytara._metric_map_cadence() returns trigger language plpgsql as $$
begin
  if new.map_cadence_seconds is null then
    new.map_cadence_seconds := new.cadence_seconds;
  end if;
  return new;
end;
$$;

drop trigger if exists equipment_metrics_map_cadence on waytara.equipment_metrics;
create trigger equipment_metrics_map_cadence before insert on waytara.equipment_metrics
  for each row execute function waytara._metric_map_cadence();

create or replace function waytara.gw_list_cadences(p_actor uuid, p_equipment uuid)
returns jsonb
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
  return jsonb_build_object(
    'allowed', jsonb_build_array(10, 15, 30, 60, 120, 300, 600, 900),
    'default', 30,
    'metrics', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', m.key_name,
               'label', coalesce(t.display_name, m.key_name),
               'unit', t.unit,
               'category', m.category,
               'registers', coalesce(m.address -> 'registers', '[]'::jsonb),
               'map_s', coalesce(m.map_cadence_seconds, 30),
               'seconds', coalesce(m.cadence_seconds, 30),
               'custom', coalesce(m.cadence_seconds, 30) <> coalesce(m.map_cadence_seconds, 30)
             ) order by m.category, coalesce(t.display_name, m.key_name))
      from waytara.equipment_metrics m
      left join waytara.equipment_templates t on t.device_category = m.device_category and t.key_name = m.key_name
      where m.equipment_id = p_equipment
        and m.direction = 'read'
        and (m.show_for_user or m.poll_enabled)
        and jsonb_array_length(coalesce(m.address -> 'registers', '[]'::jsonb)) > 0
    ), '[]'::jsonb)
  );
end;
$$;

-- p_changes: [{"key": "...", "seconds": 60}, {"key": "...", "seconds": null}]; null puts back the rate the register map was made with.
create or replace function waytara.gw_set_cadences(p_equipment uuid, p_actor uuid, p_changes jsonb, p_ip inet default null)
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  c jsonb;
  v_key text;
  v_new int;
  v_old int;
  v_map int;
  v_target int;
  v_list jsonb := '[]'::jsonb;
  v_n int := 0;
begin
  perform waytara._require_gateway_service();
  if not waytara.gw_actor_can_manage_keys(p_actor, p_equipment) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'the changes must be a list' using errcode = '22023';
  end if;

  for c in select * from jsonb_array_elements(p_changes) loop
    v_key := c ->> 'key';
    v_new := case when jsonb_typeof(c -> 'seconds') = 'number' then (c ->> 'seconds')::int end;
    if v_new is not null and v_new not in (10, 15, 30, 60, 120, 300, 600, 900) then
      raise exception 'a read rate must be 10, 15, 30, 60, 120, 300, 600 or 900 seconds' using errcode = '22023';
    end if;
    select m.cadence_seconds, m.map_cadence_seconds into v_old, v_map
      from waytara.equipment_metrics m
     where m.equipment_id = p_equipment and m.key_name = v_key and m.direction = 'read';
    if not found then
      raise exception 'unknown value %', v_key using errcode = '22023';
    end if;
    v_target := coalesce(v_new, v_map);   -- null: back to the map's rate (null there means the standard 30 s)
    if coalesce(v_target, 30) <> coalesce(v_old, 30) then
      update waytara.equipment_metrics set cadence_seconds = v_target
       where equipment_id = p_equipment and key_name = v_key and direction = 'read';
      v_n := v_n + 1;
      v_list := v_list || jsonb_build_object('key', v_key, 'from_s', coalesce(v_old, 30), 'to_s', coalesce(v_target, 30));
    end if;
  end loop;

  if v_n > 0 then
    perform waytara._record_activity(p_equipment, null, p_actor, 'setup_page', 'read_rates_changed',
      case when v_n = 1 then 'The read rate of 1 value was changed' else 'The read rate of ' || v_n || ' values was changed' end,
      jsonb_build_object('changes', v_list), p_ip);
  end if;
  return jsonb_build_object('changed', v_n);
end;
$$;

revoke all on function waytara.gw_list_cadences(uuid, uuid) from public, anon;
revoke all on function waytara.gw_set_cadences(uuid, uuid, jsonb, inet) from public, anon;
grant execute on function waytara.gw_list_cadences(uuid, uuid) to authenticated, service_role;
grant execute on function waytara.gw_set_cadences(uuid, uuid, jsonb, inet) to authenticated, service_role;

-- To undo: drop function waytara.gw_set_cadences(uuid, uuid, jsonb, inet), waytara.gw_list_cadences(uuid, uuid);
--          drop trigger equipment_metrics_map_cadence on waytara.equipment_metrics; drop function waytara._metric_map_cadence();
--          update waytara.equipment_metrics set cadence_seconds = map_cadence_seconds; alter table waytara.equipment_metrics drop column map_cadence_seconds;
