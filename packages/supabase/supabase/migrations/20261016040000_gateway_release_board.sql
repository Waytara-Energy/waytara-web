-- Task A10 (part): release a monitoring unit from the device it is linked to, so it can be set up for another device.
--
-- A unit can belong to one device at a time (gw_claim_device refuses a second one with "already assigned to other equipment"). Until now
-- the only way to move it was by hand in the database. gw_release_board is that, done properly and recorded:
--   * the link between the unit and the device is removed (gateway_devices)
--   * the device's active gateway keys are revoked (the unit is cut off at once and needs a new setup to come back)
--   * claim tickets for the device that were not used yet are voided
--   * who did it, when and which unit is written to equipment_key_events
-- The backend decides WHO may ask (the same people who may make or revoke the device's keys); only the registered backend identity may call
-- this function. Nothing is deleted from the readings: the history stays with the device. Rollback is at the bottom.

create or replace function waytara.gw_release_board(p_equipment uuid, p_actor uuid, p_ip inet default null)
returns boolean
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_hw text;
  v_revoked integer;
begin
  perform waytara._require_gateway_service();
  select d.hardware_id into v_hw from waytara.gateway_devices d where d.equipment_id = p_equipment;
  if v_hw is null then
    return false; -- no unit is linked: nothing to release
  end if;

  with revoked as (
    update waytara.equipment_keys k
       set revoked_at = now(), revoked_by = p_actor, revoke_reason = 'released'
     where k.equipment_id = p_equipment and k.kind = 'gateway' and k.revoked_at is null
    returning k.id
  ), logged as (
    insert into waytara.equipment_key_events (equipment_id, key_id, event, actor, ip, detail)
    select p_equipment, r.id, 'revoked', p_actor, p_ip, jsonb_build_object('reason', 'released', 'hardware_id', v_hw) from revoked r
    returning 1
  )
  select count(*)::integer into v_revoked from revoked;

  if v_revoked = 0 then
    -- no active key (it was revoked before): still record the release
    insert into waytara.equipment_key_events (equipment_id, event, actor, ip, detail)
    values (p_equipment, 'revoked', p_actor, p_ip, jsonb_build_object('reason', 'released', 'hardware_id', v_hw));
  end if;

  update waytara.equipment_claim_tickets set used_at = now() where equipment_id = p_equipment and used_at is null;
  delete from waytara.gateway_devices where equipment_id = p_equipment;
  return true;
end;
$$;

revoke all on function waytara.gw_release_board(uuid, uuid, inet) from public, anon;
grant execute on function waytara.gw_release_board(uuid, uuid, inet) to authenticated, service_role;

-- Rollback:
--   drop function if exists waytara.gw_release_board(uuid, uuid, inet);
