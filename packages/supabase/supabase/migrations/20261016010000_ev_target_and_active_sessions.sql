-- Part B, second step: what the OCPP server needs to (1) stop a charge at a target number of units and (2) pick up the sessions that are
-- still running after a restart of the backend or a reconnect of the charger (and close one whose charger never sent a stop).
--
--   ev_sessions.target_kwh        the energy the customer asked for ("charge 10 units"); the server stops the charge when it is reached
--   gw_ev_session_set_target      sets or clears it
--   gw_ev_active_sessions         the sessions of a charger that have not ended, with what the server needs to carry on
--
-- Callable only by the registered backend identity (the same rule as the other gw_ev_* functions). Rollback is at the end of this file.

alter table waytara.ev_sessions
  add column if not exists target_kwh numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ev_sessions_target_check') then
    alter table waytara.ev_sessions add constraint ev_sessions_target_check check (target_kwh is null or (target_kwh > 0 and target_kwh <= 1000));
  end if;
end $$;

comment on column waytara.ev_sessions.target_kwh is 'The energy asked for at the start (kWh). When the charger''s meter has delivered this much since the start, the server asks the charger to stop.';

create or replace function waytara.gw_ev_session_set_target(p_session uuid, p_target_kwh numeric)
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  if p_target_kwh is not null and (p_target_kwh <= 0 or p_target_kwh > 1000) then
    raise exception 'the target must be above 0 and at most 1000 kWh' using errcode = '22023';
  end if;
  update waytara.ev_sessions set target_kwh = p_target_kwh where id = p_session;
  if not found then
    raise exception 'unknown session' using errcode = 'P0002';
  end if;
end;
$$;

-- the sessions of a charger that are still open, oldest first
create or replace function waytara.gw_ev_active_sessions(p_equipment uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'transaction', s.ocpp_transaction_id, 'connector', s.connector_id,
             'started_at', s.started_at, 'meter_start_wh', s.meter_start_wh, 'target_kwh', s.target_kwh) order by s.started_at)
    from waytara.ev_sessions s
    where s.equipment_id = p_equipment and s.ended_at is null and s.status = 'active' and s.ocpp_transaction_id is not null), '[]'::jsonb);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['gw_ev_session_set_target(uuid, numeric)', 'gw_ev_active_sessions(uuid)'] loop
    execute format('revoke all on function waytara.%s from public, anon', f);
    execute format('grant execute on function waytara.%s to authenticated, service_role', f);
  end loop;
end;
$$;

-- Rollback:
--   drop function if exists waytara.gw_ev_active_sessions(uuid), waytara.gw_ev_session_set_target(uuid, numeric);
--   alter table waytara.ev_sessions drop constraint if exists ev_sessions_target_check;
--   (the target_kwh column is harmless and may stay)
