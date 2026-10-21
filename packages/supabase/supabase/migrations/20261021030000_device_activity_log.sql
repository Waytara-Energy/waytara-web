-- Who did what, and when, to a monitoring unit and its site (task T9 of docs/GATEWAY_V3_TASKS.md).
--
-- One table, waytara.device_activity, that the setup page, the dashboards and the admin app read. It is filled two ways:
--   * by triggers on the tables that already record these things (key events, site access, offline alerts, setting changes), so no
--     existing writer changes and nothing can forget to log;
--   * by waytara.log_device_activity() for what only the setup page knows (Wi-Fi edits made over Bluetooth, restarts, the push interval).
-- A row never stops the action that caused it: every trigger swallows its own errors.
--
-- Who sees it (row level security on site_id, the same rule as the site's readings): the customer who owns the site, the staff assigned to it
-- (an assignment that has ended no longer shows it), and admins. The view hides the technical detail and the address from customers.

create table if not exists waytara.device_activity (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  equipment_id uuid references waytara.equipment(id) on delete cascade,
  site_id      uuid references waytara.sites(id) on delete cascade,
  actor_id     uuid references waytara.profiles(id) on delete set null,
  -- a copy of the person's name and role at the time, so the history still reads after an account is deleted
  actor_name   text,
  actor_role   text,
  source       text not null check (source in ('setup_page', 'bluetooth', 'dashboard', 'admin', 'hub', 'board', 'system')),
  action       text not null check (action in (
                 'unit_claimed', 'key_rotated', 'key_revoked', 'unit_released',
                 'wifi_changed', 'wifi_removed', 'unit_restarted', 'push_interval_changed',
                 'setting_requested', 'setting_confirmed', 'setting_failed',
                 'access_granted', 'access_removed',
                 'device_offline', 'device_online')),
  summary      text not null check (char_length(summary) between 1 and 300),
  details      jsonb not null default '{}'::jsonb,
  ip           inet,
  check (equipment_id is not null or site_id is not null)
);

comment on table waytara.device_activity is 'Who did what to a unit or a site, and when. Filled by triggers and by log_device_activity(); read through the device_activity_log view.';
comment on column waytara.device_activity.summary is 'One plain sentence for everybody who may see the row (never a secret).';
comment on column waytara.device_activity.details is 'Technical detail (key ids, old and new values): shown to staff and admins only.';

create index if not exists device_activity_equipment_idx on waytara.device_activity (equipment_id, at desc);
create index if not exists device_activity_site_idx on waytara.device_activity (site_id, at desc);

alter table waytara.device_activity enable row level security;
revoke all on waytara.device_activity from public, anon, authenticated;
grant select on waytara.device_activity to authenticated;
grant all on waytara.device_activity to service_role;
grant usage on sequence waytara.device_activity_id_seq to service_role;

drop policy if exists device_activity_select on waytara.device_activity;
create policy device_activity_select on waytara.device_activity
  for select to authenticated
  using (site_id is not null and waytara.can_access_site(site_id));

-- What the apps read: customers do not get the technical detail or the address.
create or replace view waytara.device_activity_log
with (security_invoker = true) as
select a.id, a.at, a.equipment_id, a.site_id, a.actor_id, a.actor_name, a.actor_role, a.source, a.action, a.summary,
       case when waytara.is_staff() then a.details end as details,
       case when waytara.is_staff() then a.ip end as ip
  from waytara.device_activity a;

grant select on waytara.device_activity_log to authenticated, service_role;

-- ---- one place that writes a row ---------------------------------------------------------------------------------------------

create or replace function waytara._record_activity(
  p_equipment uuid, p_site uuid, p_actor uuid, p_source text, p_action text, p_summary text, p_details jsonb default '{}'::jsonb, p_ip inet default null
) returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_site uuid := p_site;
  v_name text;
  v_role text;
begin
  if v_site is null and p_equipment is not null then
    select site_id into v_site from waytara.equipment where id = p_equipment;
  end if;
  if p_actor is not null then
    select full_name, role::text into v_name, v_role from waytara.profiles where id = p_actor;
  end if;
  insert into waytara.device_activity (equipment_id, site_id, actor_id, actor_name, actor_role, source, action, summary, details, ip)
  values (p_equipment, v_site, p_actor, v_name, v_role, p_source, p_action, left(p_summary, 300), coalesce(p_details, '{}'::jsonb), p_ip);
end;
$$;

revoke all on function waytara._record_activity(uuid, uuid, uuid, text, text, text, jsonb, inet) from public, anon, authenticated;

-- ---- what the setup page may log itself (Bluetooth edits the hub never sees) --------------------------------------------------

create or replace function waytara.log_device_activity(p_equipment uuid, p_action text, p_summary text, p_details jsonb default '{}'::jsonb, p_via text default 'setup_page')
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_site uuid;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  if p_action not in ('wifi_changed', 'wifi_removed', 'unit_restarted', 'push_interval_changed') then
    raise exception 'this action cannot be logged from the setup page' using errcode = '22023';
  end if;
  if p_via not in ('setup_page', 'bluetooth') then
    raise exception 'unknown source' using errcode = '22023';
  end if;
  select site_id into v_site from waytara.equipment where id = p_equipment;
  if v_site is null or not waytara.can_access_site(v_site) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- the Wi-Fi password or any secret must never be in what is stored: refuse the obvious
  if p_details::text ~* '(pass(word)?|secret|key)"\s*:' then
    raise exception 'secrets are not logged' using errcode = '22023';
  end if;
  select role::text into v_role from waytara.profiles where id = auth.uid();
  -- a customer may change the Wi-Fi and restart their unit; the push interval is for staff
  if p_action = 'push_interval_changed' and coalesce(v_role, '') not in ('admin', 'employee', 'site_engineer') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform waytara._record_activity(p_equipment, v_site, auth.uid(), p_via, p_action, p_summary, p_details, null);
end;
$$;

revoke all on function waytara.log_device_activity(uuid, text, text, jsonb, text) from public, anon;
grant execute on function waytara.log_device_activity(uuid, text, text, jsonb, text) to authenticated;

-- ---- triggers on the tables that already know ------------------------------------------------------------------------------------

-- key events: claimed, rotated, revoked (a release is a revoke with the reason "released")
create or replace function waytara._activity_from_key_event()
returns trigger
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  begin
    if new.event = 'claimed' then
      perform waytara._record_activity(new.equipment_id, null, new.actor, 'setup_page', 'unit_claimed', 'The monitoring unit was set up and received its key', jsonb_build_object('key_id', new.key_id), new.ip);
    elsif new.event = 'rotated' then
      perform waytara._record_activity(new.equipment_id, null, new.actor, 'admin', 'key_rotated', 'The unit''s key was replaced', jsonb_build_object('key_id', new.key_id), new.ip);
    elsif new.event = 'revoked' and coalesce(new.detail ->> 'reason', '') = 'released' then
      perform waytara._record_activity(new.equipment_id, null, new.actor, 'admin', 'unit_released', 'The monitoring unit was released from this device', jsonb_build_object('key_id', new.key_id), new.ip);
    elsif new.event = 'revoked' then
      perform waytara._record_activity(new.equipment_id, null, new.actor, 'admin', 'key_revoked', 'The unit''s key was cut off', jsonb_build_object('key_id', new.key_id, 'reason', new.detail ->> 'reason'), new.ip);
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists device_activity_key_events on waytara.equipment_key_events;
create trigger device_activity_key_events after insert on waytara.equipment_key_events
  for each row execute function waytara._activity_from_key_event();

-- site access: granted and removed
create or replace function waytara._activity_from_site_staff()
returns trigger
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_who text;
begin
  begin
    select coalesce(full_name, email, 'a staff member') into v_who from waytara.profiles where id = new.staff_id;
    if tg_op = 'INSERT' then
      perform waytara._record_activity(null, new.site_id, new.granted_by, 'admin', 'access_granted',
        v_who || ' was given access to this site' || case when new.expires_at is not null then ' until ' || to_char(new.expires_at at time zone 'Asia/Kolkata', 'FMDD Mon YYYY') else '' end,
        jsonb_build_object('staff_id', new.staff_id, 'expires_at', new.expires_at), null);
    elsif new.removed_at is not null and old.removed_at is null then
      perform waytara._record_activity(null, new.site_id, null, 'admin', 'access_removed', v_who || '''s access to this site was removed', jsonb_build_object('staff_id', new.staff_id), null);
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists device_activity_site_staff on waytara.site_staff;
create trigger device_activity_site_staff after insert or update on waytara.site_staff
  for each row execute function waytara._activity_from_site_staff();

-- offline alerts opening and closing (opened and closed by fleet_tick)
create or replace function waytara._activity_from_alert()
returns trigger
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_label text;
begin
  begin
    if new.message like 'Device offline%' then
      select coalesce(label, 'The device') into v_label from waytara.equipment where id = new.device_id;
      if tg_op = 'INSERT' then
        perform waytara._record_activity(new.device_id, null, null, 'system', 'device_offline', v_label || ' stopped reporting', jsonb_build_object('alert_id', new.id, 'since', new.offline_since), null);
      elsif new.resolved_at is not null and old.resolved_at is null then
        perform waytara._record_activity(new.device_id, null, null, 'system', 'device_online', v_label || ' is reporting again', jsonb_build_object('alert_id', new.id), null);
      end if;
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists device_activity_alerts on waytara.alerts;
create trigger device_activity_alerts after insert or update on waytara.alerts
  for each row execute function waytara._activity_from_alert();

-- settings: what a person asked for, and what the inverter answered
create or replace function waytara._activity_from_config()
returns trigger
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_name text;
begin
  begin
    select t.display_name into v_name from waytara.equipment_templates t where t.key_name = new.key_name limit 1;
    v_name := coalesce(v_name, new.key_name);
    if new.source = 'agent_write_ok' then
      perform waytara._record_activity(new.equipment_id, null, new.written_by, 'board', 'setting_confirmed', 'The inverter confirmed: ' || v_name || ' is now ' || new.setting_value, jsonb_build_object('key', new.key_name, 'value', new.setting_value, 'previous', new.previous_value), null);
    elsif new.source = 'agent_write_failed' then
      perform waytara._record_activity(new.equipment_id, null, new.written_by, 'board', 'setting_failed', 'The inverter did not take the change to ' || v_name, jsonb_build_object('key', new.key_name, 'value', new.setting_value, 'asked', new.previous_value, 'why', new.notes), null);
    elsif coalesce(new.source, '') not like 'agent\_%' and coalesce(new.source, '') <> 'modbus_initial_read' then
      perform waytara._record_activity(new.equipment_id, null, new.written_by,
        case when new.source = 'customer_dashboard' then 'dashboard' else 'admin' end, 'setting_requested',
        'A change was requested: ' || v_name || ' to ' || new.setting_value, jsonb_build_object('key', new.key_name, 'value', new.setting_value, 'source', new.source), null);
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists device_activity_configs on waytara.equipment_configs;
create trigger device_activity_configs after insert on waytara.equipment_configs
  for each row execute function waytara._activity_from_config();

-- To undo: drop the four triggers above, then drop view waytara.device_activity_log, functions waytara.log_device_activity and
--   waytara._record_activity (and the _activity_from_* functions), then table waytara.device_activity.
