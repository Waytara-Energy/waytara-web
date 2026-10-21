-- How fast Go Live really is (task T13 of docs/GATEWAY_V3_TASKS.md): the hub notes, for the latest Go Live session of each unit, how long each
-- step took, so "without delays" is a number we can look at and not a feeling. One row per unit, replaced by the next session. No readings are
-- in it. Only the backend identity writes it; staff and admins can read it.
--
--   request_to_command_ms        the viewer pressed Go Live (the database's request) until the hub told the unit to stream
--   command_to_first_frame_ms    until the first reading came back from the unit
--   first_frame_to_tick_ms       until that reading was published to the dashboard's live channel
--   request_to_first_tick_ms     the whole start: button to the first value on the dashboard's channel
--   avg_gap_ms, max_gap_ms       time between published ticks once it runs (the dashboard's refresh rhythm)

create table if not exists waytara.equipment_live_timing (
  equipment_id              uuid primary key references waytara.equipment(id) on delete cascade,
  started_at                timestamptz not null,
  request_to_command_ms     integer,
  command_to_first_frame_ms integer,
  first_frame_to_tick_ms    integer,
  request_to_first_tick_ms  integer,
  ticks                     integer not null default 0,
  avg_gap_ms                integer,
  max_gap_ms                integer,
  updated_at                timestamptz not null default now()
);

comment on table waytara.equipment_live_timing is 'The timing of each unit''s latest Go Live session (written by the hub): how long the start took and how often values were published.';

alter table waytara.equipment_live_timing enable row level security;
revoke all on waytara.equipment_live_timing from public, anon, authenticated;
grant select on waytara.equipment_live_timing to authenticated;
grant all on waytara.equipment_live_timing to service_role;

drop policy if exists equipment_live_timing_admin_select on waytara.equipment_live_timing;
create policy equipment_live_timing_admin_select on waytara.equipment_live_timing for select to authenticated using ((select waytara.is_admin()));
drop policy if exists equipment_live_timing_staff_select on waytara.equipment_live_timing;
create policy equipment_live_timing_staff_select on waytara.equipment_live_timing for select to authenticated using (equipment_id in (select waytara.my_assigned_equipment_ids()));

-- until when somebody is watching (null = nobody): the request time is that minus the 75 seconds request_live adds
create or replace function waytara.gw_live_until(p_equipment uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return (select r.until from waytara.equipment_live_requests r where r.equipment_id = p_equipment and r.until > now());
end;
$$;

create or replace function waytara.gw_record_live_timing(
  p_equipment uuid, p_started_at timestamptz, p_request_to_command_ms integer, p_command_to_first_frame_ms integer, p_first_frame_to_tick_ms integer,
  p_request_to_first_tick_ms integer, p_ticks integer, p_avg_gap_ms integer, p_max_gap_ms integer
) returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  insert into waytara.equipment_live_timing as t (equipment_id, started_at, request_to_command_ms, command_to_first_frame_ms, first_frame_to_tick_ms,
                                                  request_to_first_tick_ms, ticks, avg_gap_ms, max_gap_ms, updated_at)
  values (p_equipment, p_started_at, p_request_to_command_ms, p_command_to_first_frame_ms, p_first_frame_to_tick_ms, p_request_to_first_tick_ms,
          greatest(0, coalesce(p_ticks, 0)), p_avg_gap_ms, p_max_gap_ms, now())
  on conflict (equipment_id) do update set
    started_at = excluded.started_at, request_to_command_ms = excluded.request_to_command_ms, command_to_first_frame_ms = excluded.command_to_first_frame_ms,
    first_frame_to_tick_ms = excluded.first_frame_to_tick_ms, request_to_first_tick_ms = excluded.request_to_first_tick_ms, ticks = excluded.ticks,
    avg_gap_ms = excluded.avg_gap_ms, max_gap_ms = excluded.max_gap_ms, updated_at = now();
end;
$$;

revoke all on function waytara.gw_live_until(uuid) from public, anon;
revoke all on function waytara.gw_record_live_timing(uuid, timestamptz, integer, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function waytara.gw_live_until(uuid) to authenticated, service_role;
grant execute on function waytara.gw_record_live_timing(uuid, timestamptz, integer, integer, integer, integer, integer, integer, integer) to authenticated, service_role;

-- To undo: drop function waytara.gw_record_live_timing(uuid, timestamptz, integer, integer, integer, integer, integer, integer, integer),
--   waytara.gw_live_until(uuid); drop table waytara.equipment_live_timing;
