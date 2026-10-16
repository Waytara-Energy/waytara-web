-- Task A10 (Go Live): what the backend needs to feed the dashboard's live channel.
--
-- The dashboard viewer (components/dashboard/go-live.tsx) already works like this, and none of it changes:
--   it calls request_live(equipment) now and then while the page is open (keeps "someone is watching until ..." in equipment_live_requests)
--   and listens on the private Realtime channel live:<equipment id> for one "tick" {t: epoch ms, v: {key: value}} per reading.
-- The old agent published the ticks itself. Now the backend does it, from the readings the board sends in live mode:
--
--   gw_live_active   is someone watching this equipment right now? (the backend asks every few seconds and tells the board to stream)
--   gw_live_tick     one tick for the viewers: refused with "not live" when nobody is watching, so a stale stream stops by itself
--
-- Only the registered backend identity (waytara.gateway_service_users) may call them. Nothing is stored. Rollback is at the bottom.

create or replace function waytara.gw_live_active(p_equipment uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return waytara.device_live_active(p_equipment);
end;
$$;

create or replace function waytara.gw_live_tick(p_equipment uuid, p_t bigint, p_v jsonb)
returns boolean
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  if jsonb_typeof(p_v) <> 'object' or (select count(*) from jsonb_object_keys(p_v)) > 150 then
    raise exception 'p_v must be an object of at most 150 readings' using errcode = '22023';
  end if;
  if not waytara.device_live_active(p_equipment) then
    return false;
  end if;
  begin
    perform realtime.send(jsonb_build_object('t', p_t, 'v', p_v), 'tick', 'live:' || p_equipment::text, true);
  exception when others then
    return false;
  end;
  return true;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['gw_live_active(uuid)', 'gw_live_tick(uuid, bigint, jsonb)'] loop
    execute format('revoke all on function waytara.%s from public, anon', f);
    execute format('grant execute on function waytara.%s to authenticated, service_role', f);
  end loop;
end;
$$;

-- Rollback:
--   drop function if exists waytara.gw_live_tick(uuid, bigint, jsonb), waytara.gw_live_active(uuid);
