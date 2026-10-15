-- Gateway foundation (task A1 of docs/GATEWAY_ARCHITECTURE_V2.md): who may see a site, and the keys that identify a board or a charger.
--
--   site_staff                an admin assigns employees / site engineers to a site, several per site, optionally until a date
--   my_assigned_site_ids      the sites the signed-in staff member is assigned to right now (used by the read policies below)
--   can_access_site(_as)      the full answer for the backend: admin, owning customer, assigned staff, or the legacy onboarding employee
--   equipment_keys            one secret per board or charger. The secret itself is stored encrypted by the backend and is NEVER
--                             readable by a browser (column privileges, below). Browsers see only a fingerprint.
--   equipment_key_events      audit trail of key actions and failed attempts
--   gateway_devices           what we know about each board (hardware id, firmware, register map version)
--   register_map_versions     the register map each board was given
--   equipment_claim_tickets   single-use tickets that let a freshly set-up board collect its key
--   gateway_service_users     the one identity the backend signs in as (no service_role key in the backend)
--   gw_*                      functions only that identity may call
--   equipment_metrics.poll_enabled   read this register for diagnostics even though customers do not see it
--
-- Everything is additive: the existing policies (customer owner, legacy onboarding employee, admin) are untouched, and the new read
-- policies only ADD the site_staff route. Rollback is at the bottom of this file.

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 1. Site assignments
-- ---------------------------------------------------------------------------------------------------------------------------------

create table if not exists waytara.site_staff (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references waytara.sites(id) on delete cascade,
  staff_id    uuid not null references waytara.profiles(id) on delete cascade,
  granted_by  uuid references waytara.profiles(id) on delete set null,
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz,
  removed_at  timestamptz,
  removed_by  uuid references waytara.profiles(id) on delete set null,
  note        text,
  constraint site_staff_expiry_after_grant check (expires_at is null or expires_at > granted_at)
);

-- one live assignment per person per site; to give access again, extend expires_at or remove and re-add
create unique index if not exists site_staff_one_live_row on waytara.site_staff (site_id, staff_id) where removed_at is null;
create index if not exists site_staff_staff_idx on waytara.site_staff (staff_id) where removed_at is null;

create or replace function waytara.site_staff_check()
returns trigger
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_role text;
begin
  select role::text into v_role from waytara.profiles where id = new.staff_id;
  if v_role is null or v_role not in ('employee', 'site_engineer') then
    raise exception 'Only an employee or a site engineer can be assigned to a site' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists site_staff_check_trg on waytara.site_staff;
create trigger site_staff_check_trg before insert or update of staff_id on waytara.site_staff
  for each row execute function waytara.site_staff_check();

alter table waytara.site_staff enable row level security;

revoke all on waytara.site_staff from public, anon;
grant select, insert, update, delete on waytara.site_staff to authenticated;
grant all on waytara.site_staff to service_role;

drop policy if exists site_staff_admin_all on waytara.site_staff;
create policy site_staff_admin_all on waytara.site_staff
  for all to authenticated
  using ((select waytara.is_admin()))
  with check ((select waytara.is_admin()));

drop policy if exists site_staff_self_select on waytara.site_staff;
create policy site_staff_self_select on waytara.site_staff
  for select to authenticated
  using (staff_id = (select auth.uid()));

comment on table waytara.site_staff is 'Which employees / site engineers an admin has given access to a site. Live while removed_at is null and expires_at is empty or in the future.';

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 2. Who may see a site
-- ---------------------------------------------------------------------------------------------------------------------------------

-- The full answer for a given person. Used by the backend (through gw_actor_can_access_site) and by can_access_site below. Not callable
-- by browsers: a browser must not be able to ask about somebody else.
create or replace function waytara.can_access_site_as(p_user uuid, p_site uuid)
returns boolean
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select p_user is not null and exists (
    select 1
    from waytara.profiles me
    where me.id = p_user
      and me.deactivated_at is null
      and me.deleted_at is null
      and (
        me.role::text = 'admin'
        or exists (select 1 from waytara.sites s where s.id = p_site and s.customer_id = p_user and s.customer_hidden_at is null)
        or (
          me.role::text in ('employee', 'site_engineer')
          and (
            exists (
              select 1 from waytara.site_staff ss
              where ss.site_id = p_site and ss.staff_id = p_user and ss.removed_at is null and (ss.expires_at is null or ss.expires_at > now())
            )
            or exists (
              select 1
              from waytara.sites s
              join waytara.customer_onboarding co on co.customer_id = s.customer_id
              where s.id = p_site and co.employee_id = p_user
            )
          )
        )
      )
  )
$$;

revoke all on function waytara.can_access_site_as(uuid, uuid) from public, anon, authenticated;
grant execute on function waytara.can_access_site_as(uuid, uuid) to service_role;

create or replace function waytara.can_access_site(p_site uuid)
returns boolean
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select waytara.can_access_site_as((select auth.uid()), p_site)
$$;

revoke all on function waytara.can_access_site(uuid) from public, anon;
grant execute on function waytara.can_access_site(uuid) to authenticated, service_role;

-- For the read policies: the sites this staff member is assigned to right now through site_staff. (Admins, owners and legacy onboarding
-- employees already have their own policies.)
create or replace function waytara.my_assigned_site_ids()
returns setof uuid
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select ss.site_id
  from waytara.site_staff ss
  join waytara.profiles me on me.id = ss.staff_id
  where ss.staff_id = (select auth.uid())
    and ss.removed_at is null
    and (ss.expires_at is null or ss.expires_at > now())
    and me.deactivated_at is null
    and me.deleted_at is null
    and me.role::text in ('employee', 'site_engineer')
$$;

create or replace function waytara.my_assigned_equipment_ids()
returns setof uuid
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select e.id from waytara.equipment e where e.site_id in (select waytara.my_assigned_site_ids())
$$;

revoke all on function waytara.my_assigned_site_ids() from public, anon;
revoke all on function waytara.my_assigned_equipment_ids() from public, anon;
grant execute on function waytara.my_assigned_site_ids() to authenticated, service_role;
grant execute on function waytara.my_assigned_equipment_ids() to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 3. Read policies for assigned staff (added next to the existing ones)
-- ---------------------------------------------------------------------------------------------------------------------------------

drop policy if exists sites_site_staff on waytara.sites;
create policy sites_site_staff on waytara.sites
  for select to authenticated
  using (id in (select waytara.my_assigned_site_ids()));

drop policy if exists devices_site_staff on waytara.equipment;
create policy devices_site_staff on waytara.equipment
  for select to authenticated
  using (site_id in (select waytara.my_assigned_site_ids()));

drop policy if exists equipment_latest_site_staff on waytara.equipment_latest;
create policy equipment_latest_site_staff on waytara.equipment_latest
  for select to authenticated
  using (equipment_id in (select waytara.my_assigned_equipment_ids()));

drop policy if exists settings_site_staff on waytara.equipment_configs;
create policy settings_site_staff on waytara.equipment_configs
  for select to authenticated
  using (equipment_id in (select waytara.my_assigned_equipment_ids()));

drop policy if exists equipment_heartbeat_site_staff on waytara.equipment_heartbeat;
create policy equipment_heartbeat_site_staff on waytara.equipment_heartbeat
  for select to authenticated
  using (equipment_id in (select waytara.my_assigned_equipment_ids()));

drop policy if exists equipment_open_bucket_site_staff on waytara.equipment_open_bucket;
create policy equipment_open_bucket_site_staff on waytara.equipment_open_bucket
  for select to authenticated
  using (equipment_id in (select waytara.my_assigned_equipment_ids()));

drop policy if exists equipment_rollup_15m_site_staff on waytara.equipment_rollup_15m;
create policy equipment_rollup_15m_site_staff on waytara.equipment_rollup_15m
  for select to authenticated
  using (equipment_id in (select waytara.my_assigned_equipment_ids()));

drop policy if exists equipment_rollup_1h_site_staff on waytara.equipment_rollup_1h;
create policy equipment_rollup_1h_site_staff on waytara.equipment_rollup_1h
  for select to authenticated
  using (equipment_id in (select waytara.my_assigned_equipment_ids()));

drop policy if exists equipment_rollup_1d_site_staff on waytara.equipment_rollup_1d;
create policy equipment_rollup_1d_site_staff on waytara.equipment_rollup_1d
  for select to authenticated
  using (equipment_id in (select waytara.my_assigned_equipment_ids()));

drop policy if exists equipment_metrics_site_staff on waytara.equipment_metrics;
create policy equipment_metrics_site_staff on waytara.equipment_metrics
  for select to authenticated
  using (equipment_id in (select waytara.my_assigned_equipment_ids()));

drop policy if exists charging_sessions_site_staff on waytara.ev_sessions;
create policy charging_sessions_site_staff on waytara.ev_sessions
  for select to authenticated
  using (equipment_id in (select waytara.my_assigned_equipment_ids()));

drop policy if exists alerts_site_staff on waytara.alerts;
create policy alerts_site_staff on waytara.alerts
  for select to authenticated
  using (device_id in (select waytara.my_assigned_equipment_ids()));

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 4. The backend's identity
-- ---------------------------------------------------------------------------------------------------------------------------------

create table if not exists waytara.gateway_service_users (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  label       text not null,
  created_at  timestamptz not null default now()
);

alter table waytara.gateway_service_users enable row level security;
revoke all on waytara.gateway_service_users from public, anon, authenticated;
grant all on waytara.gateway_service_users to service_role;
comment on table waytara.gateway_service_users is 'The accounts the backend signs in as. Add one row after creating the account in Authentication > Users. No policies: only the definer functions read it.';

create or replace function waytara.is_gateway_service()
returns boolean
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select exists (select 1 from waytara.gateway_service_users where user_id = (select auth.uid()))
$$;

revoke all on function waytara.is_gateway_service() from public, anon;
grant execute on function waytara.is_gateway_service() to authenticated, service_role;

create or replace function waytara._require_gateway_service()
returns void
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  if not waytara.is_gateway_service() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end;
$$;

revoke all on function waytara._require_gateway_service() from public, anon, authenticated;
grant execute on function waytara._require_gateway_service() to service_role;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 5. Keys and their audit trail
-- ---------------------------------------------------------------------------------------------------------------------------------

create table if not exists waytara.equipment_keys (
  id               uuid primary key default gen_random_uuid(),
  equipment_id     uuid not null references waytara.equipment(id) on delete cascade,
  kind             text not null check (kind in ('gateway', 'charger')),
  label            text,
  key_ciphertext   bytea not null check (octet_length(key_ciphertext) >= 28),
  key_fingerprint  text not null check (char_length(key_fingerprint) between 8 and 64),
  created_by       uuid references waytara.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  last_used_at     timestamptz,
  last_used_ip     inet,
  expires_at       timestamptz,
  revoked_at       timestamptz,
  revoked_by       uuid references waytara.profiles(id) on delete set null,
  revoke_reason    text
);

create index if not exists equipment_keys_active_idx on waytara.equipment_keys (equipment_id, kind) where revoked_at is null;

alter table waytara.equipment_keys enable row level security;

-- Browsers can list keys but never read the secret: only these columns are granted.
revoke all on waytara.equipment_keys from public, anon, authenticated;
grant select (id, equipment_id, kind, label, key_fingerprint, created_by, created_at, last_used_at, last_used_ip, expires_at, revoked_at, revoked_by, revoke_reason)
  on waytara.equipment_keys to authenticated;
grant all on waytara.equipment_keys to service_role;

drop policy if exists equipment_keys_admin_select on waytara.equipment_keys;
create policy equipment_keys_admin_select on waytara.equipment_keys
  for select to authenticated
  using ((select waytara.is_admin()));

drop policy if exists equipment_keys_site_staff_select on waytara.equipment_keys;
create policy equipment_keys_site_staff_select on waytara.equipment_keys
  for select to authenticated
  using (equipment_id in (select waytara.my_assigned_equipment_ids()));

comment on table waytara.equipment_keys is 'One secret per board or charger. key_ciphertext is AES-GCM output from the backend; no browser role can read it.';

create table if not exists waytara.equipment_key_events (
  id            bigint generated always as identity primary key,
  equipment_id  uuid not null references waytara.equipment(id) on delete cascade,
  key_id        uuid references waytara.equipment_keys(id) on delete set null,
  event         text not null check (event in ('created', 'rotated', 'revoked', 'expired', 'auth_failed', 'claimed', 'ticket_issued')),
  actor         uuid references waytara.profiles(id) on delete set null,
  ip            inet,
  detail        jsonb not null default '{}'::jsonb,
  at            timestamptz not null default now()
);

create index if not exists equipment_key_events_equipment_idx on waytara.equipment_key_events (equipment_id, at desc);

alter table waytara.equipment_key_events enable row level security;
revoke all on waytara.equipment_key_events from public, anon, authenticated;
grant select on waytara.equipment_key_events to authenticated;
grant all on waytara.equipment_key_events to service_role;

drop policy if exists equipment_key_events_admin_select on waytara.equipment_key_events;
create policy equipment_key_events_admin_select on waytara.equipment_key_events
  for select to authenticated
  using ((select waytara.is_admin()));

drop policy if exists equipment_key_events_site_staff_select on waytara.equipment_key_events;
create policy equipment_key_events_site_staff_select on waytara.equipment_key_events
  for select to authenticated
  using (equipment_id in (select waytara.my_assigned_equipment_ids()));

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 6. Boards, register maps, claim tickets
-- ---------------------------------------------------------------------------------------------------------------------------------

create table if not exists waytara.gateway_devices (
  equipment_id  uuid primary key references waytara.equipment(id) on delete cascade,
  hardware_id   text unique,
  fw_version    text,
  map_version   integer,
  claimed_at    timestamptz,
  claimed_by    uuid references waytara.profiles(id) on delete set null,
  last_boot_at  timestamptz,
  reset_reason  text,
  ota_state     text,
  updated_at    timestamptz not null default now()
);

create table if not exists waytara.register_map_versions (
  equipment_id  uuid not null references waytara.equipment(id) on delete cascade,
  version       integer not null check (version > 0),
  hash          text not null,
  built_at      timestamptz not null default now(),
  body          jsonb not null,
  primary key (equipment_id, version)
);

create table if not exists waytara.equipment_claim_tickets (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references waytara.equipment(id) on delete cascade,
  issued_to     uuid references waytara.profiles(id) on delete set null,
  hardware_id   text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '15 minutes',
  used_at       timestamptz,
  constraint equipment_claim_tickets_short_life check (expires_at <= created_at + interval '1 hour')
);

create index if not exists equipment_claim_tickets_open_idx on waytara.equipment_claim_tickets (equipment_id) where used_at is null;

alter table waytara.gateway_devices enable row level security;
alter table waytara.register_map_versions enable row level security;
alter table waytara.equipment_claim_tickets enable row level security;

revoke all on waytara.gateway_devices, waytara.register_map_versions, waytara.equipment_claim_tickets from public, anon, authenticated;
grant select on waytara.gateway_devices, waytara.register_map_versions to authenticated;
grant all on waytara.gateway_devices, waytara.register_map_versions, waytara.equipment_claim_tickets to service_role;

drop policy if exists gateway_devices_admin_select on waytara.gateway_devices;
create policy gateway_devices_admin_select on waytara.gateway_devices
  for select to authenticated using ((select waytara.is_admin()));
drop policy if exists gateway_devices_site_staff_select on waytara.gateway_devices;
create policy gateway_devices_site_staff_select on waytara.gateway_devices
  for select to authenticated using (equipment_id in (select waytara.my_assigned_equipment_ids()));

drop policy if exists register_map_versions_admin_select on waytara.register_map_versions;
create policy register_map_versions_admin_select on waytara.register_map_versions
  for select to authenticated using ((select waytara.is_admin()));
drop policy if exists register_map_versions_site_staff_select on waytara.register_map_versions;
create policy register_map_versions_site_staff_select on waytara.register_map_versions
  for select to authenticated using (equipment_id in (select waytara.my_assigned_equipment_ids()));

-- claim tickets have no browser policy at all: only the gw_* functions touch them

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 7. Diagnostics polling flag
-- ---------------------------------------------------------------------------------------------------------------------------------

alter table waytara.equipment_metrics add column if not exists poll_enabled boolean not null default false;
comment on column waytara.equipment_metrics.poll_enabled is 'The gateway reads this register when show_for_user OR poll_enabled. Staff switch it on to diagnose a unit without showing the value to the customer.';

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 8. Functions only the backend identity may call
-- ---------------------------------------------------------------------------------------------------------------------------------

create or replace function waytara.gw_actor_can_access_site(p_actor uuid, p_site uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return waytara.can_access_site_as(p_actor, p_site);
end;
$$;

-- who may create / rotate / revoke keys by hand: admins, and staff with access to the equipment's site (never customers)
create or replace function waytara.gw_actor_can_manage_keys(p_actor uuid, p_equipment uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_site uuid;
begin
  perform waytara._require_gateway_service();
  select site_id into v_site from waytara.equipment where id = p_equipment;
  if v_site is null then
    return false;
  end if;
  return exists (select 1 from waytara.profiles where id = p_actor and role::text in ('admin', 'employee', 'site_engineer'))
    and waytara.can_access_site_as(p_actor, v_site);
end;
$$;

create or replace function waytara.gw_create_key(
  p_equipment   uuid,
  p_kind        text,
  p_label       text,
  p_ciphertext  bytea,
  p_fingerprint text,
  p_actor       uuid,
  p_ip          inet default null,
  p_expires     timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_id uuid;
begin
  perform waytara._require_gateway_service();
  if p_kind not in ('gateway', 'charger') then
    raise exception 'Unknown key kind' using errcode = '22023';
  end if;
  if p_ciphertext is null or octet_length(p_ciphertext) < 28 then
    raise exception 'The encrypted key is too short' using errcode = '22023';
  end if;
  if not exists (select 1 from waytara.equipment where id = p_equipment) then
    raise exception 'Unknown equipment' using errcode = 'P0002';
  end if;
  insert into waytara.equipment_keys (equipment_id, kind, label, key_ciphertext, key_fingerprint, created_by, expires_at)
  values (p_equipment, p_kind, p_label, p_ciphertext, p_fingerprint, p_actor, p_expires)
  returning id into v_id;
  insert into waytara.equipment_key_events (equipment_id, key_id, event, actor, ip, detail)
  values (p_equipment, v_id, 'created', p_actor, p_ip, jsonb_build_object('kind', p_kind, 'fingerprint', p_fingerprint));
  return v_id;
end;
$$;

-- a new key for the same equipment and kind; the old one stops at once (grace 0) or after p_grace_seconds
create or replace function waytara.gw_rotate_key(
  p_key           uuid,
  p_ciphertext    bytea,
  p_fingerprint   text,
  p_actor         uuid,
  p_ip            inet default null,
  p_grace_seconds integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_old waytara.equipment_keys%rowtype;
  v_new uuid;
begin
  perform waytara._require_gateway_service();
  if p_grace_seconds < 0 or p_grace_seconds > 86400 then
    raise exception 'The grace period must be between 0 and 86400 seconds' using errcode = '22023';
  end if;
  if p_ciphertext is null or octet_length(p_ciphertext) < 28 then
    raise exception 'The encrypted key is too short' using errcode = '22023';
  end if;
  select * into v_old from waytara.equipment_keys where id = p_key and revoked_at is null for update;
  if not found then
    raise exception 'No such active key' using errcode = 'P0002';
  end if;
  insert into waytara.equipment_keys (equipment_id, kind, label, key_ciphertext, key_fingerprint, created_by)
  values (v_old.equipment_id, v_old.kind, v_old.label, p_ciphertext, p_fingerprint, p_actor)
  returning id into v_new;
  if p_grace_seconds = 0 then
    update waytara.equipment_keys set revoked_at = now(), revoked_by = p_actor, revoke_reason = 'rotated' where id = p_key;
  else
    update waytara.equipment_keys
       set expires_at = least(coalesce(expires_at, 'infinity'::timestamptz), now() + make_interval(secs => p_grace_seconds))
     where id = p_key;
  end if;
  insert into waytara.equipment_key_events (equipment_id, key_id, event, actor, ip, detail)
  values (v_old.equipment_id, v_new, 'rotated', p_actor, p_ip,
          jsonb_build_object('replaces', p_key, 'grace_seconds', p_grace_seconds, 'fingerprint', p_fingerprint));
  return v_new;
end;
$$;

create or replace function waytara.gw_revoke_key(p_key uuid, p_actor uuid, p_ip inet default null, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_equipment uuid;
begin
  perform waytara._require_gateway_service();
  update waytara.equipment_keys
     set revoked_at = now(), revoked_by = p_actor, revoke_reason = coalesce(p_reason, 'revoked')
   where id = p_key and revoked_at is null
  returning equipment_id into v_equipment;
  if v_equipment is null then
    return false;
  end if;
  insert into waytara.equipment_key_events (equipment_id, key_id, event, actor, ip, detail)
  values (v_equipment, p_key, 'revoked', p_actor, p_ip, jsonb_build_object('reason', p_reason));
  return true;
end;
$$;

-- the keys a board or charger may log in with right now (hot path: called on every login)
create or replace function waytara.gw_active_keys(p_equipment uuid)
returns table (key_id uuid, kind text, key_ciphertext bytea, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return query
    select k.id, k.kind, k.key_ciphertext, k.expires_at
    from waytara.equipment_keys k
    where k.equipment_id = p_equipment
      and k.revoked_at is null
      and (k.expires_at is null or k.expires_at > now());
end;
$$;

create or replace function waytara.gw_touch_key(p_key uuid, p_ip inet default null)
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  update waytara.equipment_keys
     set last_used_at = now(), last_used_ip = coalesce(p_ip, last_used_ip)
   where id = p_key and (last_used_at is null or last_used_at < now() - interval '1 minute');
end;
$$;

create or replace function waytara.gw_record_key_event(
  p_equipment uuid,
  p_key       uuid,
  p_event     text,
  p_actor     uuid default null,
  p_ip        inet default null,
  p_detail    jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  if p_event not in ('created', 'rotated', 'revoked', 'expired', 'auth_failed', 'claimed', 'ticket_issued') then
    raise exception 'Unknown key event' using errcode = '22023';
  end if;
  insert into waytara.equipment_key_events (equipment_id, key_id, event, actor, ip, detail)
  values (p_equipment, p_key, p_event, p_actor, p_ip, coalesce(p_detail, '{}'::jsonb));
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'gw_actor_can_access_site(uuid, uuid)',
    'gw_actor_can_manage_keys(uuid, uuid)',
    'gw_create_key(uuid, text, text, bytea, text, uuid, inet, timestamptz)',
    'gw_rotate_key(uuid, bytea, text, uuid, inet, integer)',
    'gw_revoke_key(uuid, uuid, inet, text)',
    'gw_active_keys(uuid)',
    'gw_touch_key(uuid, inet)',
    'gw_record_key_event(uuid, uuid, text, uuid, inet, jsonb)'
  ] loop
    execute format('revoke all on function waytara.%s from public, anon', f);
    execute format('grant execute on function waytara.%s to authenticated, service_role', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Rollback (kept here so it is next to what it undoes). Run only if this has to be backed out; it deletes keys and assignments.
--
--   drop policy if exists sites_site_staff on waytara.sites;                       drop policy if exists devices_site_staff on waytara.equipment;
--   drop policy if exists equipment_latest_site_staff on waytara.equipment_latest; drop policy if exists settings_site_staff on waytara.equipment_configs;
--   drop policy if exists equipment_heartbeat_site_staff on waytara.equipment_heartbeat;
--   drop policy if exists equipment_open_bucket_site_staff on waytara.equipment_open_bucket;
--   drop policy if exists equipment_rollup_15m_site_staff on waytara.equipment_rollup_15m;
--   drop policy if exists equipment_rollup_1h_site_staff on waytara.equipment_rollup_1h;
--   drop policy if exists equipment_rollup_1d_site_staff on waytara.equipment_rollup_1d;
--   drop policy if exists equipment_metrics_site_staff on waytara.equipment_metrics;
--   drop policy if exists charging_sessions_site_staff on waytara.ev_sessions;     drop policy if exists alerts_site_staff on waytara.alerts;
--   drop table if exists waytara.equipment_claim_tickets, waytara.register_map_versions, waytara.gateway_devices,
--                        waytara.equipment_key_events, waytara.equipment_keys, waytara.gateway_service_users, waytara.site_staff;
--   drop function if exists waytara.gw_actor_can_access_site(uuid, uuid), waytara.gw_actor_can_manage_keys(uuid, uuid),
--     waytara.gw_create_key(uuid, text, text, bytea, text, uuid, inet, timestamptz), waytara.gw_rotate_key(uuid, bytea, text, uuid, inet, integer),
--     waytara.gw_revoke_key(uuid, uuid, inet, text), waytara.gw_active_keys(uuid), waytara.gw_touch_key(uuid, inet),
--     waytara.gw_record_key_event(uuid, uuid, text, uuid, inet, jsonb), waytara._require_gateway_service(), waytara.is_gateway_service(),
--     waytara.my_assigned_equipment_ids(), waytara.my_assigned_site_ids(), waytara.can_access_site(uuid), waytara.can_access_site_as(uuid, uuid),
--     waytara.site_staff_check();
--   alter table waytara.equipment_metrics drop column if exists poll_enabled;
