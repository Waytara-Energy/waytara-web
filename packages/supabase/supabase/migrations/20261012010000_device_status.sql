-- One server-side verdict on whether a device is working, from the device's own check-ins.
--
-- The server cannot probe a device (it sits behind the customer's router), so the device checks in and says how it is doing;
-- the server only judges the silence. The status depends on exactly two things: when the last check-in arrived (stamped with
-- the SERVER's clock, never the device's or the browser's) and what the device said about its own link to the inverter.
--
--   online              the unit checked in recently and its link to the inverter works
--   device_unreachable  the unit checks in, but the inverter has not answered 3 check-ins in a row (device_error says why:
--                       TCP refused / timeout, Modbus timeout, RS485 silent, inverter asleep ...)
--   offline             no check-in for 3 heartbeat intervals (at least 30 s): the unit lost power, Wi-Fi or internet
--   never_seen          no check-in yet
--
-- The check-in is the existing ingest call (ingest_tick / ingest_device_tick) with an empty p_values; a device sends it every
-- heartbeat_s seconds (10 for the ESP):
--   p_agent {"heartbeat_s": 10, "device_online": bool, "device_error": text, "last_read_at": timestamptz, "version": text}
--
-- The status is kept up to date by triggers on equipment_heartbeat: a check-in sets it straight away, so a device is back
-- "online" the moment it reports; a job every 10 seconds applies the other direction (silence). Every change is broadcast on the
-- device's live channel so dashboards update without asking.

alter table waytara.equipment_heartbeat
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists status text,
  add column if not exists status_since timestamptz,
  add column if not exists status_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'equipment_heartbeat_status_check') then
    alter table waytara.equipment_heartbeat
      add constraint equipment_heartbeat_status_check check (status in ('online', 'device_unreachable', 'offline', 'never_seen'));
  end if;
end $$;

comment on column waytara.equipment_heartbeat.consecutive_failures is 'Check-ins in a row where the device did not answer the unit (device_online = false); 0 once it answers.';
comment on column waytara.equipment_heartbeat.status is 'The server verdict: online, device_unreachable, offline or never_seen. Kept by triggers and the device-status job.';
comment on column waytara.equipment_heartbeat.status_since is 'When the status last changed (server clock).';
comment on column waytara.equipment_heartbeat.status_reason is 'Why the status is not online, in short.';

-- How long silence is tolerated: 3 check-in intervals, never less than 30 seconds.
create or replace function waytara.offline_after_s(p_heartbeat_s integer, p_interval_s integer)
returns integer
language sql
immutable
as $$
  select greatest(30, 3 * coalesce(p_heartbeat_s, p_interval_s, 60))
$$;

create or replace function waytara.device_status_of(
  p_last_seen     timestamptz,
  p_device_online boolean,
  p_failures      integer,
  p_heartbeat_s   integer,
  p_interval_s    integer,
  p_now           timestamptz default now()
)
returns text
language sql
stable
as $$
  select case
    when p_last_seen is null then 'never_seen'
    when extract(epoch from (p_now - p_last_seen)) > waytara.offline_after_s(p_heartbeat_s, p_interval_s) then 'offline'
    when p_device_online is false and coalesce(p_failures, 0) >= 3 then 'device_unreachable'
    else 'online'
  end
$$;

-- BEFORE every insert/update of a heartbeat row: count the failures and set the verdict.
create or replace function waytara.equipment_heartbeat_status_trg()
returns trigger
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_status text;
begin
  if tg_op = 'INSERT' then
    new.consecutive_failures := case when new.device_online is false then 1 else 0 end;
  elsif new.last_seen is distinct from old.last_seen then
    -- a new check-in: one more failure in a row, or back to none
    new.consecutive_failures := case when new.device_online is false then coalesce(old.consecutive_failures, 0) + 1 else 0 end;
  end if;

  v_status := waytara.device_status_of(new.last_seen, new.device_online, new.consecutive_failures, new.heartbeat_s, new.upload_interval_s, now());
  if tg_op = 'INSERT' or v_status is distinct from old.status then
    new.status := v_status;
    new.status_since := now();
  end if;
  new.status_reason := case v_status
    when 'offline' then 'The monitoring unit has stopped checking in'
    when 'device_unreachable' then coalesce(nullif(new.device_error, ''), 'The device is not answering')
    else null
  end;
  return new;
end;
$$;

-- AFTER a change of status: tell the dashboards on the device's live channel. Never fails the write.
create or replace function waytara.equipment_heartbeat_status_notify()
returns trigger
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    begin
      perform realtime.send(
        jsonb_build_object(
          'ts', now(), 'values', '{}'::jsonb, 'open', '{}'::jsonb,
          'agent', jsonb_build_object(
            'device_online', new.device_online, 'last_read_at', new.last_read_at,
            'status', new.status, 'status_reason', new.status_reason, 'status_since', new.status_since,
            'last_seen', new.last_seen, 'offline_after_s', waytara.offline_after_s(new.heartbeat_s, new.upload_interval_s),
            'server_now', now())
        ),
        'tick', 'device:' || new.equipment_id::text, true);
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;

drop trigger if exists equipment_heartbeat_status_biu on waytara.equipment_heartbeat;
create trigger equipment_heartbeat_status_biu
  before insert or update on waytara.equipment_heartbeat
  for each row execute function waytara.equipment_heartbeat_status_trg();

drop trigger if exists equipment_heartbeat_status_aiu on waytara.equipment_heartbeat;
create trigger equipment_heartbeat_status_aiu
  after insert or update on waytara.equipment_heartbeat
  for each row execute function waytara.equipment_heartbeat_status_notify();

-- The silent direction: every 10 seconds, touch the rows whose verdict has changed with no check-in to cause it (the trigger
-- then sets and broadcasts it).
create or replace function waytara.refresh_device_status()
returns integer
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  n integer;
begin
  update equipment_heartbeat h
     set status_reason = h.status_reason
   where waytara.device_status_of(h.last_seen, h.device_online, h.consecutive_failures, h.heartbeat_s, h.upload_interval_s, now())
         is distinct from h.status;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function waytara.refresh_device_status() from public, anon, authenticated;
grant execute on function waytara.refresh_device_status() to service_role;

-- What the dashboards read: the stored verdict is re-derived on every read, so it is right even between job runs. age_s and
-- server_now let a browser judge ages by the server's clock, not its own.
create or replace view waytara.equipment_status
with (security_invoker = true) as
select
  h.equipment_id,
  waytara.device_status_of(h.last_seen, h.device_online, h.consecutive_failures, h.heartbeat_s, h.upload_interval_s, now()) as status,
  h.status_reason,
  h.status_since,
  h.last_seen,
  h.last_read_at,
  h.device_online,
  h.device_error,
  h.heartbeat_s,
  h.upload_interval_s,
  waytara.offline_after_s(h.heartbeat_s, h.upload_interval_s) as offline_after_s,
  now() as server_now
from waytara.equipment_heartbeat h;

grant select on waytara.equipment_status to authenticated, service_role;

comment on view waytara.equipment_status is 'The verdict on each device (online / device_unreachable / offline / never_seen), derived from its check-ins by the server clock.';

-- Give every existing row its verdict.
update waytara.equipment_heartbeat set status_reason = status_reason;

-- Run the job every 10 seconds (pg_cron 1.5+ accepts a seconds interval).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'device-status';
    perform cron.schedule('device-status', '10 seconds', $job$select waytara.refresh_device_status()$job$);
  end if;
end $$;
