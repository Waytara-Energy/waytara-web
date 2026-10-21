-- Changing a unit's key without locking it out (task T11a of docs/GATEWAY_V3_TASKS.md).
--
-- Until now a unit's key could only be replaced in a way that cut the unit off: the new key reaches the unit only through Bluetooth setup. A
-- rotation keeps BOTH keys valid side by side while the hub delivers the new one over the unit's working connection (sealed with the old
-- key), and cuts the old key only once the unit has logged in with the new one. If it does not finish in time, the database cancels it:
-- the new key is cut and the old one simply stays. Nothing is ever left with no working key.
--
--   key_rotations   one row per attempt: sent (new key made, being delivered), staged (the unit has it aside), done, cancelled.
--                   At most one open rotation per unit.
--   gw_begin_rotation / gw_rotation_staged / gw_complete_rotation / gw_cancel_rotation / gw_rotation_for_login   the hub's steps.
--   _expire_rotations()   cancels an open rotation that is past its time; run from fleet_tick every 10 seconds.
-- Only the registered backend identity calls the gw_ functions; the backend decides WHO may rotate (the people who may manage the unit's keys).

create table if not exists waytara.key_rotations (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references waytara.equipment(id) on delete cascade,
  old_key_id    uuid not null references waytara.equipment_keys(id) on delete cascade,
  new_key_id    uuid not null references waytara.equipment_keys(id) on delete cascade,
  state         text not null default 'sent' check (state in ('sent', 'staged', 'done', 'cancelled')),
  started_by    uuid references waytara.profiles(id) on delete set null,
  started_at    timestamptz not null default now(),
  staged_at     timestamptz,
  finished_at   timestamptz,
  -- an open rotation is cancelled once this has passed
  expires_at    timestamptz not null,
  reason        text,
  check (old_key_id <> new_key_id)
);

comment on table waytara.key_rotations is 'Replacing a unit''s key without cutting it off: both keys work until the unit has logged in with the new one. See migration 20261021050000.';

create unique index if not exists key_rotations_one_open_idx on waytara.key_rotations (equipment_id) where state in ('sent', 'staged');
create index if not exists key_rotations_new_key_idx on waytara.key_rotations (new_key_id);

alter table waytara.key_rotations enable row level security;
revoke all on waytara.key_rotations from public, anon, authenticated;
grant select on waytara.key_rotations to authenticated;
grant all on waytara.key_rotations to service_role;

drop policy if exists key_rotations_admin_select on waytara.key_rotations;
create policy key_rotations_admin_select on waytara.key_rotations for select to authenticated using ((select waytara.is_admin()));
drop policy if exists key_rotations_staff_select on waytara.key_rotations;
create policy key_rotations_staff_select on waytara.key_rotations for select to authenticated using (equipment_id in (select waytara.my_assigned_equipment_ids()));

-- the activity log gets one more kind of line: a rotation that did not finish
do $$
begin
  alter table waytara.device_activity drop constraint if exists device_activity_action_check;
  alter table waytara.device_activity add constraint device_activity_action_check check (action in (
    'unit_claimed', 'key_rotated', 'key_rotation_failed', 'key_revoked', 'unit_released',
    'wifi_changed', 'wifi_removed', 'unit_restarted', 'push_interval_changed',
    'setting_requested', 'setting_confirmed', 'setting_failed',
    'access_granted', 'access_removed', 'device_offline', 'device_online'));
end $$;

-- ---- begin: make the new key, keep the old one working ------------------------------------------------------------------------------

create or replace function waytara.gw_begin_rotation(
  p_old uuid, p_ciphertext bytea, p_fingerprint text, p_actor uuid, p_ip inet default null, p_window_seconds integer default 600
) returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_old waytara.equipment_keys%rowtype;
  v_new uuid;
  v_rot uuid;
  v_expires timestamptz;
begin
  perform waytara._require_gateway_service();
  if p_window_seconds < 60 or p_window_seconds > 3600 then
    raise exception 'The rotation window must be between 60 and 3600 seconds' using errcode = '22023';
  end if;
  if p_ciphertext is null or octet_length(p_ciphertext) < 28 then
    raise exception 'The encrypted key is too short' using errcode = '22023';
  end if;
  select * into v_old from waytara.equipment_keys
   where id = p_old and revoked_at is null and kind = 'gateway' and (expires_at is null or expires_at > now()) for update;
  if not found then
    raise exception 'No such active unit key' using errcode = 'P0002';
  end if;
  if exists (select 1 from waytara.key_rotations r where r.equipment_id = v_old.equipment_id and r.state in ('sent', 'staged')) then
    raise exception 'A rotation is already in progress for this unit' using errcode = '23505';
  end if;

  insert into waytara.equipment_keys (equipment_id, kind, label, key_ciphertext, key_fingerprint, created_by)
  values (v_old.equipment_id, 'gateway', v_old.label, p_ciphertext, p_fingerprint, p_actor)
  returning id into v_new;

  v_expires := now() + make_interval(secs => p_window_seconds);
  insert into waytara.key_rotations (equipment_id, old_key_id, new_key_id, started_by, expires_at)
  values (v_old.equipment_id, p_old, v_new, p_actor, v_expires)
  returning id into v_rot;

  return jsonb_build_object('rotation_id', v_rot, 'new_key_id', v_new, 'equipment_id', v_old.equipment_id, 'expires_at', v_expires);
end;
$$;

-- ---- the unit has the new key aside ---------------------------------------------------------------------------------------------------

create or replace function waytara.gw_rotation_staged(p_rotation uuid)
returns boolean
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  n integer;
begin
  perform waytara._require_gateway_service();
  update waytara.key_rotations set state = 'staged', staged_at = now() where id = p_rotation and state = 'sent' and expires_at > now();
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- ---- done: the unit logged in with the new key; the old one is cut ------------------------------------------------------------------

create or replace function waytara.gw_complete_rotation(p_rotation uuid, p_ip inet default null)
returns boolean
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  r waytara.key_rotations%rowtype;
begin
  perform waytara._require_gateway_service();
  select * into r from waytara.key_rotations where id = p_rotation and state in ('sent', 'staged') for update;
  if not found then
    return false;
  end if;
  update waytara.equipment_keys set revoked_at = now(), revoked_by = r.started_by, revoke_reason = 'rotated' where id = r.old_key_id and revoked_at is null;
  update waytara.key_rotations set state = 'done', finished_at = now() where id = r.id;
  insert into waytara.equipment_key_events (equipment_id, key_id, event, actor, ip, detail)
  values (r.equipment_id, r.new_key_id, 'rotated', r.started_by, p_ip, jsonb_build_object('replaces', r.old_key_id, 'remote', true));
  return true;
end;
$$;

-- ---- cancelled: the new key is cut, the old one stays ---------------------------------------------------------------------------------

create or replace function waytara._cancel_rotation(p_rotation uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  r waytara.key_rotations%rowtype;
begin
  select * into r from waytara.key_rotations where id = p_rotation and state in ('sent', 'staged') for update;
  if not found then
    return false;
  end if;
  update waytara.equipment_keys set revoked_at = now(), revoked_by = r.started_by, revoke_reason = 'rotation_cancelled' where id = r.new_key_id and revoked_at is null;
  update waytara.key_rotations set state = 'cancelled', finished_at = now(), reason = left(p_reason, 200) where id = r.id;
  perform waytara._record_activity(r.equipment_id, null, r.started_by, 'hub', 'key_rotation_failed',
    'Replacing the unit''s key did not finish, so the old key stays in use', jsonb_build_object('rotation', r.id, 'why', p_reason), null);
  return true;
end;
$$;

create or replace function waytara.gw_cancel_rotation(p_rotation uuid, p_reason text default 'cancelled')
returns boolean
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return waytara._cancel_rotation(p_rotation, p_reason);
end;
$$;

-- an open rotation past its time is cancelled (called every 10 seconds by fleet_tick)
create or replace function waytara._expire_rotations(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  r record;
  n integer := 0;
begin
  for r in select id from waytara.key_rotations where state in ('sent', 'staged') and expires_at <= p_now loop
    if waytara._cancel_rotation(r.id, 'the unit did not finish in time') then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- ---- which rotation does a login with this key belong to? ------------------------------------------------------------------------------

create or replace function waytara.gw_rotation_for_login(p_key uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
declare
  v uuid;
begin
  perform waytara._require_gateway_service();
  select id into v from waytara.key_rotations where new_key_id = p_key and state in ('sent', 'staged');
  return v;
end;
$$;

revoke all on function waytara.gw_begin_rotation(uuid, bytea, text, uuid, inet, integer) from public, anon;
revoke all on function waytara.gw_rotation_staged(uuid) from public, anon;
revoke all on function waytara.gw_complete_rotation(uuid, inet) from public, anon;
revoke all on function waytara.gw_cancel_rotation(uuid, text) from public, anon;
revoke all on function waytara.gw_rotation_for_login(uuid) from public, anon;
revoke all on function waytara._cancel_rotation(uuid, text) from public, anon, authenticated;
revoke all on function waytara._expire_rotations(timestamptz) from public, anon, authenticated;
grant execute on function waytara.gw_begin_rotation(uuid, bytea, text, uuid, inet, integer) to authenticated, service_role;
grant execute on function waytara.gw_rotation_staged(uuid) to authenticated, service_role;
grant execute on function waytara.gw_complete_rotation(uuid, inet) to authenticated, service_role;
grant execute on function waytara.gw_cancel_rotation(uuid, text) to authenticated, service_role;
grant execute on function waytara.gw_rotation_for_login(uuid) to authenticated, service_role;

-- ---- fleet_tick also expires stale rotations (the same function as before, plus one line) --------------------------------------------

create or replace function waytara.fleet_tick(p_now timestamptz default now(), p_io boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  h        waytara.hub_health%rowtype;
  v_alerts jsonb;
  v_hub    integer;
  v_kicked boolean := false;
  v_settled boolean;
  v_rot    integer;
begin
  perform waytara.refresh_device_status();
  perform waytara._fleet_hub_step(p_now, p_io);
  v_hub := waytara._fleet_hub_events(p_now);
  v_rot := waytara._expire_rotations(p_now);

  select * into h from waytara.hub_health where id;
  -- "settled": up, and past its first 2 minutes (the uptime comes from its own answer)
  v_settled := h.hub_up and coalesce(h.hub_uptime_s, 0) >= 120;
  v_alerts := waytara._fleet_alert_step(p_now, v_settled);

  if p_io and waytara._fleet_has_due_mail(p_now) and (h.last_mailer_call_at is null or p_now - h.last_mailer_call_at >= interval '30 seconds') then
    perform waytara.invoke_cron_route('/api/cron/send-device-notifications');
    update waytara.hub_health set last_mailer_call_at = p_now where id;
    v_kicked := true;
  end if;

  return jsonb_build_object('hub_up', h.hub_up, 'hub_settled', v_settled, 'hub_messages', v_hub, 'alerts', v_alerts, 'rotations_cancelled', v_rot, 'mailer_called', v_kicked);
end;
$$;

revoke all on function waytara.fleet_tick(timestamptz, boolean) from public, anon, authenticated;
grant execute on function waytara.fleet_tick(timestamptz, boolean) to service_role;

-- To undo: restore fleet_tick from migration 20261021020000, then
--   drop function waytara._expire_rotations(timestamptz), waytara._cancel_rotation(uuid, text), waytara.gw_rotation_for_login(uuid),
--   waytara.gw_cancel_rotation(uuid, text), waytara.gw_complete_rotation(uuid, inet), waytara.gw_rotation_staged(uuid),
--   waytara.gw_begin_rotation(uuid, bytea, text, uuid, inet, integer); drop table waytara.key_rotations;
