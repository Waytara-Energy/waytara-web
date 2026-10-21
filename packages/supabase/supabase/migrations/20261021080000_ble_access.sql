-- Who may talk to a unit over Bluetooth, and how far (task T15 of docs/GATEWAY_V3_TASKS.md).
--
-- The backend signs a short-lived "grant" for one person and one unit; the unit checks it offline with its own key. This function is the
-- decision: it says which level that person gets for that unit, and records that the person asked, so the activity log shows who connected.
--
--   admin      -> 'admin'     everything (including the claim and a factory reset)
--   employee / site engineer with access to the unit's site (an ended assignment no longer counts) -> 'service'
--   the customer who owns the site -> 'network'    look, and change the Wi-Fi
--   anybody else -> null (the backend answers "not found")
--
-- Only the registered backend identity may call it. To undo: see the bottom.

alter table waytara.device_activity drop constraint if exists device_activity_action_check;
alter table waytara.device_activity add constraint device_activity_action_check check (action in (
  'unit_claimed', 'key_rotated', 'key_rotation_failed', 'key_revoked', 'unit_released',
  'wifi_changed', 'wifi_removed', 'unit_restarted', 'push_interval_changed',
  'setting_requested', 'setting_confirmed', 'setting_failed',
  'access_granted', 'access_removed',
  'device_offline', 'device_online',
  'bluetooth_access'));

create or replace function waytara.gw_ble_access(p_actor uuid, p_equipment uuid, p_ip inet default null)
returns text
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_site uuid;
  v_role text;
  v_level text;
begin
  perform waytara._require_gateway_service();
  select e.site_id into v_site from waytara.equipment e where e.id = p_equipment;
  if v_site is null or not waytara.can_access_site_as(p_actor, v_site) then
    return null;
  end if;
  select me.role::text into v_role from waytara.profiles me where me.id = p_actor;
  v_level := case
    when v_role = 'admin' then 'admin'
    when v_role in ('employee', 'site_engineer') then 'service'
    when v_role = 'customer' then 'network'
    else null
  end;
  if v_level is null then
    return null;
  end if;
  perform waytara._record_activity(p_equipment, v_site, p_actor, 'bluetooth', 'bluetooth_access',
    'Bluetooth access to the unit was requested', jsonb_build_object('level', v_level), p_ip);
  return v_level;
end;
$$;

revoke all on function waytara.gw_ble_access(uuid, uuid, inet) from public, anon;
grant execute on function waytara.gw_ble_access(uuid, uuid, inet) to authenticated, service_role;

-- To undo: drop function waytara.gw_ble_access(uuid, uuid, inet); the extra 'bluetooth_access' value in the check can stay (delete those rows first
-- if the old constraint has to come back).
