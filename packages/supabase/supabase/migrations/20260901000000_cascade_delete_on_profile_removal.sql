-- Deleting an auth user only cascaded two levels deep (auth.users ->
-- profiles -> customers/payments/sites...) before hitting a wall: every
-- other foreign key pointing at profiles(id) had no ON DELETE action at
-- all (the Postgres default, effectively RESTRICT), so deleting a
-- customer or employee with any real activity failed outright or left
-- orphaned/dangling rows depending on what existed. This is exactly what
-- forced manual multi-table cleanup scripts all session (see the
-- 'test-cleanup-audit-log-fk' pattern — audit_log specifically blocked
-- profile deletes this way).
--
-- Two different relationships needed two different actions, not one
-- blanket CASCADE:
--
--   CASCADE  — rows that ARE the person's data and have no meaning
--              without them: a customer's own onboarding pipeline record.
--              (Their customers/payments/sites/devices/readings/settings/
--              alerts/subscriptions rows already cascaded correctly —
--              only customer_onboarding.customer_id was missing this.)
--
--   SET NULL — rows that are independent business records where the
--              person is just an assignee: a lead an employee worked, a
--              quotation they wrote, an audit log entry they generated,
--              an invite they sent, a device setting they changed. These
--              must survive the person's account being removed — deleting
--              an employee should never delete real sales/audit history,
--              it should just anonymize "who did it".
--
-- Columns that were NOT NULL needed dropping that constraint first —
-- SET NULL can't fire against a column that forbids null.

-- customer_onboarding: their own onboarding record dies with them;
-- the employee who ran it just becomes unassigned.
alter table waytara.customer_onboarding
  alter column employee_id drop not null;

alter table waytara.customer_onboarding
  drop constraint customer_onboarding_customer_id_fkey,
  add constraint customer_onboarding_customer_id_fkey
    foreign key (customer_id) references waytara.profiles(id) on delete cascade;

alter table waytara.customer_onboarding
  drop constraint customer_onboarding_employee_id_fkey,
  add constraint customer_onboarding_employee_id_fkey
    foreign key (employee_id) references waytara.profiles(id) on delete set null;

-- quotations: a real financial record — survives, employee_id -> null.
alter table waytara.quotations
  alter column employee_id drop not null;

alter table waytara.quotations
  drop constraint quotations_employee_id_fkey,
  add constraint quotations_employee_id_fkey
    foreign key (employee_id) references waytara.profiles(id) on delete set null;

-- leads: already nullable (unassigned is a real, meaningful state —
-- lead_status has no dedicated value for it, but assigned_to = null is
-- how "new"/unassigned leads already work).
alter table waytara.leads
  drop constraint leads_assigned_to_fkey,
  add constraint leads_assigned_to_fkey
    foreign key (assigned_to) references waytara.profiles(id) on delete set null;

-- test_sessions: connection-test history survives the technician's
-- account being removed.
alter table waytara.test_sessions
  alter column employee_id drop not null;

alter table waytara.test_sessions
  drop constraint test_sessions_employee_id_fkey,
  add constraint test_sessions_employee_id_fkey
    foreign key (employee_id) references waytara.profiles(id) on delete set null;

-- maintenance_tickets: employee_id/device_id already nullable.
alter table waytara.maintenance_tickets
  drop constraint maintenance_tickets_employee_id_fkey,
  add constraint maintenance_tickets_employee_id_fkey
    foreign key (employee_id) references waytara.profiles(id) on delete set null;

alter table waytara.maintenance_tickets
  drop constraint maintenance_tickets_device_id_fkey,
  add constraint maintenance_tickets_device_id_fkey
    foreign key (device_id) references waytara.devices(id) on delete set null;

-- alerts.acknowledged_by: already nullable — the alert itself is anchored
-- to device_id (already cascades), this is just "who acked it".
alter table waytara.alerts
  drop constraint alerts_acknowledged_by_fkey,
  add constraint alerts_acknowledged_by_fkey
    foreign key (acknowledged_by) references waytara.profiles(id) on delete set null;

-- audit_log.actor_id: the actual bug this session hit directly — an
-- audit trail must never block a delete, and must never disappear.
alter table waytara.audit_log
  drop constraint audit_log_actor_id_fkey,
  add constraint audit_log_actor_id_fkey
    foreign key (actor_id) references waytara.profiles(id) on delete set null;

-- device_settings.written_by: already nullable — the setting-change
-- history survives, device_id already cascades the row when the device
-- itself is removed.
alter table waytara.device_settings
  drop constraint device_settings_written_by_fkey,
  add constraint device_settings_written_by_fkey
    foreign key (written_by) references waytara.profiles(id) on delete set null;

-- employee_invites.invited_by: the invite record (and its accept/revoke
-- history) survives the inviting admin's account being removed.
alter table waytara.employee_invites
  alter column invited_by drop not null;

alter table waytara.employee_invites
  drop constraint employee_invites_invited_by_fkey,
  add constraint employee_invites_invited_by_fkey
    foreign key (invited_by) references waytara.profiles(id) on delete set null;

-- installations: unused table (nothing in either app reads/writes it —
-- a leftover from before customer_onboarding's stage pipeline replaced
-- whatever this was meant to be), fixed anyway for consistency since a
-- stray NOT NULL/RESTRICT here would still block a delete if a row ever
-- exists.
alter table waytara.installations
  alter column employee_id drop not null;

alter table waytara.installations
  drop constraint installations_employee_id_fkey,
  add constraint installations_employee_id_fkey
    foreign key (employee_id) references waytara.profiles(id) on delete set null;
