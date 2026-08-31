-- Task 8.5 (Connection test): test_sessions already existed in the schema
-- with exactly the right shape for this (employee_id, site_id, status:
-- running/verified/failed, data_purged) and device_readings already had a
-- SELECT policy scoping an employee's view of is_test=true readings to a
-- site with a running session they own — but test_sessions itself had the
-- same recurring gap as every other table this session: SELECT only, no
-- write path at all. Nobody could ever start one.

drop policy if exists "test_sessions_employee_insert_assigned" on waytara.test_sessions;
create policy "test_sessions_employee_insert_assigned" on waytara.test_sessions
  for insert
  with check (
    employee_id = auth.uid()
    and exists (
      select 1 from waytara.sites s
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where s.id = test_sessions.site_id and co.employee_id = auth.uid()
    )
  );

drop policy if exists "test_sessions_employee_update_own" on waytara.test_sessions;
create policy "test_sessions_employee_update_own" on waytara.test_sessions
  for update
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());

-- device_readings had SELECT policies (owner/admin/employee-active-test)
-- but no way to ever write a row outside service_role — fine for owner
-- (real hardware pushes via a service integration, not the browser) but
-- the employee's own simulated test signal during a connection test needs
-- a real INSERT path scoped the same way readings_employee_active_test_only
-- already scopes the read: is_test rows only, only for a site with a
-- running session owned by that employee.

drop policy if exists "readings_employee_insert_active_test" on waytara.device_readings;
create policy "readings_employee_insert_active_test" on waytara.device_readings
  for insert
  with check (
    is_test = true
    and exists (
      select 1 from waytara.test_sessions ts
      join waytara.devices d on d.site_id = ts.site_id
      where d.id = device_readings.device_id
        and ts.employee_id = auth.uid()
        and ts.status = 'running'
    )
  );

-- test_sessions.data_purged signals the schema's own intent: test readings
-- are meant to be deleted once a session ends, not linger. Scoped the same
-- way as the insert policy above.
drop policy if exists "readings_employee_delete_own_test" on waytara.device_readings;
create policy "readings_employee_delete_own_test" on waytara.device_readings
  for delete
  using (
    is_test = true
    and exists (
      select 1 from waytara.test_sessions ts
      join waytara.devices d on d.site_id = ts.site_id
      where d.id = device_readings.device_id
        and ts.employee_id = auth.uid()
        and ts.status = 'running'
    )
  );
