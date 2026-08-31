-- Task 9: customer dashboard shell. Checked systematically this time
-- (pg_class.relrowsecurity + pg_policy via `supabase db query --linked`)
-- rather than discovering gaps one at a time:
--
--   alerts               RLS on, zero policies  -> fully locked
--   maintenance_tickets  RLS on, zero policies  -> fully locked
--   subscriptions        RLS on, zero policies  -> fully locked
--   profiles             SELECT only, no UPDATE at all (not even admin)
--   customers            SELECT only, no UPDATE at all (not even admin)
--
-- profiles/customers self-update is deliberately column-restricted via
-- REVOKE+GRANT, not just a row-level `id = auth.uid()` check — a bare RLS
-- policy would let a customer PATCH their own `role` to 'admin', or change
-- their own `customers.plan_id`/`status` without paying for the upgrade.
-- Column-level grants are the correct tool for "this role may update column
-- X but not column Y on rows it owns" since RLS itself is row-level only.
-- If Task 11.1 later needs admin to change someone else's role, that
-- should go through createServiceRoleClient() (bypasses RLS/grants
-- entirely) rather than re-opening this grant — re-opening it here would
-- also re-open it for every customer's own self-update.

revoke update on waytara.profiles from authenticated;
grant update (full_name, phone, avatar_url) on waytara.profiles to authenticated;

drop policy if exists "profiles_self_update" on waytara.profiles;
create policy "profiles_self_update" on waytara.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on waytara.customers from authenticated;
grant update (address, billing_email) on waytara.customers to authenticated;

drop policy if exists "customers_self_update" on waytara.customers;
create policy "customers_self_update" on waytara.customers
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- alerts: owner (via device -> site -> customer), admin, employee-assigned —
-- same three-way shape as devices/sites. Read-only for now; Task 12.1
-- (device-offline detection) is what will need to actually insert these,
-- via a scheduled job/trigger running as service_role.

drop policy if exists "alerts_owner" on waytara.alerts;
create policy "alerts_owner" on waytara.alerts
  for select
  using (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      where d.id = alerts.device_id and s.customer_id = auth.uid()
    )
  );

drop policy if exists "alerts_admin_all" on waytara.alerts;
create policy "alerts_admin_all" on waytara.alerts
  for select
  using (waytara.is_admin());

drop policy if exists "alerts_employee_assigned" on waytara.alerts;
create policy "alerts_employee_assigned" on waytara.alerts
  for select
  using (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where d.id = alerts.device_id and co.employee_id = auth.uid()
    )
  );

-- maintenance_tickets: customer can see and create their own; admin sees
-- all; employee sees tickets for customers assigned to them.

drop policy if exists "maintenance_customer_own_select" on waytara.maintenance_tickets;
create policy "maintenance_customer_own_select" on waytara.maintenance_tickets
  for select
  using (customer_id = auth.uid());

drop policy if exists "maintenance_customer_own_insert" on waytara.maintenance_tickets;
create policy "maintenance_customer_own_insert" on waytara.maintenance_tickets
  for insert
  with check (customer_id = auth.uid());

drop policy if exists "maintenance_admin_all" on waytara.maintenance_tickets;
create policy "maintenance_admin_all" on waytara.maintenance_tickets
  for select
  using (waytara.is_admin());

drop policy if exists "maintenance_employee_assigned" on waytara.maintenance_tickets;
create policy "maintenance_employee_assigned" on waytara.maintenance_tickets
  for select
  using (
    exists (
      select 1 from waytara.customer_onboarding co
      where co.customer_id = maintenance_tickets.customer_id and co.employee_id = auth.uid()
    )
  );

-- subscriptions: read-only for now (nothing in the pipeline creates a row
-- here yet — a real gap, but out of Task 9's scope, which is display only;
-- flagged for whoever wires up subscription creation).

drop policy if exists "subscriptions_owner_select" on waytara.subscriptions;
create policy "subscriptions_owner_select" on waytara.subscriptions
  for select
  using (customer_id = auth.uid());

drop policy if exists "subscriptions_admin_all" on waytara.subscriptions;
create policy "subscriptions_admin_all" on waytara.subscriptions
  for select
  using (waytara.is_admin());
