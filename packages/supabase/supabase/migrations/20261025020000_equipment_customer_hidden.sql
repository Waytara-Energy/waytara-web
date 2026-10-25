-- Equipment Customer Hidden: Allows equipment (such as test units or staff-only devices)
-- to be hidden from customer dashboards while keeping all telemetry, sessions, and data
-- fully accessible to admin/staff accounts (e.g. Manoj L).

alter table waytara.equipment add column if not exists customer_hidden_at timestamptz;

comment on column waytara.equipment.customer_hidden_at is
  'When set, customer accounts (owners and members) leave this equipment out of their dashboards. Admin and staff retain full access; no data is deleted.';

-- 1. equipment
drop policy if exists devices_owner on waytara.equipment;
create policy devices_owner on waytara.equipment
  for select to authenticated
  using (
    customer_hidden_at is null
    and exists (
      select 1 from waytara.sites s
      where s.id = equipment.site_id and s.customer_id = (select auth.uid())
    )
  );

drop policy if exists devices_member on waytara.equipment;
create policy devices_member on waytara.equipment
  for select to authenticated
  using (
    customer_hidden_at is null
    and site_id in (select sm.site_id from waytara.site_members sm where sm.user_id = (select auth.uid()))
  );

-- 2. equipment_latest
drop policy if exists equipment_latest_owner on waytara.equipment_latest;
create policy equipment_latest_owner on waytara.equipment_latest
  for select to authenticated
  using (
    equipment_id in (
      select d.id from waytara.equipment d
      join waytara.sites s on s.id = d.site_id
      where d.customer_hidden_at is null
        and s.customer_id = (select auth.uid())
    )
  );

drop policy if exists equipment_latest_member on waytara.equipment_latest;
create policy equipment_latest_member on waytara.equipment_latest
  for select to authenticated
  using (
    equipment_id in (
      select e.id from waytara.equipment e
      where e.customer_hidden_at is null
        and e.site_id in (select sm.site_id from waytara.site_members sm where sm.user_id = (select auth.uid()))
    )
  );

-- 3. equipment_heartbeat
drop policy if exists equipment_heartbeat_owner on waytara.equipment_heartbeat;
create policy equipment_heartbeat_owner on waytara.equipment_heartbeat
  for select to authenticated
  using (
    equipment_id in (
      select d.id from waytara.equipment d
      join waytara.sites s on s.id = d.site_id
      where d.customer_hidden_at is null
        and s.customer_id = (select auth.uid())
    )
  );

drop policy if exists equipment_heartbeat_member on waytara.equipment_heartbeat;
create policy equipment_heartbeat_member on waytara.equipment_heartbeat
  for select to authenticated
  using (
    equipment_id in (
      select e.id from waytara.equipment e
      where e.customer_hidden_at is null
        and e.site_id in (select sm.site_id from waytara.site_members sm where sm.user_id = (select auth.uid()))
    )
  );

-- 4. equipment_rollup_15m
drop policy if exists equipment_rollup_15m_owner on waytara.equipment_rollup_15m;
create policy equipment_rollup_15m_owner on waytara.equipment_rollup_15m
  for select to authenticated
  using (
    equipment_id in (
      select d.id from waytara.equipment d
      join waytara.sites s on s.id = d.site_id
      where d.customer_hidden_at is null
        and s.customer_id = (select auth.uid())
    )
  );

drop policy if exists equipment_rollup_15m_member on waytara.equipment_rollup_15m;
create policy equipment_rollup_15m_member on waytara.equipment_rollup_15m
  for select to authenticated
  using (
    equipment_id in (
      select e.id from waytara.equipment e
      where e.customer_hidden_at is null
        and e.site_id in (select sm.site_id from waytara.site_members sm where sm.user_id = (select auth.uid()))
    )
  );

-- 5. ev_sessions
drop policy if exists charging_sessions_owner on waytara.ev_sessions;
create policy charging_sessions_owner on waytara.ev_sessions
  for select to authenticated
  using (
    equipment_id in (
      select d.id from waytara.equipment d
      join waytara.sites s on s.id = d.site_id
      where d.customer_hidden_at is null
        and s.customer_id = (select auth.uid())
    )
  );

drop policy if exists charging_sessions_member on waytara.ev_sessions;
create policy charging_sessions_member on waytara.ev_sessions
  for select to authenticated
  using (
    equipment_id in (
      select e.id from waytara.equipment e
      where e.customer_hidden_at is null
        and e.site_id in (select sm.site_id from waytara.site_members sm where sm.user_id = (select auth.uid()))
    )
  );

-- 6. alerts
drop policy if exists alerts_owner on waytara.alerts;
create policy alerts_owner on waytara.alerts
  for select to authenticated
  using (
    device_id in (
      select d.id from waytara.equipment d
      join waytara.sites s on s.id = d.site_id
      where d.customer_hidden_at is null
        and s.customer_id = (select auth.uid())
    )
  );

drop policy if exists alerts_member on waytara.alerts;
create policy alerts_member on waytara.alerts
  for select to authenticated
  using (
    device_id in (
      select e.id from waytara.equipment e
      where e.customer_hidden_at is null
        and e.site_id in (select sm.site_id from waytara.site_members sm where sm.user_id = (select auth.uid()))
    )
  );

-- Hide Plugzmart 7.4kW AC EV Charger (b63f7d02-42d0-493b-a6e5-7620f4e94393) from customers
update waytara.equipment
set customer_hidden_at = now()
where id = 'b63f7d02-42d0-493b-a6e5-7620f4e94393';
