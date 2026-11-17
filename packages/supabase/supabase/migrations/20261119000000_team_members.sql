-- Team members: people an account owner invites to see, and (device by device) operate, their WayTara system.
--
--   team_members          who is invited by which owner, their role label, the pages they may see, whether they may manage scheduled reports, and where the invitation stands
--   team_member_devices   per device: 'read' (readings, history, alerts, live view) or 'operate' (also change settings; start and stop charging)
--   team_login_codes      the e-mail code a person types when they open their invitation (the same idea as partner_login_codes)
--
-- Access is enforced here, not by hiding buttons: the member's reads are separate row-level rules next to the owner's (the same way assigned staff were added), a write needs
-- 'operate' on that device, and the backend's charger commands are refused for 'read'. A member sees a device's child equipment (panels, a battery) with it. The older
-- site_members table (the office's people) is left exactly as it is.
--
-- Written by the website's servers (the service role) after they have checked the owner; the owner and the member can read their own rows.

-- 1. tables ---------------------------------------------------------------------------------------------------------------------------------------------

create table if not exists waytara.team_members (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references waytara.profiles (id) on delete cascade,
  -- set when the invitation is accepted (a new account is made, or the person's existing customer account is tied to it)
  user_id           uuid references waytara.profiles (id) on delete cascade,
  email             text not null check (email = lower(btrim(email)) and length(email) between 5 and 254 and position('@' in email) > 1),
  full_name         text check (full_name is null or length(full_name) <= 120),
  role              text not null default 'viewer' check (role in ('viewer', 'operator', 'manager', 'custom')),
  pages             text[] not null default '{}'
                      check (pages <@ array['overview', 'monitoring', 'performance', 'reports', 'maintenance', 'site', 'devices']::text[]),
  can_schedule      boolean not null default false,
  status            text not null default 'invited' check (status in ('invited', 'active', 'suspended')),
  access_token_hash text unique,
  access_expires_at timestamptz,
  invited_at        timestamptz not null default now(),
  last_sent_at      timestamptz,
  accepted_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (owner_id, email)
);
create unique index if not exists team_members_owner_user_key on waytara.team_members (owner_id, user_id) where user_id is not null;
create index if not exists team_members_user_idx on waytara.team_members (user_id) where user_id is not null;

create table if not exists waytara.team_member_devices (
  member_id    uuid not null references waytara.team_members (id) on delete cascade,
  equipment_id uuid not null references waytara.equipment (id) on delete cascade,
  level        text not null default 'read' check (level in ('read', 'operate')),
  primary key (member_id, equipment_id)
);
create index if not exists team_member_devices_equipment_idx on waytara.team_member_devices (equipment_id);

create table if not exists waytara.team_login_codes (
  member_id        uuid primary key references waytara.team_members (id) on delete cascade,
  code_hash        text not null,
  expires_at       timestamptz not null,
  attempts         integer not null default 0,
  last_sent_at     timestamptz not null default now(),
  proof_hash       text,
  proof_expires_at timestamptz,
  created_at       timestamptz not null default now()
);

alter table waytara.team_members enable row level security;
alter table waytara.team_member_devices enable row level security;
alter table waytara.team_login_codes enable row level security;

-- the token hash and the codes are never readable by a browser: columns are granted one by one
revoke all on waytara.team_members, waytara.team_member_devices, waytara.team_login_codes from public, anon, authenticated;
grant select (id, owner_id, user_id, email, full_name, role, pages, can_schedule, status, access_expires_at, invited_at, last_sent_at, accepted_at, created_at, updated_at) on waytara.team_members to authenticated;
grant select on waytara.team_member_devices to authenticated;
grant all on waytara.team_members, waytara.team_member_devices, waytara.team_login_codes to service_role;

drop policy if exists team_members_read on waytara.team_members;
create policy team_members_read on waytara.team_members for select to authenticated
  using (owner_id = (select auth.uid()) or user_id = (select auth.uid()) or (select waytara.is_admin()));

drop policy if exists team_member_devices_read on waytara.team_member_devices;
create policy team_member_devices_read on waytara.team_member_devices for select to authenticated
  using (exists (select 1 from waytara.team_members m where m.id = member_id and (m.owner_id = (select auth.uid()) or m.user_id = (select auth.uid()) or (select waytara.is_admin()))));

drop trigger if exists team_members_updated_at on waytara.team_members;
create trigger team_members_updated_at before update on waytara.team_members for each row execute function waytara.set_updated_at();

-- 2. who has access to what -----------------------------------------------------------------------------------------------------------------------------

-- The live grants of one person: only members whose invitation was accepted and who are not suspended, and only while both they and the owner have a working account.
create or replace function waytara.team_grants(p_user uuid)
returns table (member_id uuid, owner_id uuid, equipment_id uuid, level text, pages text[], can_schedule boolean)
language sql stable security definer set search_path = waytara, pg_temp
as $$
  select m.id, m.owner_id, d.equipment_id, d.level, m.pages, m.can_schedule
  from waytara.team_members m
  join waytara.team_member_devices d on d.member_id = m.id
  join waytara.profiles u on u.id = m.user_id and u.deactivated_at is null and u.deleted_at is null
  join waytara.profiles o on o.id = m.owner_id and o.deactivated_at is null and o.deleted_at is null
  where m.user_id = p_user and m.status = 'active'
$$;
revoke all on function waytara.team_grants(uuid) from public, anon, authenticated;

-- 'operate', 'read' or null: what this person may do with this device (a child, such as a battery, has its parent's level).
create or replace function waytara.team_equipment_level(p_user uuid, p_equipment uuid)
returns text
language sql stable security definer set search_path = waytara, pg_temp
as $$
  select case when count(*) = 0 then null when bool_or(g.level = 'operate') then 'operate' else 'read' end
  from waytara.team_grants(p_user) g
  where g.equipment_id = p_equipment
     or g.equipment_id = (select e.parent_id from waytara.equipment e where e.id = p_equipment)
$$;
revoke all on function waytara.team_equipment_level(uuid, uuid) from public, anon, authenticated;

-- The devices (and their children) the signed-in person has been given, as the row-level rules use them. Devices hidden from customers stay hidden.
create or replace function waytara.my_team_equipment_ids()
returns setof uuid
language sql stable security definer set search_path = waytara, pg_temp
as $$
  select e.id from waytara.equipment e
  where e.customer_hidden_at is null
    and (e.id in (select g.equipment_id from waytara.team_grants((select auth.uid())) g)
      or e.parent_id in (select g.equipment_id from waytara.team_grants((select auth.uid())) g))
$$;
revoke all on function waytara.my_team_equipment_ids() from public, anon;
grant execute on function waytara.my_team_equipment_ids() to authenticated, service_role;

create or replace function waytara.my_team_site_ids()
returns setof uuid
language sql stable security definer set search_path = waytara, pg_temp
as $$
  select distinct e.site_id from waytara.equipment e where e.id in (select waytara.my_team_equipment_ids())
$$;
revoke all on function waytara.my_team_site_ids() from public, anon;
grant execute on function waytara.my_team_site_ids() to authenticated, service_role;

-- Whether the signed-in person may change this device: an admin, the site's owner, or a team member with 'operate' on it.
create or replace function waytara.can_operate_equipment(p_equipment_id uuid)
returns boolean
language sql stable security definer set search_path = waytara, pg_temp
as $$
  select p_equipment_id is not null and (
    (select waytara.is_admin())
    or exists (
      select 1 from waytara.equipment d join waytara.sites s on s.id = d.site_id
      where d.id = p_equipment_id and s.customer_id = (select auth.uid())
    )
    -- coalesce: a device they were not given has no level (null), and the answer must be a plain false, not null
    or coalesce(waytara.team_equipment_level((select auth.uid()), p_equipment_id) = 'operate', false)
  );
$$;
revoke all on function waytara.can_operate_equipment(uuid) from public, anon;
grant execute on function waytara.can_operate_equipment(uuid) to authenticated, service_role;

-- Whether the signed-in person is a live team member of this owner with this page.
create or replace function waytara.team_has_page(p_owner uuid, p_page text)
returns boolean
language sql stable security definer set search_path = waytara, pg_temp
as $$
  select exists (
    select 1 from waytara.team_grants((select auth.uid())) g where g.owner_id = p_owner and p_page = any(g.pages)
  )
$$;
revoke all on function waytara.team_has_page(uuid, text) from public, anon;
grant execute on function waytara.team_has_page(uuid, text) to authenticated, service_role;

-- Whether the signed-in person may manage this owner's scheduled reports (the switch is on, and they can see Reports).
create or replace function waytara.team_can_schedule(p_owner uuid)
returns boolean
language sql stable security definer set search_path = waytara, pg_temp
as $$
  select exists (
    select 1 from waytara.team_grants((select auth.uid())) g where g.owner_id = p_owner and g.can_schedule and 'reports' = any(g.pages)
  )
$$;
revoke all on function waytara.team_can_schedule(uuid) from public, anon;
grant execute on function waytara.team_can_schedule(uuid) to authenticated, service_role;

-- For the backend's report-file check: this person has the Reports page, this device, and the owner's plan includes reports.
create or replace function waytara.team_reports_access(p_actor uuid, p_equipment uuid)
returns boolean
language sql stable security definer set search_path = waytara, pg_temp
as $$
  select exists (
    select 1
    from waytara.team_grants(p_actor) g
    join waytara.customers c on c.id = g.owner_id
    join waytara.plans p on p.id = c.plan_id
    where (g.equipment_id = p_equipment or g.equipment_id = (select e.parent_id from waytara.equipment e where e.id = p_equipment))
      and 'reports' = any(g.pages)
      and coalesce((p.features ->> 'reports')::boolean, false)
  )
$$;
revoke all on function waytara.team_reports_access(uuid, uuid) from public, anon, authenticated;

-- A member uses the plan of the owner who invited them: the plan's name and features and the owner's tariff, as the dashboard's menu and pages need them.
create or replace function waytara.my_team_plan()
returns table (owner_id uuid, plan_name text, features jsonb, tariff_rate_per_kwh numeric)
language sql stable security definer set search_path = waytara, pg_temp
as $$
  select m.owner_id, p.name, coalesce(p.features, '{}'::jsonb), c.tariff_rate_per_kwh
  from waytara.team_members m
  join waytara.customers c on c.id = m.owner_id
  left join waytara.plans p on p.id = c.plan_id
  where m.user_id = (select auth.uid()) and m.status = 'active'
  order by m.accepted_at nulls last, m.created_at
  limit 1
$$;
revoke all on function waytara.my_team_plan() from public, anon;
grant execute on function waytara.my_team_plan() to authenticated, service_role;

-- 3. the existing "can this person see this device" now includes team members (live view and the rollup readers go through it) ---------------------------------

create or replace function waytara.can_view_equipment(p_equipment_id uuid)
returns boolean
language sql stable security definer set search_path = waytara, pg_temp
as $$
  select p_equipment_id is not null and (
    (select waytara.is_admin())
    or exists (
      select 1 from waytara.equipment d join waytara.sites s on s.id = d.site_id
      where d.id = p_equipment_id and s.customer_id = (select auth.uid())
    )
    or exists (
      select 1 from waytara.equipment d join waytara.site_members sm on sm.site_id = d.site_id
      where d.id = p_equipment_id
        and sm.user_id = (select auth.uid())
        and d.id != 'b63f7d02-42d0-493b-a6e5-7620f4e94393'
    )
    or exists (
      select 1 from waytara.equipment d
      join waytara.sites s on s.id = d.site_id
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where d.id = p_equipment_id and co.employee_id = (select auth.uid())
    )
    or waytara.team_equipment_level((select auth.uid()), p_equipment_id) is not null
  );
$$;

-- 4. read rules for team members, next to the owner's (a member sees only what they were given) -------------------------------------------------------------

drop policy if exists sites_team on waytara.sites;
create policy sites_team on waytara.sites for select to authenticated using (id in (select waytara.my_team_site_ids()));

drop policy if exists devices_team on waytara.equipment;
create policy devices_team on waytara.equipment for select to authenticated using (id in (select waytara.my_team_equipment_ids()));

do $$
declare
  t text;
begin
  foreach t in array array[
    'equipment_latest', 'equipment_heartbeat', 'equipment_open_bucket', 'equipment_rollup_15m', 'equipment_rollup_1h', 'equipment_rollup_1d',
    'equipment_metrics', 'equipment_configs', 'ev_sessions', 'ev_session_samples', 'ev_events'
  ] loop
    execute format('drop policy if exists %I on waytara.%I', t || '_team', t);
    execute format('create policy %I on waytara.%I for select to authenticated using (equipment_id in (select waytara.my_team_equipment_ids()))', t || '_team', t);
  end loop;
end $$;

drop policy if exists alerts_team on waytara.alerts;
create policy alerts_team on waytara.alerts for select to authenticated using (device_id in (select waytara.my_team_equipment_ids()));

-- 5. writes: changing a device's settings needs 'operate' on it -------------------------------------------------------------------------------------------

drop policy if exists settings_team_operate_insert on waytara.equipment_configs;
create policy settings_team_operate_insert on waytara.equipment_configs for insert to authenticated
  with check (waytara.can_operate_equipment(equipment_id) and (written_by is null or written_by = (select auth.uid())));

-- scheduled reports belong to the OWNER's account: a member with the Reports page may read them, and one with the schedule switch may manage them (for devices they can see)
drop policy if exists customer_reports_team_read on waytara.customer_reports;
create policy customer_reports_team_read on waytara.customer_reports for select to authenticated using (waytara.team_has_page(customer_id, 'reports'));

drop policy if exists customer_reports_team_manage on waytara.customer_reports;
create policy customer_reports_team_manage on waytara.customer_reports for all to authenticated
  using (waytara.team_can_schedule(customer_id))
  -- always for one device the member can see: a report with no device covers the owner's whole system, which could include devices this person was not given
  with check (waytara.team_can_schedule(customer_id) and equipment_id is not null and waytara.can_view_equipment(equipment_id));

drop policy if exists customer_report_runs_team_read on waytara.customer_report_runs;
create policy customer_report_runs_team_read on waytara.customer_report_runs for select to authenticated using (waytara.team_has_page(customer_id, 'reports'));

-- 6. the backend's checks ----------------------------------------------------------------------------------------------------------------------------------

-- Charger commands: a team member commands a charger as its owner would only with 'operate' on it; 'read' is refused. (Gateway hardware settings, keys and adding
-- chargers stay with the owner and WayTara staff: team members never pass can_access_site_as.)
create or replace function waytara.gw_ev_access(p_actor uuid, p_equipment uuid)
returns text
language plpgsql stable security definer set search_path = waytara, pg_temp
as $$
declare
  v_site uuid;
  v_role text;
  v_cat text;
begin
  perform waytara._require_gateway_service();
  select e.site_id, i.category::text into v_site, v_cat
  from waytara.equipment e left join waytara.equipment_inventory i on i.id = e.stock_id
  where e.id = p_equipment;
  if v_site is null or v_cat is distinct from 'ev_charger' then
    return null;
  end if;
  if not waytara.can_access_site_as(p_actor, v_site) then
    if waytara.team_equipment_level(p_actor, p_equipment) = 'operate' then
      return 'owner';
    end if;
    return null;
  end if;
  select me.role::text into v_role from waytara.profiles me where me.id = p_actor;
  return case when v_role in ('admin', 'employee', 'site_engineer') then 'staff' else 'owner' end;
end;
$$;
revoke all on function waytara.gw_ev_access(uuid, uuid) from public, anon;
grant execute on function waytara.gw_ev_access(uuid, uuid) to authenticated, service_role;

-- The readings reports ("Cadence files"): any level may read them for a device they were given, if they have the Reports page and the owner's plan includes reports.
create or replace function waytara.gw_cadence_access(p_actor uuid, p_equipment uuid)
returns text
language plpgsql stable security definer set search_path = waytara, pg_temp
as $$
declare
  v_site uuid;
  v_role text;
begin
  perform waytara._require_gateway_service();

  select e.site_id into v_site from waytara.equipment e where e.id = p_equipment;
  if v_site is null then
    return null;
  end if;
  if not waytara.can_access_site_as(p_actor, v_site) then
    if waytara.team_reports_access(p_actor, p_equipment) then
      return 'customer';
    end if;
    return null;
  end if;

  select me.role::text into v_role from waytara.profiles me where me.id = p_actor;
  if v_role in ('admin', 'employee', 'site_engineer') then
    return 'staff';
  end if;

  -- the owner of the site: only on a plan that includes reports
  if exists (
    select 1
    from waytara.customers c
    join waytara.plans p on p.id = c.plan_id
    where c.id = p_actor and coalesce((p.features ->> 'reports')::boolean, false)
  ) then
    return 'customer';
  end if;
  return null;
end;
$$;
revoke all on function waytara.gw_cadence_access(uuid, uuid) from public, anon;
grant execute on function waytara.gw_cadence_access(uuid, uuid) to authenticated, service_role;

comment on table waytara.team_members is 'People an account owner invited to see (and per device operate) their system. Servers write; the owner and the member read their own rows.';
comment on table waytara.team_member_devices is 'Per device: read or operate. A child device (panels, battery) takes its parent''s level.';

-- Rollback:
--   drop policy if exists sites_team on waytara.sites; drop policy if exists devices_team on waytara.equipment; drop policy if exists alerts_team on waytara.alerts;
--   (and the *_team policies on the eleven tables, settings_team_operate_insert, customer_reports_team_read, customer_reports_team_manage, customer_report_runs_team_read)
--   restore gw_ev_access / gw_cadence_access / can_view_equipment from 20261016000000 / 20261015030000 / 20261025040000; drop the team_* tables and functions.
