-- Site Members: Allows multiple customers/users to access a single site
-- (e.g. team members at Waytara Energy accessing the Waytara Office site).

create table if not exists waytara.site_members (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references waytara.sites(id) on delete cascade,
  user_id uuid not null references waytara.profiles(id) on delete cascade,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),
  constraint site_members_unique unique (site_id, user_id)
);

comment on table waytara.site_members is 'Authorized users granted access to a site, supplementing the primary owner (sites.customer_id).';

alter table waytara.site_members enable row level security;
grant select on waytara.site_members to authenticated;
grant all on waytara.site_members to service_role;

-- Read policy on site_members
drop policy if exists site_members_read on waytara.site_members;
create policy site_members_read on waytara.site_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select waytara.is_admin())
  );

-- Read policies for site members across site & equipment telemetry tables:

-- 1. sites
drop policy if exists sites_member on waytara.sites;
create policy sites_member on waytara.sites
  for select to authenticated
  using (
    id in (select site_id from waytara.site_members where user_id = (select auth.uid()))
  );

-- 2. equipment
drop policy if exists devices_member on waytara.equipment;
create policy devices_member on waytara.equipment
  for select to authenticated
  using (
    site_id in (select site_id from waytara.site_members where user_id = (select auth.uid()))
  );

-- 3. equipment_latest
drop policy if exists equipment_latest_member on waytara.equipment_latest;
create policy equipment_latest_member on waytara.equipment_latest
  for select to authenticated
  using (
    equipment_id in (
      select id from waytara.equipment where site_id in (
        select site_id from waytara.site_members where user_id = (select auth.uid())
      )
    )
  );

-- 4. equipment_heartbeat
drop policy if exists equipment_heartbeat_member on waytara.equipment_heartbeat;
create policy equipment_heartbeat_member on waytara.equipment_heartbeat
  for select to authenticated
  using (
    equipment_id in (
      select id from waytara.equipment where site_id in (
        select site_id from waytara.site_members where user_id = (select auth.uid())
      )
    )
  );

-- 5. equipment_rollup_15m
drop policy if exists equipment_rollup_15m_member on waytara.equipment_rollup_15m;
create policy equipment_rollup_15m_member on waytara.equipment_rollup_15m
  for select to authenticated
  using (
    equipment_id in (
      select id from waytara.equipment where site_id in (
        select site_id from waytara.site_members where user_id = (select auth.uid())
      )
    )
  );

-- 6. equipment_rollup_1h
drop policy if exists equipment_rollup_1h_member on waytara.equipment_rollup_1h;
create policy equipment_rollup_1h_member on waytara.equipment_rollup_1h
  for select to authenticated
  using (
    equipment_id in (
      select id from waytara.equipment where site_id in (
        select site_id from waytara.site_members where user_id = (select auth.uid())
      )
    )
  );

-- 7. equipment_rollup_1d
drop policy if exists equipment_rollup_1d_member on waytara.equipment_rollup_1d;
create policy equipment_rollup_1d_member on waytara.equipment_rollup_1d
  for select to authenticated
  using (
    equipment_id in (
      select id from waytara.equipment where site_id in (
        select site_id from waytara.site_members where user_id = (select auth.uid())
      )
    )
  );

-- 8. equipment_open_bucket
drop policy if exists equipment_open_bucket_member on waytara.equipment_open_bucket;
create policy equipment_open_bucket_member on waytara.equipment_open_bucket
  for select to authenticated
  using (
    equipment_id in (
      select id from waytara.equipment where site_id in (
        select site_id from waytara.site_members where user_id = (select auth.uid())
      )
    )
  );

-- 9. equipment_metrics
drop policy if exists equipment_metrics_member on waytara.equipment_metrics;
create policy equipment_metrics_member on waytara.equipment_metrics
  for select to authenticated
  using (
    equipment_id in (
      select id from waytara.equipment where site_id in (
        select site_id from waytara.site_members where user_id = (select auth.uid())
      )
    )
  );

-- 10. equipment_configs
drop policy if exists equipment_configs_member on waytara.equipment_configs;
create policy equipment_configs_member on waytara.equipment_configs
  for select to authenticated
  using (
    equipment_id in (
      select id from waytara.equipment where site_id in (
        select site_id from waytara.site_members where user_id = (select auth.uid())
      )
    )
  );

-- 11. ev_sessions
drop policy if exists charging_sessions_member on waytara.ev_sessions;
create policy charging_sessions_member on waytara.ev_sessions
  for select to authenticated
  using (
    equipment_id in (
      select id from waytara.equipment where site_id in (
        select site_id from waytara.site_members where user_id = (select auth.uid())
      )
    )
  );

-- 12. alerts
drop policy if exists alerts_member on waytara.alerts;
create policy alerts_member on waytara.alerts
  for select to authenticated
  using (
    device_id in (
      select id from waytara.equipment where site_id in (
        select site_id from waytara.site_members where user_id = (select auth.uid())
      )
    )
  );

-- 13. Update can_access_site_as helper to recognise site members
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
        or exists (select 1 from waytara.site_members sm where sm.site_id = p_site and sm.user_id = p_user)
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
