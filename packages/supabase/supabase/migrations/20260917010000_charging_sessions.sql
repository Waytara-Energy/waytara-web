-- Phase 0 of the multi-device-type dashboard roadmap: every established EV
-- charging app (ChargePoint, Wallbox) has a "charging history" — discrete
-- sessions with energy/duration, not just a raw cumulative meter line.
-- WayTara's device_readings only has continuous snapshots plus one
-- cumulative energy register (energy_active_import_register_kwh), so this
-- table is what turns that into real sessions: opened when a charger's
-- connector_status transitions into Charging (2), closed when it
-- transitions back out, with the energy register's value captured at each
-- edge (see apps/web/src/app/api/cron/detect-charging-sessions). Same
-- shape OCPP's own StartTransaction/StopTransaction messages would
-- populate once real hardware integration exists — a webhook would write
-- here instead of the cron, same table either way.

create table waytara.charging_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references waytara.devices(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  start_energy_kwh numeric,
  end_energy_kwh numeric,
  stop_reason text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

create index charging_sessions_device_id_idx on waytara.charging_sessions (device_id, started_at desc);
-- The detection cron's own "is there already an open session for this
-- device" check — partial index since only a handful of sessions are ever
-- open at once, out of a history that grows indefinitely.
create index charging_sessions_open_idx on waytara.charging_sessions (device_id) where ended_at is null;

alter table waytara.charging_sessions enable row level security;

-- Same three-way shape as alerts/maintenance_tickets/service_contracts:
-- customer sees their own (via device -> site -> customer), admin sees
-- all, employee sees sessions for customers assigned to them. Read-only
-- for every role — nothing writes here except the service-role cron/
-- webhook, same reasoning as alerts.
create policy "charging_sessions_owner" on waytara.charging_sessions
  for select
  using (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      where d.id = charging_sessions.device_id and s.customer_id = auth.uid()
    )
  );

create policy "charging_sessions_admin_all" on waytara.charging_sessions
  for select
  using (waytara.is_admin());

create policy "charging_sessions_employee_assigned" on waytara.charging_sessions
  for select
  using (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where d.id = charging_sessions.device_id and co.employee_id = auth.uid()
    )
  );
