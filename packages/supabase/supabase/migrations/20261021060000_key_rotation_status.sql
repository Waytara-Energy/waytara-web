-- The open key rotation of a unit, for the hub's status answer (task T11b of docs/GATEWAY_V3_TASKS.md). Backend identity only.

create or replace function waytara.gw_open_rotation(p_equipment uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
declare
  r waytara.key_rotations%rowtype;
begin
  perform waytara._require_gateway_service();
  select * into r from waytara.key_rotations where equipment_id = p_equipment and state in ('sent', 'staged');
  if not found then
    return null;
  end if;
  return jsonb_build_object('rotation_id', r.id, 'state', r.state, 'started_at', r.started_at, 'expires_at', r.expires_at);
end;
$$;

revoke all on function waytara.gw_open_rotation(uuid) from public, anon;
grant execute on function waytara.gw_open_rotation(uuid) to authenticated, service_role;

-- To undo: drop function waytara.gw_open_rotation(uuid);
