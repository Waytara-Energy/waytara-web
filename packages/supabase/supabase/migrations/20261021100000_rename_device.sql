-- Renaming a device from the setup page (the "Device name" page): one function that checks who may, trims and limits the name, changes it and
-- writes it to the activity log. Who may: an admin, staff assigned to the site (an ended assignment does not count), and the customer who owns
-- the site, that is, anybody who can see the site. Nobody else gets an answer.

alter table waytara.device_activity drop constraint if exists device_activity_action_check;
alter table waytara.device_activity add constraint device_activity_action_check check (action in (
  'unit_claimed', 'key_rotated', 'key_rotation_failed', 'key_revoked', 'unit_released',
  'wifi_changed', 'wifi_removed', 'unit_restarted', 'push_interval_changed',
  'setting_requested', 'setting_confirmed', 'setting_failed',
  'access_granted', 'access_removed',
  'device_offline', 'device_online',
  'bluetooth_access', 'device_renamed'));

create or replace function waytara.rename_device(p_equipment uuid, p_label text)
returns text
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_site uuid;
  v_old text;
  v_new text := btrim(regexp_replace(coalesce(p_label, ''), '\s+', ' ', 'g'));
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  select site_id, label into v_site, v_old from waytara.equipment where id = p_equipment;
  if v_site is null or not waytara.can_access_site(v_site) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if char_length(v_new) < 1 or char_length(v_new) > 60 then
    raise exception 'the name must be 1 to 60 characters' using errcode = '22023';
  end if;
  if v_new is distinct from v_old then
    update waytara.equipment set label = v_new, updated_at = now() where id = p_equipment;
    perform waytara._record_activity(p_equipment, v_site, auth.uid(), 'setup_page', 'device_renamed',
      'The device was renamed' || case when coalesce(btrim(v_old), '') = '' then '' else ' from "' || left(v_old, 60) || '"' end || ' to "' || v_new || '"',
      jsonb_build_object('from', v_old, 'to', v_new));
  end if;
  return v_new;
end;
$$;

revoke all on function waytara.rename_device(uuid, text) from public, anon;
grant execute on function waytara.rename_device(uuid, text) to authenticated;

-- To undo: drop function waytara.rename_device(uuid, text); the extra 'device_renamed' value in the check can stay.
