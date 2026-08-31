-- Task 12.1 (alerts): alerts has had SELECT-only policies since Task 9
-- (owner/admin/employee-assigned), with its own comment flagging this as
-- read-only "until Task 12.1 (device-offline detection) is what will need
-- to actually insert these, via a scheduled job/trigger running as
-- service_role" — that job doesn't need an RLS policy (service_role
-- bypasses RLS entirely), but acknowledging an alert from the dashboard
-- does need one, and nothing granted UPDATE at all.

drop policy if exists "alerts_owner_update" on waytara.alerts;
create policy "alerts_owner_update" on waytara.alerts
  for update
  using (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      where d.id = alerts.device_id and s.customer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      where d.id = alerts.device_id and s.customer_id = auth.uid()
    )
  );

drop policy if exists "alerts_employee_update_assigned" on waytara.alerts;
create policy "alerts_employee_update_assigned" on waytara.alerts
  for update
  using (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where d.id = alerts.device_id and co.employee_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where d.id = alerts.device_id and co.employee_id = auth.uid()
    )
  );

drop policy if exists "alerts_admin_update" on waytara.alerts;
create policy "alerts_admin_update" on waytara.alerts
  for update
  using (waytara.is_admin())
  with check (waytara.is_admin());
